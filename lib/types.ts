export const PROJECT_PREFIX = "proj_";

export const STATUSES = [
  "pending_internal",
  "pending_customer",
  "resolved",
] as const;

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const EVENT_ROLES = ["customer", "support", "internal", "sales", "others"] as const;
export const REQUIREMENT_STATUSES = ["pending", "in_progress", "testing", "finished"] as const;
export const GENERAL_OVERVIEW_PRODUCT = "General";

export type TicketStatus = (typeof STATUSES)[number];
export type TicketPriority = (typeof PRIORITIES)[number];
export type EventRole = (typeof EVENT_ROLES)[number];
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export type ProjectInfo = {
  project_id: string;
  project_name: string;
  country: string;
  customer: string;
  sales: string;
  created_at: string;
};

export type ProjectListItem = {
  folder: string;
  project: ProjectInfo;
};

export type DashboardProject = ProjectListItem & {
  tickets: Ticket[];
  requirements: Requirement[];
};

export type DashboardData = {
  projects: DashboardProject[];
};

export type TimelineEvent = {
  uuid?: string;
  time: string;
  role: EventRole;
  content: string;
};

export type LocalFileReference = {
  id: string;
  path: string;
  name: string;
  size?: number;
  modified_at?: string;
  added_at: string;
};

export type Ticket = {
  id: string;
  uuid?: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
  summary: string;
  next_action: string;
  events: TimelineEvent[];
  references: LocalFileReference[];
};

export type TicketInput = Partial<Omit<Ticket, "id" | "uuid" | "created_at" | "updated_at">>;
export type EventInput = Partial<TimelineEvent>;

export type RequirementTimelineItem = {
  uuid?: string;
  time: string;
  remark: string;
};

export type Requirement = {
  id: string;
  uuid?: string;
  title: string;
  status: RequirementStatus;
  details: string;
  timeline: RequirementTimelineItem[];
  related_tickets: string[];
  references: LocalFileReference[];
  created_at: string;
  last_updated: string;
};

export type RequirementInput = Partial<Omit<Requirement, "id" | "uuid" | "created_at" | "last_updated">>;
export type RequirementTimelineInput = Partial<RequirementTimelineItem>;

export type OverviewRequirement = {
  id: string;
  uuid?: string;
  product: string;
  simple_requirements: string[];
  linked_requirements: string[];
  remark: string;
  created_at: string;
};

export type Overview = {
  models: string[];
  others: string[];
  description: string;
  requirements: OverviewRequirement[];
};

export type OverviewInput = Partial<Omit<Overview, "requirements">>;
export type OverviewRequirementInput = Partial<Omit<OverviewRequirement, "id" | "uuid" | "created_at">>;

export type ReleaseFirmware = {
  os: string;
  ufs: string;
  se: string;
};

export type ReleaseRecord = {
  id: string;
  model: string;
  firmware: ReleaseFirmware;
  change_log: string;
  release_date: string | null;
  order_count: number | null;
  order_time: string;
  created_at: string;
  updated_at: string;
};

export type ReleaseRecordInput = Partial<
  Omit<ReleaseRecord, "id" | "created_at" | "updated_at">
>;

export type ReleaseRecordFile = {
  version: 1;
  records: ReleaseRecord[];
};

export type ReleaseNoteRow = {
  folder: string;
  country: string;
  customer: string;
  model: string;
  change_log: string;
};

export type TicketEventSummary = {
  uuid: string;
  title: string;
  message: string;
  related_event_uuids: string[];
};

export type TicketEventSummaryTicket = {
  ticket_uuid: string;
  ticket_id: string;
  last_polished_at: string;
  summaries: TicketEventSummary[];
};

export type TicketEventSummariesFile = {
  version: 1;
  last_polished_at: string;
  tickets: TicketEventSummaryTicket[];
};

export type ChangeLogEntityType = "demand" | "ticket" | "requirement" | "project";

export type ChangeLogAction =
  | "demand_created"
  | "demand_updated"
  | "demand_deleted"
  | "demand_linked_requirement_added"
  | "demand_linked_requirement_removed"
  | "ticket_created"
  | "ticket_updated"
  | "ticket_deleted"
  | "ticket_event_added"
  | "ticket_event_updated"
  | "ticket_event_deleted"
  | "requirement_created"
  | "requirement_updated"
  | "requirement_deleted"
  | "requirement_linked_ticket_added"
  | "requirement_linked_ticket_removed"
  | "requirement_timeline_added"
  | "requirement_timeline_updated"
  | "requirement_timeline_deleted";

export type ChangeLogEntry = {
  id: string;
  time: string;
  project_id: string;
  country: string;
  project_name: string;
  entity_type: ChangeLogEntityType;
  entity_id: string;
  entity_display_id: string;
  action: ChangeLogAction;
  content: string;
};

export type ChangeLogFile = {
  version: 1;
  logs: ChangeLogEntry[];
};
