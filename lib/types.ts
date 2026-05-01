export const PROJECT_PREFIX = "proj_";

export const STATUSES = [
  "in_progress",
  "pending_customer",
  "pending_internal",
  "resolved",
  "closed",
] as const;

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const EVENT_ROLES = ["customer", "support", "internal", "system"] as const;

export type TicketStatus = (typeof STATUSES)[number];
export type TicketPriority = (typeof PRIORITIES)[number];
export type EventRole = (typeof EVENT_ROLES)[number];

export type ProjectInfo = {
  project_id: string;
  project_name: string;
  country: string;
  customer: string;
  status: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type ProjectListItem = {
  folder: string;
  project: ProjectInfo;
};

export type TimelineEvent = {
  time: string;
  role: EventRole;
  content: string;
};

export type Ticket = {
  id: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
  summary: string;
  next_action: string;
  events: TimelineEvent[];
};

export type TicketInput = Partial<Omit<Ticket, "id" | "created_at" | "updated_at">>;
export type EventInput = Partial<TimelineEvent>;
