import { randomUUID } from "crypto";
import { readFile, rename, writeFile } from "fs/promises";
import path from "path";
import {
  backfillProjectUuids,
  projectDir,
  readProject,
} from "./projects";
import { beijingNowIsoString } from "./time";
import type {
  Ticket,
  TicketEventSummariesFile,
  TicketEventSummary,
  TicketEventSummaryTicket,
  TimelineEvent,
} from "./types";

const TICKET_EVENT_SUMMARIES_FILE = "ticket-event-summaries.json";
const TICKET_EVENT_SUMMARIES_VERSION = 1;
const DEEPSEEK_CHAT_COMPLETIONS_URL =
  "https://api.deepseek.com/chat/completions";
const MAX_SUMMARY_MESSAGE_LENGTH = 1200;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PolishResult = {
  tickets: Ticket[];
  summaries: TicketEventSummariesFile;
};

type RawAiTicketEventSummaries = {
  tickets?: unknown;
};

export async function readTicketEventSummaries(
  key: string,
): Promise<TicketEventSummariesFile> {
  await readProject(key);
  try {
    const raw = await readFile(ticketEventSummariesPath(key), "utf8");
    return normalizeStoredTicketEventSummaries(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyTicketEventSummaries();
    }
    throw error;
  }
}

export async function polishTicketEventSummaries(
  key: string,
): Promise<PolishResult> {
  const project = await readProject(key);
  const { tickets } = await backfillProjectUuids(key);
  const previousSummaries = await readTicketEventSummaries(key);
  const polishedAt = beijingNowIsoString();
  const rawSummaries = await requestDeepSeekTicketEventSummaries({
    project,
    tickets: tickets.map(compactTicketForAi),
    previous_summaries: previousSummaries.tickets,
  });
  const summaries: TicketEventSummariesFile = {
    version: TICKET_EVENT_SUMMARIES_VERSION,
    last_polished_at: polishedAt,
    tickets: validateAiTicketEventSummaries(
      rawSummaries,
      tickets,
      previousSummaries,
      polishedAt,
    ),
  };

  await writeTicketEventSummaries(key, summaries);
  return { tickets, summaries };
}

export async function polishSingleTicketEventSummaries(
  key: string,
  ticketId: string,
): Promise<PolishResult> {
  const project = await readProject(key);
  const { tickets } = await backfillProjectUuids(key);
  const ticket = tickets.find((current) => current.id === ticketId);
  if (!ticket) {
    throw new TicketEventSummaryNotFoundError("Ticket not found.");
  }

  const previousSummaries = await readTicketEventSummaries(key);
  const polishedAt = beijingNowIsoString();
  const previousTicketSummaries = {
    ...previousSummaries,
    tickets: previousSummaries.tickets.filter(
      (current) =>
        (ticket.uuid && current.ticket_uuid === ticket.uuid) ||
        current.ticket_id === ticket.id,
    ),
  };
  const rawSummaries = await requestDeepSeekTicketEventSummaries({
    project,
    tickets: [compactTicketForAi(ticket)],
    previous_summaries: previousTicketSummaries.tickets,
  });
  const nextTicketSummaries = validateAiTicketEventSummaries(
    rawSummaries,
    [ticket],
    previousTicketSummaries,
    polishedAt,
  );
  const summaries: TicketEventSummariesFile = {
    version: TICKET_EVENT_SUMMARIES_VERSION,
    last_polished_at: polishedAt,
    tickets: mergeTicketSummaries(
      previousSummaries,
      ticket,
      nextTicketSummaries[0],
    ),
  };

  await writeTicketEventSummaries(key, summaries);
  return { tickets, summaries };
}

function emptyTicketEventSummaries(): TicketEventSummariesFile {
  return {
    version: TICKET_EVENT_SUMMARIES_VERSION,
    last_polished_at: "",
    tickets: [],
  };
}

function mergeTicketSummaries(
  previousSummaries: TicketEventSummariesFile,
  ticket: Ticket,
  nextTicketSummary: TicketEventSummaryTicket | undefined,
) {
  const nextTickets = previousSummaries.tickets.filter(
    (current) =>
      !(
        (ticket.uuid && current.ticket_uuid === ticket.uuid) ||
        current.ticket_id === ticket.id
      ),
  );
  return nextTicketSummary ? [...nextTickets, nextTicketSummary] : nextTickets;
}

async function writeTicketEventSummaries(
  key: string,
  summaries: TicketEventSummariesFile,
) {
  await readProject(key);
  const filePath = ticketEventSummariesPath(key);
  const tempFile = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(summaries, null, 2)}\n`, "utf8");
  await rename(tempFile, filePath);
}

async function requestDeepSeekTicketEventSummaries(context: unknown) {
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
      model: "deepseek-v4-pro",
      temperature: 0.1,
      messages: [
        { role: "system", content: TICKET_EVENT_SUMMARY_PROMPT },
        { role: "user", content: JSON.stringify(context, null, 2) },
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
    throw new Error("DeepSeek returned an empty AI Polish result.");
  }
  return parseAiJson(content);
}

function parseAiJson(content: string): RawAiTicketEventSummaries {
  const json = content.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? content;

  try {
    const parsed = JSON.parse(json) as RawAiTicketEventSummaries;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("AI Polish JSON must be an object.");
    }
    return parsed;
  } catch {
    throw new Error("DeepSeek returned invalid AI Polish JSON.");
  }
}

function validateAiTicketEventSummaries(
  raw: RawAiTicketEventSummaries,
  tickets: Ticket[],
  previousSummaries: TicketEventSummariesFile,
  polishedAt: string,
): TicketEventSummaryTicket[] {
  if (!Array.isArray(raw.tickets)) {
    throw new Error("AI Polish JSON must include a tickets array.");
  }

  const ticketByUuid = new Map<string, Ticket>();
  const eventUuidsByTicketUuid = new Map<string, Set<string>>();
  const previousSummaryUuidByGroup = previousSummaryUuidMap(previousSummaries);

  for (const ticket of tickets) {
    const ticketUuid = requireUuid(ticket.uuid, `Ticket ${ticket.id}`);
    ticketByUuid.set(ticketUuid, ticket);
    const eventUuids = new Set<string>();
    for (const event of ticket.events) {
      eventUuids.add(requireUuid(event.uuid, `Event in ticket ${ticket.id}`));
    }
    eventUuidsByTicketUuid.set(ticketUuid, eventUuids);
  }

  const seenTickets = new Set<string>();
  const seenSummaryUuids = new Set<string>();
  const seenEventUuidsByTicketUuid = new Map<string, Set<string>>();
  const nextTickets: TicketEventSummaryTicket[] = [];

  for (const rawTicket of raw.tickets) {
    if (!isRecord(rawTicket)) {
      throw new Error("Each AI Polish ticket entry must be an object.");
    }

    const ticketUuid = requireUuid(rawTicket.ticket_uuid, "AI Polish ticket");
    const ticket = ticketByUuid.get(ticketUuid);
    if (!ticket) {
      throw new Error("AI Polish referenced an unknown ticket.");
    }
    if (seenTickets.has(ticketUuid)) {
      throw new Error(`AI Polish returned duplicate ticket ${ticket.id}.`);
    }
    seenTickets.add(ticketUuid);

    const ticketId = cleanText(rawTicket.ticket_id);
    if (ticketId !== ticket.id) {
      throw new Error(`AI Polish returned a mismatched ticket ID for ${ticket.id}.`);
    }

    if (!Array.isArray(rawTicket.summaries)) {
      throw new Error(`AI Polish ticket ${ticket.id} must include summaries.`);
    }

    const validEventUuids = eventUuidsByTicketUuid.get(ticketUuid) ?? new Set();
    const seenEventUuids = new Set<string>();
    const summaries: TicketEventSummary[] = rawTicket.summaries.map((summary) =>
      normalizeAiSummary(
        summary,
        ticket,
        validEventUuids,
        seenEventUuids,
        seenSummaryUuids,
        previousSummaryUuidByGroup,
      ),
    );
    seenEventUuidsByTicketUuid.set(ticketUuid, seenEventUuids);

    if (summaries.length > 0) {
      nextTickets.push({
        ticket_uuid: ticketUuid,
        ticket_id: ticket.id,
        last_polished_at: polishedAt,
        summaries,
      });
    }
  }

  for (const [ticketUuid, eventUuids] of eventUuidsByTicketUuid) {
    if (eventUuids.size === 0) {
      continue;
    }
    const seenEventUuids = seenEventUuidsByTicketUuid.get(ticketUuid);
    if (!seenEventUuids || seenEventUuids.size !== eventUuids.size) {
      const ticket = ticketByUuid.get(ticketUuid);
      throw new Error(
        `AI Polish must summarize every event for ${ticket?.id ?? "ticket"}.`,
      );
    }
  }

  return nextTickets;
}

function normalizeAiSummary(
  raw: unknown,
  ticket: Ticket,
  validEventUuids: Set<string>,
  seenEventUuids: Set<string>,
  seenSummaryUuids: Set<string>,
  previousSummaryUuidByGroup: Map<string, string>,
): TicketEventSummary {
  if (!isRecord(raw)) {
    throw new Error(`Each summary for ${ticket.id} must be an object.`);
  }

  const message = cleanText(raw.message);
  if (!message) {
    throw new Error(`AI Polish returned an empty summary for ${ticket.id}.`);
  }
  if (message.length > MAX_SUMMARY_MESSAGE_LENGTH) {
    throw new Error(`AI Polish returned an overlong summary for ${ticket.id}.`);
  }

  if (!Array.isArray(raw.related_event_uuids) || raw.related_event_uuids.length === 0) {
    throw new Error(`AI Polish summary for ${ticket.id} must reference events.`);
  }

  const relatedEventUuids = raw.related_event_uuids.map((value) => {
    const eventUuid = requireUuid(value, `Related event for ${ticket.id}`);
    if (!validEventUuids.has(eventUuid)) {
      throw new Error(`AI Polish summary for ${ticket.id} referenced an unknown event.`);
    }
    if (seenEventUuids.has(eventUuid)) {
      throw new Error(`AI Polish assigned an event in ${ticket.id} more than once.`);
    }
    seenEventUuids.add(eventUuid);
    return eventUuid;
  });
  const uuid =
    previousSummaryUuidByGroup.get(summaryGroupKey(ticket, relatedEventUuids)) ??
    randomUUID();
  if (seenSummaryUuids.has(uuid)) {
    throw new Error("AI Polish produced duplicate summary groups.");
  }
  seenSummaryUuids.add(uuid);

  return {
    uuid,
    message,
    related_event_uuids: relatedEventUuids,
  };
}

function previousSummaryUuidMap(summaries: TicketEventSummariesFile) {
  const summaryUuidByGroup = new Map<string, string>();
  for (const ticket of summaries.tickets) {
    for (const summary of ticket.summaries) {
      const uuid = cleanText(summary.uuid);
      if (!UUID_PATTERN.test(uuid) || summary.related_event_uuids.length === 0) {
        continue;
      }
      summaryUuidByGroup.set(
        storedSummaryGroupKey(ticket.ticket_uuid, summary.related_event_uuids),
        uuid,
      );
    }
  }
  return summaryUuidByGroup;
}

function summaryGroupKey(ticket: Ticket, eventUuids: string[]) {
  return storedSummaryGroupKey(requireUuid(ticket.uuid, `Ticket ${ticket.id}`), eventUuids);
}

function storedSummaryGroupKey(ticketUuid: string, eventUuids: string[]) {
  return `${ticketUuid}:${[...eventUuids].sort().join("|")}`;
}

function normalizeStoredTicketEventSummaries(raw: unknown): TicketEventSummariesFile {
  if (!isRecord(raw)) {
    return emptyTicketEventSummaries();
  }
  return {
    version: TICKET_EVENT_SUMMARIES_VERSION,
    last_polished_at: cleanText(raw.last_polished_at),
    tickets: Array.isArray(raw.tickets)
      ? raw.tickets
          .map(normalizeStoredTicketSummary)
          .filter((ticket): ticket is TicketEventSummaryTicket => Boolean(ticket))
      : [],
  };
}

function normalizeStoredTicketSummary(raw: unknown): TicketEventSummaryTicket | null {
  if (!isRecord(raw)) {
    return null;
  }
  const ticketUuid = cleanText(raw.ticket_uuid);
  const ticketId = cleanText(raw.ticket_id);
  if (!ticketUuid || !ticketId) {
    return null;
  }
  const summaries = Array.isArray(raw.summaries)
    ? raw.summaries
        .map(normalizeStoredSummary)
        .filter((summary): summary is TicketEventSummary => Boolean(summary))
    : [];
  return {
    ticket_uuid: ticketUuid,
    ticket_id: ticketId,
    last_polished_at: cleanText(raw.last_polished_at),
    summaries,
  };
}

function normalizeStoredSummary(raw: unknown): TicketEventSummary | null {
  if (!isRecord(raw)) {
    return null;
  }
  const uuid = cleanText(raw.uuid);
  const message = cleanText(raw.message);
  if (!uuid || !message) {
    return null;
  }
  return {
    uuid,
    message,
    related_event_uuids: Array.isArray(raw.related_event_uuids)
      ? raw.related_event_uuids.map(cleanText).filter(Boolean)
      : [],
  };
}

function compactTicketForAi(ticket: Ticket) {
  return {
    ticket_id: ticket.id,
    ticket_uuid: ticket.uuid,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    summary: ticket.summary,
    next_action: ticket.next_action,
    updated_at: ticket.updated_at,
    events: ticket.events.map(compactEventForAi),
  };
}

function compactEventForAi(event: TimelineEvent) {
  return {
    event_uuid: event.uuid,
    time: event.time,
    role: event.role,
    content: event.content,
  };
}

function requireUuid(value: unknown, label: string) {
  const uuid = cleanText(value);
  if (!UUID_PATTERN.test(uuid)) {
    throw new Error(`${label} must have a valid UUID.`);
  }
  return uuid;
}

function ticketEventSummariesPath(key: string) {
  return path.join(projectDir(key), TICKET_EVENT_SUMMARIES_FILE);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

const TICKET_EVENT_SUMMARY_PROMPT = `
You polish raw technical support ticket events into concise Event Summaries.

Return strict JSON only. Do not wrap the response in Markdown.
The JSON object must have this shape:
{
  "tickets": [
    {
      "ticket_uuid": "existing ticket_uuid",
      "ticket_id": "existing ticket_id",
      "summaries": [
        {
          "message": "concise polished business English summary",
          "related_event_uuids": ["event_uuid"]
        }
      ]
    }
  ]
}

Rules:
- Use only the provided JSON data. Do not invent project facts, causes, owners, decisions, dates, or progress.
- Write English only, with an internal management-facing support tone.
- Mention the actor/source when useful, such as "Customer reported", "Support confirmed", or "Internal testing found".
- Each current event_uuid must appear exactly once in the summaries for the same ticket.
- Do not reference event UUIDs or ticket UUIDs that are not provided.
- Do not include summary UUIDs. The application assigns and preserves summary UUIDs after validation.
- Preserve previous wording when the related event group still represents the same meaning.
- Update wording only when new or changed raw events materially change the meaning.
- Remove summaries whose related events no longer exist.
- Keep each message brief, polished, and management-readable, but do not force an unnatural template.
- Translate or summarize Chinese and raw copied language into clear English.
- Do not copy raw messages verbatim. Abstract noisy chat text into clear business English.
- Avoid exposing credentials, SSH keys, private server details, and long technical dumps unless the detail is essential to understanding the support status.
`;

export class TicketEventSummaryNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketEventSummaryNotFoundError";
  }
}
