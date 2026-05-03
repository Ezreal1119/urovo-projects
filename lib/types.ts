export const PROJECT_PREFIX = "proj_";

export const STATUSES = [
  "pending_internal",
  "pending_customer",
  "resolved",
] as const;

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const EVENT_ROLES = ["customer", "support", "internal", "sales", "others"] as const;
export const REQUIREMENT_STATUSES = ["pending", "in_progress", "testing", "finished"] as const;

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

export type RequirementTimelineItem = {
  time: string;
  remark: string;
};

export type Requirement = {
  id: string;
  title: string;
  status: RequirementStatus;
  details: string;
  timeline: RequirementTimelineItem[];
  related_tickets: string[];
  created_at: string;
  last_updated: string;
};

export type RequirementInput = Partial<Omit<Requirement, "id" | "created_at" | "last_updated">>;
export type RequirementTimelineInput = Partial<RequirementTimelineItem>;

export type OverviewRequirement = {
  id: string;
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
export type OverviewRequirementInput = Partial<Omit<OverviewRequirement, "id" | "created_at">>;
