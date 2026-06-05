import {
  readOverview,
  readProject,
  readRequirements,
  readTickets,
} from "./projects";
import { readReleaseRecords } from "./release-records";
import type {
  LocalFileReference,
  Overview,
  ProjectInfo,
  ReleaseRecord,
  Requirement,
  RequirementTimelineItem,
  Ticket,
  TimelineEvent,
} from "./types";

const DEEPSEEK_CHAT_COMPLETIONS_URL =
  "https://api.deepseek.com/chat/completions";

export type ProjectAiChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ProjectAiModel = "deepseek-v4-flash" | "deepseek-v4-pro";

type ProjectAiContext = {
  project: ReturnType<typeof compactProject>;
  overview: ReturnType<typeof compactOverview>;
  release_records: ReturnType<typeof compactReleaseRecord>[];
  requirements: ReturnType<typeof compactRequirement>[];
  tickets: ReturnType<typeof compactTicket>[];
};

export class ProjectAiInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectAiInputError";
  }
}

export function validateProjectAiMessages(input: unknown): ProjectAiChatMessage[] {
  if (!input || typeof input !== "object") {
    throw new ProjectAiInputError("Invalid Ask AI request.");
  }

  const messages = (input as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) {
    throw new ProjectAiInputError("Ask AI messages are required.");
  }

  const normalized = messages.map((message) => normalizeChatMessage(message));
  const finalMessage = normalized.at(-1);
  if (!finalMessage || finalMessage.role !== "user" || !finalMessage.content) {
    throw new ProjectAiInputError("Ask AI requires a user prompt.");
  }

  return normalized;
}

export function projectAiModelFromRequest(input: unknown): ProjectAiModel {
  if (!input || typeof input !== "object") {
    return "deepseek-v4-flash";
  }
  return (input as { deepThinking?: unknown }).deepThinking === true
    ? "deepseek-v4-pro"
    : "deepseek-v4-flash";
}

export async function askProjectAi(
  key: string,
  messages: ProjectAiChatMessage[],
  model: ProjectAiModel = "deepseek-v4-flash",
) {
  const context = await buildProjectAiContext(key);
  return requestDeepSeekProjectAnswer(context, messages, model);
}

async function buildProjectAiContext(key: string): Promise<ProjectAiContext> {
  const [project, overview, releaseRecords, requirements, tickets] =
    await Promise.all([
      readProject(key),
      readOverview(key),
      readReleaseRecords(key),
      readRequirements(key),
      readTickets(key),
    ]);

  return {
    project: compactProject(project),
    overview: compactOverview(overview),
    release_records: releaseRecords.map(compactReleaseRecord),
    requirements: requirements.map(compactRequirement),
    tickets: tickets.map(compactTicket),
  };
}

async function requestDeepSeekProjectAnswer(
  context: ProjectAiContext,
  messages: ProjectAiChatMessage[],
  model: ProjectAiModel,
) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured.");
  }

  const response = await fetch(DEEPSEEK_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        { role: "system", content: PROJECT_ASK_AI_PROMPT },
        {
          role: "user",
          content: `Project context JSON:\n${JSON.stringify(context, null, 2)}`,
        },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const answer = data.choices?.[0]?.message?.content?.trim();
  if (!answer) {
    throw new Error("DeepSeek returned an empty answer.");
  }

  return answer;
}

function normalizeChatMessage(message: unknown): ProjectAiChatMessage {
  if (!message || typeof message !== "object") {
    throw new ProjectAiInputError("Invalid Ask AI message.");
  }

  const current = message as { role?: unknown; content?: unknown };
  const role = current.role;
  if (role !== "user" && role !== "assistant") {
    throw new ProjectAiInputError("Invalid Ask AI message role.");
  }

  const content = cleanText(current.content);
  if (!content) {
    throw new ProjectAiInputError("Ask AI message content cannot be empty.");
  }

  return { role, content };
}

function compactProject(project: ProjectInfo) {
  return {
    project_id: project.project_id,
    project_name: project.project_name,
    country: project.country,
    customer: project.customer,
    sales: project.sales,
    created_at: project.created_at,
  };
}

function compactOverview(overview: Overview) {
  return {
    models: overview.models,
    others: overview.others,
    description: overview.description,
    demands: overview.requirements.map((requirement) => ({
      id: requirement.id,
      product: requirement.product,
      simple_requirements: requirement.simple_requirements,
      linked_requirements: requirement.linked_requirements,
      remark: requirement.remark,
      created_at: requirement.created_at,
    })),
  };
}

function compactReleaseRecord(record: ReleaseRecord) {
  return {
    model: record.model,
    firmware: record.firmware,
    change_log: record.change_log,
    release_date: record.release_date,
    order_count: record.order_count,
    order_time: record.order_time,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

function compactRequirement(requirement: Requirement) {
  return {
    id: requirement.id,
    title: requirement.title,
    status: requirement.status,
    details: requirement.details,
    related_tickets: requirement.related_tickets,
    timeline: requirement.timeline.map(compactRequirementTimelineItem),
    references: requirement.references.map(compactReference),
    created_at: requirement.created_at,
    last_updated: requirement.last_updated,
  };
}

function compactRequirementTimelineItem(item: RequirementTimelineItem) {
  return {
    time: item.time,
    remark: item.remark,
  };
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
    references: ticket.references.map(compactReference),
  };
}

function compactTicketEvent(event: TimelineEvent) {
  return {
    time: event.time,
    role: event.role,
    content: event.content,
  };
}

function compactReference(reference: LocalFileReference) {
  return {
    path: reference.path,
    name: reference.name,
    size: reference.size,
    modified_at: reference.modified_at,
    added_at: reference.added_at,
  };
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

const PROJECT_ASK_AI_PROMPT = `
You answer questions about one Urovo support project workspace.

Use only the provided project context JSON and the current chat messages. Do not use outside knowledge. Do not invent missing facts, causes, dates, owners, decisions, requirements, ticket progress, firmware details, or release status. If the records do not contain enough information, say that the stored project records do not include the answer.

When useful, cite the relevant project record by its stored display ID or stable label: ticket IDs, requirement IDs, demand IDs, project name, model, firmware, release date, or order time. Local file reference contents are not provided; only their names and paths are available.

Match the user's language. Keep answers practical, concise, and grounded in the stored records. Markdown is allowed.
`;
