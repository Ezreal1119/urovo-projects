import { randomUUID } from "crypto";
import { readdir, readFile, rename, stat, writeFile } from "fs/promises";
import path from "path";
import {
  EVENT_ROLES,
  EventInput,
  PRIORITIES,
  PROJECT_PREFIX,
  ProjectInfo,
  ProjectListItem,
  STATUSES,
  Ticket,
  TicketInput,
  TimelineEvent,
} from "./types";

const DEFAULT_PROJECT: ProjectInfo = {
  project_id: "",
  project_name: "",
  country: "",
  customer: "",
  status: "active",
  description: "",
  created_at: "",
  updated_at: "",
};

export function getProjectsRoot() {
  const root = process.env.PROJECTS_ROOT;
  if (!root) {
    throw new Error("PROJECTS_ROOT is not configured.");
  }
  return path.resolve(root);
}

export function assertSafeSegment(segment: string, label: string) {
  if (
    !segment ||
    segment.startsWith(".") ||
    segment.includes("/") ||
    segment.includes("\\") ||
    segment.includes("..")
  ) {
    throw new Error(`Invalid ${label}.`);
  }
}

export function assertProjectFolder(folder: string) {
  assertSafeSegment(folder, "project folder");
  if (!folder.startsWith(PROJECT_PREFIX)) {
    throw new Error("Invalid project folder.");
  }
}

export function projectKeyFromSegments(segments: string[]) {
  if (segments.length !== 2) {
    throw new Error("Project path must be country/project.");
  }
  const [country, folder] = segments;
  assertSafeSegment(country, "country folder");
  assertProjectFolder(folder);
  return `${country}/${folder}`;
}

export function projectDir(key: string) {
  const [country, folder, extra] = key.split("/");
  if (extra) {
    throw new Error("Invalid project path.");
  }
  const normalizedKey = projectKeyFromSegments([country, folder]);
  const root = getProjectsRoot();
  const resolved = path.resolve(root, normalizedKey);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid project path.");
  }
  return resolved;
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

async function writeJsonAtomic(filePath: string, data: unknown) {
  const tempFile = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tempFile, filePath);
}

function sanitizeProject(key: string, project: Partial<ProjectInfo>): ProjectInfo {
  return {
    ...DEFAULT_PROJECT,
    ...project,
    project_id: project.project_id || key,
    project_name: project.project_name || key,
  };
}

export async function listProjects(): Promise<ProjectListItem[]> {
  const root = getProjectsRoot();
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const countries = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const projectKeys = (
    await Promise.all(
      countries.map(async (country) => {
        assertSafeSegment(country, "country folder");
        const countryDir = path.join(root, country);
        const children = await readdir(countryDir, { withFileTypes: true });
        return children
          .filter((entry) => entry.isDirectory() && entry.name.startsWith(PROJECT_PREFIX))
          .map((entry) => `${country}/${entry.name}`);
      }),
    )
  )
    .flat()
    .sort((a, b) => a.localeCompare(b));

  const projects = await Promise.all(
    projectKeys.map(async (key) => {
      const project = await readJson<Partial<ProjectInfo>>(path.join(projectDir(key), "project.json"), {});
      return { folder: key, project: sanitizeProject(key, project) };
    }),
  );

  return projects;
}

export async function readProject(key: string) {
  const dir = projectDir(key);
  const info = await stat(dir);
  if (!info.isDirectory()) {
    throw new Error("Project does not exist.");
  }
  const project = await readJson<Partial<ProjectInfo>>(path.join(dir, "project.json"), {});
  return sanitizeProject(key, project);
}

export async function readTickets(key: string): Promise<Ticket[]> {
  await readProject(key);
  const tickets = await readJson<Ticket[]>(path.join(projectDir(key), "tickets.json"), []);
  return Array.isArray(tickets) ? tickets.map(normalizeTicket).sort(sortTickets) : [];
}

export async function writeTickets(key: string, tickets: Ticket[]) {
  await readProject(key);
  await writeJsonAtomic(path.join(projectDir(key), "tickets.json"), tickets);
}

export function createTicketPayload(input: TicketInput, existing: Ticket[]): Ticket {
  const now = new Date().toISOString();
  return normalizeTicket({
    id: nextTicketId(existing),
    title: cleanText(input.title) || "Untitled ticket",
    status: pickValue(input.status, STATUSES, "pending_internal"),
    priority: pickValue(input.priority, PRIORITIES, "medium"),
    created_at: now,
    updated_at: now,
    summary: cleanText(input.summary),
    next_action: cleanText(input.next_action),
    events: normalizeEvents(input.events),
  });
}

export function updateTicketPayload(existing: Ticket, input: TicketInput): Ticket {
  return normalizeTicket({
    ...existing,
    title: cleanText(input.title) || existing.title,
    status: pickValue(input.status, STATUSES, pickValue(existing.status, STATUSES, "pending_internal")),
    priority: pickValue(input.priority, PRIORITIES, existing.priority),
    summary: cleanText(input.summary),
    next_action: cleanText(input.next_action),
    events: input.events ? normalizeEvents(input.events) : existing.events,
    updated_at: new Date().toISOString(),
  });
}

export function createEventPayload(input: EventInput): TimelineEvent {
  return normalizeEvent({
    time: cleanText(input.time) || new Date().toISOString(),
    role: pickValue(input.role, EVENT_ROLES, "support"),
    content: cleanText(input.content),
  });
}

export function updateEventPayload(existing: TimelineEvent, input: EventInput): TimelineEvent {
  return normalizeEvent({
    time: cleanText(input.time) || existing.time,
    role: pickValue(input.role, EVENT_ROLES, existing.role),
    content: cleanText(input.content),
  });
}

export function sortTickets(a: Ticket, b: Ticket) {
  return b.updated_at.localeCompare(a.updated_at);
}

export function sortEvents(a: TimelineEvent, b: TimelineEvent) {
  return a.time.localeCompare(b.time);
}

function normalizeTicket(ticket: Ticket): Ticket {
  const now = new Date().toISOString();
  return {
    id: cleanText(ticket.id) || "PK-001",
    title: cleanText(ticket.title) || "Untitled ticket",
    status: pickValue(ticket.status, STATUSES, "pending_internal"),
    priority: pickValue(ticket.priority, PRIORITIES, "medium"),
    created_at: cleanText(ticket.created_at) || now,
    updated_at: cleanText(ticket.updated_at) || now,
    summary: cleanText(ticket.summary),
    next_action: cleanText(ticket.next_action),
    events: normalizeEvents(ticket.events),
  };
}

function normalizeEvents(events: unknown): TimelineEvent[] {
  return Array.isArray(events) ? events.map(normalizeEvent).sort(sortEvents) : [];
}

function normalizeEvent(event: Partial<TimelineEvent>): TimelineEvent {
  return {
    time: cleanText(event.time) || new Date().toISOString(),
    role: pickValue(event.role, EVENT_ROLES, "support"),
    content: cleanText(event.content),
  };
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function pickValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function nextTicketId(existing: Ticket[]) {
  const highest = existing.reduce((max, ticket) => {
    const match = ticket.id.match(/^PK-(\d+)$/i);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `PK-${String(highest + 1).padStart(3, "0")}`;
}
