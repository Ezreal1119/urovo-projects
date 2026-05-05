import { readFile } from "fs/promises";
import path from "path";
import {
  getProjectsRoot,
  listProjects,
  readRequirements,
  readTickets,
} from "./projects";
import {
  ChangeLogEntry,
  ChangeLogFile,
  ProjectInfo,
  Requirement,
  Ticket,
} from "./types";

const CHANGE_LOG_FILE = "CHANGE_LOG.json";
const REPORT_PROMPT_FILE = "report_prompt.md";
const QWEN_CHAT_COMPLETIONS_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

export type ReportDateRange = {
  startDate: string;
  endDate: string;
};

export type ReportResult =
  | {
      status: "no_data";
      ticketCount: 0;
      requirementCount: 0;
    }
  | {
      status: "generated";
      report: string;
      ticketCount: number;
      requirementCount: number;
    };

type ReportProjectContext = {
  folder: string;
  project: ProjectInfo;
  tickets: Ticket[];
  requirements: Requirement[];
};

type ReportContext = {
  range: ReportDateRange;
  projects: ReportProjectContext[];
};

export function validateReportDateRange(input: unknown): ReportDateRange {
  if (!input || typeof input !== "object") {
    throw new ReportInputError("Invalid report request.");
  }
  const current = input as Partial<ReportDateRange>;
  const startDate = cleanDate(current.startDate);
  const endDate = cleanDate(current.endDate);

  if (!startDate || !endDate) {
    throw new ReportInputError("Start date and end date are required.");
  }
  if (startDate > endDate) {
    throw new ReportInputError("Start date must be before or equal to end date.");
  }

  return { startDate, endDate };
}

export async function generateReport(range: ReportDateRange): Promise<ReportResult> {
  const context = await buildReportContext(range);
  const ticketCount = context.projects.reduce(
    (total, project) => total + project.tickets.length,
    0,
  );
  const requirementCount = context.projects.reduce(
    (total, project) => total + project.requirements.length,
    0,
  );

  if (ticketCount === 0 && requirementCount === 0) {
    return { status: "no_data", ticketCount: 0, requirementCount: 0 };
  }

  const prompt = await readReportPrompt();
  const report = await requestQwenReport(prompt, context);

  return { status: "generated", report, ticketCount, requirementCount };
}

async function buildReportContext(range: ReportDateRange): Promise<ReportContext> {
  const [changeLog, projects] = await Promise.all([readChangeLog(), listProjects()]);
  const projectById = new Map(
    projects.map((item) => [item.project.project_id, item]),
  );
  const logs = changeLog.logs.filter(
    (log) =>
      (log.entity_type === "ticket" || log.entity_type === "requirement") &&
      isDateInRange(dateOnly(log.time), range),
  );
  const entityKeys = Array.from(
    new Map(
      logs
        .filter((log) => projectById.has(log.project_id) && log.entity_id)
        .map((log) => [
          `${log.project_id}:${log.entity_type}:${log.entity_id}`,
          {
            projectId: log.project_id,
            entityType: log.entity_type,
            entityId: log.entity_id,
          },
        ]),
    ).values(),
  );
  const wantedByProject = new Map<string, { tickets: Set<string>; requirements: Set<string> }>();

  for (const key of entityKeys) {
    const wanted = wantedByProject.get(key.projectId) ?? {
      tickets: new Set<string>(),
      requirements: new Set<string>(),
    };
    if (key.entityType === "ticket") {
      wanted.tickets.add(key.entityId);
    } else {
      wanted.requirements.add(key.entityId);
    }
    wantedByProject.set(key.projectId, wanted);
  }

  const reportProjects = await Promise.all(
    Array.from(wantedByProject.entries()).map(async ([projectId, wanted]) => {
      const item = projectById.get(projectId);
      if (!item) {
        return null;
      }
      const [tickets, requirements] = await Promise.all([
        wanted.tickets.size ? readTickets(item.folder) : Promise.resolve([]),
        wanted.requirements.size ? readRequirements(item.folder) : Promise.resolve([]),
      ]);
      const matchedTickets = tickets.filter(
        (ticket) =>
          entityMatches(ticket, wanted.tickets) &&
          ticket.events.some((event) => isDateInRange(dateOnly(event.time), range)),
      );
      const matchedRequirements = requirements.filter(
        (requirement) =>
          entityMatches(requirement, wanted.requirements) &&
          requirement.timeline.some((item) => isDateInRange(dateOnly(item.time), range)),
      );

      if (matchedTickets.length === 0 && matchedRequirements.length === 0) {
        return null;
      }

      return {
        folder: item.folder,
        project: item.project,
        tickets: matchedTickets,
        requirements: matchedRequirements,
      };
    }),
  );

  return {
    range,
    projects: reportProjects
      .filter((project): project is ReportProjectContext => Boolean(project))
      .sort((a, b) => a.project.project_name.localeCompare(b.project.project_name)),
  };
}

async function readChangeLog(): Promise<ChangeLogFile> {
  try {
    const raw = await readFile(path.join(getProjectsRoot(), CHANGE_LOG_FILE), "utf8");
    const parsed = JSON.parse(raw) as Partial<ChangeLogFile>;
    return {
      version: 1,
      logs: Array.isArray(parsed.logs) ? parsed.logs.map(normalizeLog) : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: 1, logs: [] };
    }
    throw error;
  }
}

async function readReportPrompt() {
  return readFile(path.join(getProjectsRoot(), REPORT_PROMPT_FILE), "utf8");
}

async function requestQwenReport(prompt: string, context: ReportContext) {
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
      temperature: 0.2,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: JSON.stringify(compactReportContext(context), null, 2) },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Qwen request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const report = data.choices?.[0]?.message?.content?.trim();
  if (!report) {
    throw new Error("Qwen returned an empty report.");
  }
  return report;
}

function compactReportContext(context: ReportContext) {
  return {
    date_range: context.range,
    projects: context.projects.map((project) => ({
      folder: project.folder,
      project: project.project,
      tickets: project.tickets.map((ticket) => ({
        id: ticket.id,
        uuid: ticket.uuid,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        summary: ticket.summary,
        next_action: ticket.next_action,
        events: ticket.events,
        updated_at: ticket.updated_at,
      })),
      requirements: project.requirements.map((requirement) => ({
        id: requirement.id,
        uuid: requirement.uuid,
        title: requirement.title,
        status: requirement.status,
        details: requirement.details,
        timeline: requirement.timeline,
        related_tickets: requirement.related_tickets,
        last_updated: requirement.last_updated,
      })),
    })),
  };
}

function normalizeLog(log: Partial<ChangeLogEntry>): ChangeLogEntry {
  return {
    id: cleanText(log.id),
    time: cleanText(log.time),
    project_id: cleanText(log.project_id),
    country: cleanText(log.country),
    project_name: cleanText(log.project_name),
    entity_type:
      log.entity_type === "ticket" || log.entity_type === "requirement"
        ? log.entity_type
        : log.entity_type === "demand" || log.entity_type === "project"
          ? log.entity_type
          : "project",
    entity_id: cleanText(log.entity_id),
    entity_display_id: cleanText(log.entity_display_id || log.entity_id),
    action: cleanText(log.action) as ChangeLogEntry["action"],
    content: cleanText(log.content),
  };
}

function entityMatches(entity: { id: string; uuid?: string }, ids: Set<string>) {
  return ids.has(entity.id) || Boolean(entity.uuid && ids.has(entity.uuid));
}

function isDateInRange(date: string, range: ReportDateRange) {
  return Boolean(date) && date >= range.startDate && date <= range.endDate;
}

function dateOnly(value: string) {
  const normalized = cleanText(value).replace(" ", "T");
  return normalized.slice(0, 10);
}

function cleanDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : "";
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export class ReportInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportInputError";
  }
}
