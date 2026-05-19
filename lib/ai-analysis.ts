import type { Requirement, RequirementTimelineItem, Ticket, TimelineEvent } from "./types";

const QWEN_CHAT_COMPLETIONS_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

type AiAnalysisEntityType = "ticket" | "requirement";

export type AiAnalysisEvent = {
  time: string;
  summary: string;
};

export type AiAnalysisResult = {
  entityType: AiAnalysisEntityType;
  entityId: string;
  title: string;
  description: string;
  progress: string;
  currentStatus: string;
  nextStep: string;
  events: AiAnalysisEvent[];
  markdown: string;
};

type RawAiAnalysis = {
  description?: unknown;
  progress?: unknown;
  current_status?: unknown;
  next_step?: unknown;
  events?: unknown;
  markdown?: unknown;
};

export async function analyzeTicket(ticket: Ticket): Promise<AiAnalysisResult> {
  const raw = await requestQwenAnalysis(TICKET_ANALYSIS_PROMPT, {
    ticket: compactTicket(ticket),
  });

  return normalizeAnalysis(raw, "ticket", ticket.id, ticket.title);
}

export async function analyzeRequirement(
  requirement: Requirement,
): Promise<AiAnalysisResult> {
  const raw = await requestQwenAnalysis(REQUIREMENT_ANALYSIS_PROMPT, {
    requirement: compactRequirement(requirement),
  });

  return normalizeAnalysis(
    raw,
    "requirement",
    requirement.id,
    requirement.title,
  );
}

async function requestQwenAnalysis(prompt: string, context: unknown) {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) {
    throw new Error("QWEN_API_KEY is not configured.");
  }

  const response = await fetch(QWEN_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "qwen-plus",
      temperature: 0.1,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: JSON.stringify(context, null, 2) },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Qwen request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("Qwen returned an empty analysis.");
  }

  return parseAnalysisJson(content);
}

function parseAnalysisJson(content: string): RawAiAnalysis {
  const json = content.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? content;

  try {
    const parsed = JSON.parse(json) as RawAiAnalysis;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Analysis JSON must be an object.");
    }
    return parsed;
  } catch {
    throw new Error("Qwen returned invalid analysis JSON.");
  }
}

function normalizeAnalysis(
  raw: RawAiAnalysis,
  entityType: AiAnalysisEntityType,
  entityId: string,
  title: string,
): AiAnalysisResult {
  const description = cleanText(raw.description);
  const progress = cleanText(raw.progress);
  const currentStatus = cleanText(raw.current_status);
  const nextStep = cleanText(raw.next_step);
  const events = normalizeEvents(raw.events);
  const markdown = cleanText(raw.markdown);

  if (!description || !progress || !currentStatus || !markdown) {
    throw new Error("Qwen returned an incomplete analysis.");
  }

  return {
    entityType,
    entityId,
    title,
    description,
    progress,
    currentStatus,
    nextStep: nextStep || "No next step is stated in the record.",
    events,
    markdown,
  };
}

function normalizeEvents(events: unknown): AiAnalysisEvent[] {
  if (!Array.isArray(events)) {
    return [];
  }

  return events
    .map((event) => {
      if (!event || typeof event !== "object") {
        return null;
      }
      const current = event as { time?: unknown; summary?: unknown };
      const summary = cleanText(current.summary);
      if (!summary) {
        return null;
      }
      return {
        time: cleanText(current.time) || "-",
        summary,
      };
    })
    .filter((event): event is AiAnalysisEvent => Boolean(event));
}

function compactTicket(ticket: Ticket) {
  return {
    id: ticket.id,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
    summary: ticket.summary,
    next_action: ticket.next_action,
    events: ticket.events.map(compactTicketEvent),
  };
}

function compactTicketEvent(event: TimelineEvent) {
  return {
    time: event.time,
    role: event.role,
    content: event.content,
  };
}

function compactRequirement(requirement: Requirement) {
  return {
    id: requirement.id,
    title: requirement.title,
    status: requirement.status,
    created_at: requirement.created_at,
    last_updated: requirement.last_updated,
    details: requirement.details,
    related_tickets: requirement.related_tickets,
    timeline: requirement.timeline.map(compactRequirementTimelineItem),
  };
}

function compactRequirementTimelineItem(item: RequirementTimelineItem) {
  return {
    time: item.time,
    remark: item.remark,
  };
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

const SHARED_ANALYSIS_RULES = `
Return strict JSON only. Do not wrap it in Markdown.
The JSON object must have these keys:
- "description": one concise paragraph explaining the whole situation.
- "progress": one concise paragraph explaining current progress from the record only.
- "current_status": one concise sentence explaining the current status.
- "next_step": one concise sentence. If no next step is stated, say that no next step is stated.
- "events": an array of {"time": string, "summary": string}; one short meaningful sentence per timeline item, in chronological order.
- "markdown": Markdown with headings "Description", "Progress", "Current Status", "Next Step", and "Timeline".

Use only the provided JSON record. Do not use outside knowledge. Do not invent causes, owners, dates, decisions, requirements, or progress. Preserve uncertainty when the record is unclear. Keep the result brief and useful for quickly recalling the situation.
`;

const TICKET_ANALYSIS_PROMPT = `
You analyze one technical support ticket for a project workspace.

Explain:
- what the issue is,
- the current support, customer, internal, sales, or other progress,
- how the ticket status and priority describe the current state,
- the next action if one is recorded,
- the chronological ticket events.

Ticket event roles describe who made or owns the update. Treat the ticket summary and timeline as the source of truth.

${SHARED_ANALYSIS_RULES}
`;

const REQUIREMENT_ANALYSIS_PROMPT = `
You analyze one customer or product requirement for a project workspace.

Explain:
- what is requested,
- the current implementation, testing, or follow-up progress,
- how the requirement status describes the current state,
- related ticket IDs only as references if present,
- the chronological requirement updates.

Do not infer details from related tickets because related ticket contents are not provided. Treat the requirement details and timeline as the source of truth.

${SHARED_ANALYSIS_RULES}
`;
