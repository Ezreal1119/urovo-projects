import { appendChangeLogs, visibleEntityId } from "./change-log";
import { readTickets, sortTickets, writeTickets } from "./projects";
import { beijingNowIsoString } from "./time";
import type { Ticket, TimelineEvent } from "./types";

const DEEPSEEK_CHAT_COMPLETIONS_URL =
  "https://api.deepseek.com/chat/completions";

type RawTicketNextAction = {
  next_action?: unknown;
};

export class TicketNextActionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketNextActionNotFoundError";
  }
}

export async function generateTicketNextAction(
  key: string,
  ticketId: string,
) {
  const tickets = await readTickets(key);
  const index = tickets.findIndex((ticket) => ticket.id === ticketId);
  if (index === -1) {
    throw new TicketNextActionNotFoundError("Ticket not found.");
  }

  const existing = tickets[index];
  const nextAction = await requestTicketNextAction(existing);
  const ticket: Ticket = {
    ...existing,
    next_action: nextAction,
    updated_at: beijingNowIsoString(),
  };
  const nextTickets = tickets.toSpliced(index, 1, ticket).sort(sortTickets);

  await writeTickets(key, nextTickets);
  await appendChangeLogs(key, [
    {
      entityType: "ticket",
      ...visibleEntityId(ticket),
      action: "ticket_updated",
      content: `AI generated next action: ${nextAction}`,
    },
  ]);

  return { ticket };
}

async function requestTicketNextAction(ticket: Ticket) {
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
      model: "deepseek-v4-flash",
      temperature: 0.1,
      messages: [
        { role: "system", content: TICKET_NEXT_ACTION_PROMPT },
        {
          role: "user",
          content: JSON.stringify({ ticket: compactTicket(ticket) }, null, 2),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("DeepSeek returned an empty Next Action result.");
  }

  const nextAction = cleanText(parseTicketNextActionJson(content).next_action);
  if (!nextAction) {
    throw new Error("DeepSeek returned an empty Next Action.");
  }

  return nextAction;
}

function parseTicketNextActionJson(content: string): RawTicketNextAction {
  const json = content.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? content;

  try {
    const parsed = JSON.parse(json) as RawTicketNextAction;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Next Action JSON must be an object.");
    }
    return parsed;
  } catch {
    throw new Error("DeepSeek returned invalid Next Action JSON.");
  }
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
    current_next_action: ticket.next_action,
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

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

const TICKET_NEXT_ACTION_PROMPT = `
You generate the Next Action field for one Urovo technical support ticket.

Return strict JSON only. Do not wrap it in Markdown.
The JSON object must have this key:
- "next_action": one short sentence, under 24 words.

Use only the provided ticket JSON. Treat the ticket title, summary, current next action, status, priority, and timeline events as the source of truth. Base the answer primarily on the latest meaningful event.

Do not invent technical facts, dates, owners, customer commitments, root causes, firmware versions, or decisions. If the record does not state a concrete next step, write a practical clarification action, such as confirming the next owner or required follow-up, without adding unstated details.

Keep the sentence management-readable and action-oriented.
`;
