import { randomUUID } from "crypto";
import { readdir, readFile, rename, stat, writeFile } from "fs/promises";
import path from "path";
import {
  EVENT_ROLES,
  EventInput,
  GENERAL_OVERVIEW_PRODUCT,
  DashboardData,
  LocalFileReference,
  Overview,
  OverviewInput,
  OverviewRequirement,
  OverviewRequirementInput,
  PRIORITIES,
  PROJECT_PREFIX,
  ProjectInfo,
  ProjectListItem,
  Requirement,
  RequirementInput,
  REQUIREMENT_STATUSES,
  RequirementTimelineInput,
  RequirementTimelineItem,
  STATUSES,
  Ticket,
  TicketInput,
  TimelineEvent,
} from "./types";
import { beijingNowIsoString } from "./time";

const DEFAULT_PROJECT: ProjectInfo = {
  project_id: "",
  project_name: "",
  country: "",
  customer: "",
  sales: "Unknown",
  created_at: "",
};

const EMPTY_OVERVIEW: Overview = {
  models: [],
  others: [],
  description: "",
  requirements: [],
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
    sales: project.sales || "Unknown",
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

export async function readDashboard(): Promise<DashboardData> {
  const projects = await listProjects();
  return {
    projects: await Promise.all(
      projects.map(async (item) => ({
        ...item,
        tickets: await readTickets(item.folder),
        requirements: await readRequirements(item.folder),
      })),
    ),
  };
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

export async function readRequirements(key: string): Promise<Requirement[]> {
  await readProject(key);
  const requirements = await readJson<Requirement[]>(path.join(projectDir(key), "requirements.json"), []);
  return Array.isArray(requirements) ? requirements.map(normalizeRequirement).sort(sortRequirements) : [];
}

export async function writeRequirements(key: string, requirements: Requirement[]) {
  await readProject(key);
  await writeJsonAtomic(path.join(projectDir(key), "requirements.json"), requirements);
}

export async function readOverview(key: string): Promise<Overview> {
  await readProject(key);
  const overview = await readJson<Partial<Overview>>(path.join(projectDir(key), "overview.json"), EMPTY_OVERVIEW);
  return normalizeOverview(overview);
}

export async function writeOverview(key: string, overview: Overview) {
  await readProject(key);
  await writeJsonAtomic(path.join(projectDir(key), "overview.json"), normalizeOverview(overview));
}

export function updateOverviewPayload(existing: Overview, input: OverviewInput): Overview {
  const nextModels = input.models === undefined ? existing.models : normalizeTextList(input.models);
  const nextOthers = input.others === undefined ? existing.others : normalizeTextList(input.others);
  const removedProducts = [...existing.models, ...existing.others].filter(
    (product) => !nextModels.includes(product) && !nextOthers.includes(product),
  );
  const usedRemovedProduct = removedProducts.find((product) =>
    existing.requirements.some((requirement) => requirement.product === product),
  );

  if (usedRemovedProduct) {
    throw new Error(`${usedRemovedProduct} is used by overview requirements and cannot be removed.`);
  }

  return normalizeOverview({
    ...existing,
    models: nextModels,
    others: nextOthers,
    description: input.description === undefined ? existing.description : cleanText(input.description),
  });
}

export function createOverviewRequirementPayload(
  input: OverviewRequirementInput,
  existing: Overview,
): OverviewRequirement {
  return normalizeOverviewRequirement(
    {
      id: nextOverviewRequirementId(existing.requirements),
      uuid: randomUUID(),
      product: cleanText(input.product),
      simple_requirements: normalizeTextList(input.simple_requirements),
      linked_requirements: normalizeRequirementLinks(input.linked_requirements),
      remark: cleanText(input.remark),
      created_at: beijingNowIsoString(),
    },
    overviewProducts(existing),
  );
}

export function updateOverviewRequirementPayload(
  existingRequirement: OverviewRequirement,
  input: OverviewRequirementInput,
  overview: Overview,
): OverviewRequirement {
  return normalizeOverviewRequirement(
    {
      ...existingRequirement,
      product: input.product === undefined ? existingRequirement.product : cleanText(input.product),
      simple_requirements:
        input.simple_requirements === undefined
          ? existingRequirement.simple_requirements
          : normalizeTextList(input.simple_requirements),
      linked_requirements:
        input.linked_requirements === undefined
          ? existingRequirement.linked_requirements
          : normalizeRequirementLinks(input.linked_requirements),
      remark: input.remark === undefined ? existingRequirement.remark : cleanText(input.remark),
    },
    overviewProducts(overview),
  );
}

export function createRequirementPayload(input: RequirementInput, existing: Requirement[]): Requirement {
  const now = beijingNowIsoString();
  return normalizeRequirement({
    id: nextRequirementId(existing),
    uuid: randomUUID(),
    title: cleanText(input.title) || "Untitled requirement",
    status: pickValue(input.status, REQUIREMENT_STATUSES, "in_progress"),
    details: cleanText(input.details),
    timeline: normalizeRequirementTimeline(input.timeline),
    related_tickets: normalizeRelatedTickets(input.related_tickets),
    references: normalizeLocalFileReferences(input.references),
    created_at: now,
    last_updated: now,
  });
}

export function updateRequirementPayload(existing: Requirement, input: RequirementInput): Requirement {
  return normalizeRequirement({
    ...existing,
    title: input.title === undefined ? existing.title : cleanText(input.title) || existing.title,
    status:
      input.status === undefined
        ? pickValue(existing.status, REQUIREMENT_STATUSES, "in_progress")
        : pickValue(input.status, REQUIREMENT_STATUSES, pickValue(existing.status, REQUIREMENT_STATUSES, "in_progress")),
    details: input.details === undefined ? existing.details : cleanText(input.details),
    timeline: input.timeline ? normalizeRequirementTimeline(input.timeline) : existing.timeline,
    related_tickets: input.related_tickets ? normalizeRelatedTickets(input.related_tickets) : existing.related_tickets,
    references:
      input.references === undefined
        ? existing.references
        : normalizeLocalFileReferences(input.references),
    last_updated: beijingNowIsoString(),
  });
}

export function createRequirementTimelinePayload(input: RequirementTimelineInput): RequirementTimelineItem {
  return normalizeRequirementTimelineItem({
    time: cleanText(input.time) || beijingNowIsoString(),
    remark: cleanText(input.remark),
  });
}

export function updateRequirementTimelinePayload(
  existing: RequirementTimelineItem,
  input: RequirementTimelineInput,
): RequirementTimelineItem {
  return normalizeRequirementTimelineItem({
    time: cleanText(input.time) || existing.time,
    remark: cleanText(input.remark),
  });
}

export function createTicketPayload(input: TicketInput, existing: Ticket[], projectName: string): Ticket {
  const now = beijingNowIsoString();
  return normalizeTicket({
    id: nextTicketId(existing, projectName),
    uuid: randomUUID(),
    title: cleanText(input.title) || "Untitled ticket",
    status: pickValue(input.status, STATUSES, "pending_internal"),
    priority: pickValue(input.priority, PRIORITIES, "medium"),
    created_at: now,
    updated_at: now,
    summary: cleanText(input.summary),
    next_action: cleanText(input.next_action),
    events: normalizeEvents(input.events),
    references: normalizeLocalFileReferences(input.references),
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
    references:
      input.references === undefined
        ? existing.references
        : normalizeLocalFileReferences(input.references),
    updated_at: beijingNowIsoString(),
  });
}

export function createEventPayload(input: EventInput): TimelineEvent {
  return normalizeEvent({
    time: cleanText(input.time) || beijingNowIsoString(),
    role: pickValue(input.role, EVENT_ROLES, "others"),
    content: cleanText(input.content),
  });
}

export function updateEventPayload(existing: TimelineEvent, input: EventInput): TimelineEvent {
  return normalizeEvent({
    time: cleanText(input.time) || existing.time,
    role: pickValue(input.role, EVENT_ROLES, pickValue(existing.role, EVENT_ROLES, "others")),
    content: cleanText(input.content),
  });
}

export function sortTickets(a: Ticket, b: Ticket) {
  return b.updated_at.localeCompare(a.updated_at);
}

export function sortEvents(a: TimelineEvent, b: TimelineEvent) {
  return a.time.localeCompare(b.time);
}

export function sortRequirements(a: Requirement, b: Requirement) {
  return b.last_updated.localeCompare(a.last_updated);
}

export function sortRequirementTimeline(a: RequirementTimelineItem, b: RequirementTimelineItem) {
  return a.time.localeCompare(b.time);
}

function normalizeTicket(ticket: Ticket): Ticket {
  const now = beijingNowIsoString();
  return {
    id: cleanText(ticket.id) || "PK-001",
    uuid: cleanText(ticket.uuid) || undefined,
    title: cleanText(ticket.title) || "Untitled ticket",
    status: pickValue(ticket.status, STATUSES, "pending_internal"),
    priority: pickValue(ticket.priority, PRIORITIES, "medium"),
    created_at: cleanText(ticket.created_at) || now,
    updated_at: cleanText(ticket.updated_at) || now,
    summary: cleanText(ticket.summary),
    next_action: cleanText(ticket.next_action),
    events: normalizeEvents(ticket.events),
    references: normalizeLocalFileReferences(ticket.references),
  };
}

function normalizeEvents(events: unknown): TimelineEvent[] {
  return Array.isArray(events) ? events.map(normalizeEvent).sort(sortEvents) : [];
}

function normalizeEvent(event: Partial<TimelineEvent>): TimelineEvent {
  return {
    time: cleanText(event.time) || beijingNowIsoString(),
    role: pickValue(event.role, EVENT_ROLES, "others"),
    content: cleanText(event.content),
  };
}

function normalizeRequirement(requirement: Partial<Requirement>): Requirement {
  const now = beijingNowIsoString();
  return {
    id: cleanText(requirement.id) || "REQ-001",
    uuid: cleanText(requirement.uuid) || undefined,
    title: cleanText(requirement.title) || "Untitled requirement",
    status: pickValue(requirement.status, REQUIREMENT_STATUSES, "in_progress"),
    details: cleanText(requirement.details),
    timeline: normalizeRequirementTimeline(requirement.timeline),
    related_tickets: normalizeRelatedTickets(requirement.related_tickets),
    references: normalizeLocalFileReferences(requirement.references),
    created_at: cleanText(requirement.created_at) || now,
    last_updated: cleanText(requirement.last_updated) || now,
  };
}

function normalizeOverview(overview: Partial<Overview>): Overview {
  const models = normalizeTextList(overview.models);
  const others = normalizeTextList(overview.others);
  const products = overviewProducts({ models, others, description: "", requirements: [] });

  return {
    models,
    others,
    description: cleanText(overview.description),
    requirements: Array.isArray(overview.requirements)
      ? overview.requirements.map((requirement) => normalizeOverviewRequirement(requirement, products))
      : [],
  };
}

function normalizeOverviewRequirement(
  requirement: Partial<OverviewRequirement>,
  products: string[],
): OverviewRequirement {
  const product = cleanText(requirement.product);
  if (!product) {
    throw new Error("Overview requirement product is required.");
  }
  if (!products.includes(product)) {
    throw new Error(`${product} is not listed in overview models or services.`);
  }

  return {
    id: cleanText(requirement.id) || "DEM-001",
    uuid: cleanText(requirement.uuid) || undefined,
    product,
    simple_requirements: normalizeTextList(requirement.simple_requirements),
    linked_requirements: normalizeRequirementLinks(requirement.linked_requirements),
    remark: cleanText(requirement.remark),
    created_at: cleanText(requirement.created_at) || beijingNowIsoString(),
  };
}

function normalizeRequirementTimeline(timeline: unknown): RequirementTimelineItem[] {
  return Array.isArray(timeline) ? timeline.map(normalizeRequirementTimelineItem).sort(sortRequirementTimeline) : [];
}

function normalizeRequirementTimelineItem(item: Partial<RequirementTimelineItem>): RequirementTimelineItem {
  return {
    time: cleanText(item.time) || beijingNowIsoString(),
    remark: cleanText(item.remark),
  };
}

function normalizeRelatedTickets(relatedTickets: unknown): string[] {
  return Array.isArray(relatedTickets)
    ? Array.from(new Set(relatedTickets.map(cleanText).filter(Boolean)))
    : [];
}

function normalizeLocalFileReferences(references: unknown): LocalFileReference[] {
  if (!Array.isArray(references)) {
    return [];
  }

  const seen = new Set<string>();
  return references.reduce<LocalFileReference[]>((nextReferences, reference) => {
    if (!reference || typeof reference !== "object") {
      return nextReferences;
    }

    const current = reference as Partial<LocalFileReference>;
    const referencePath = cleanText(current.path);
    if (!referencePath || seen.has(referencePath)) {
      return nextReferences;
    }
    seen.add(referencePath);

    nextReferences.push({
      id: cleanText(current.id) || randomUUID(),
      path: referencePath,
      name: cleanText(current.name) || path.basename(referencePath),
      size: typeof current.size === "number" && Number.isFinite(current.size) ? current.size : undefined,
      modified_at: cleanText(current.modified_at) || undefined,
      added_at: cleanText(current.added_at) || beijingNowIsoString(),
    });
    return nextReferences;
  }, []);
}

function normalizeRequirementLinks(requirements: unknown): string[] {
  return normalizeTextList(requirements);
}

function normalizeTextList(values: unknown): string[] {
  return Array.isArray(values) ? Array.from(new Set(values.map(cleanText).filter(Boolean))) : [];
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function pickValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function nextTicketId(existing: Ticket[], projectName: string) {
  const prefix = ticketPrefix(projectName);
  const matcher = new RegExp(`^${prefix}-(\\d+)$`, "i");
  const highest = existing.reduce((max, ticket) => {
    const match = ticket.id.match(matcher);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
}

function nextRequirementId(existing: Requirement[]) {
  const highest = existing.reduce((max, requirement) => {
    const match = requirement.id.match(/^REQ-(\d+)$/i);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `REQ-${String(highest + 1).padStart(3, "0")}`;
}

function nextOverviewRequirementId(existing: OverviewRequirement[]) {
  const highest = existing.reduce((max, requirement) => {
    const match = requirement.id.match(/^(?:DEM|OVR)-(\d+)$/i);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `DEM-${String(highest + 1).padStart(3, "0")}`;
}

function overviewProducts(overview: Overview) {
  return Array.from(new Set([GENERAL_OVERVIEW_PRODUCT, ...overview.models, ...overview.others]));
}

function ticketPrefix(projectName: string) {
  const letters = projectName.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase();
  return letters.padEnd(2, "X");
}
