import type {
  OverviewRequirement,
  ProjectInfo,
  ProjectListItem,
  Requirement,
  Ticket,
  EventRole,
  RequirementStatus,
  TicketPriority,
  TicketStatus,
} from "@/lib/types";

export type TicketDraft = {
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  summary: string;
  next_action: string;
};

export type EventDraft = {
  time: string;
  role: EventRole;
  content: string;
};

export type RequirementDraft = {
  title: string;
  status: RequirementStatus;
  details: string;
  related_tickets: string[];
};

export type RequirementTimelineDraft = {
  time: string;
  remark: string;
};

export type OverviewSettingsDraft = {
  models: string[];
  others: string[];
  description: string;
};

export type OverviewRequirementDraft = {
  product: string;
  simple_requirements: string[];
  linked_requirements: string[];
  remark: string;
};

export type ProjectGroup = {
  country: string;
  projects: ProjectListItem[];
};

export type ViewMode = "dashboard" | "project";

export type ProjectMode = "overview" | "tickets" | "requirements";

export type DashboardMode = "tickets" | "requirements";

export type TicketFilter = "all" | "active" | "pending_internal" | "urgent";

export type DashboardFilter =
  | "all"
  | "active"
  | "pending_internal"
  | "pending_customer"
  | "urgent"
  | "priority_low"
  | "priority_medium"
  | "priority_high"
  | "resolved";

export type DashboardTicket = {
  folder: string;
  project: ProjectInfo;
  ticket: Ticket;
};

export type DashboardRequirement = {
  folder: string;
  project: ProjectInfo;
  requirement: Requirement;
};

export type LinkedRequirementSummary = Pick<Requirement, "id" | "title">;

export type TicketDeleteBlocker = {
  ticketId: string;
  requirements: LinkedRequirementSummary[];
};

export type LinkedOverviewRequirementSummary = Pick<
  OverviewRequirement,
  "id" | "product" | "remark"
>;

export type RequirementDeleteBlocker = {
  requirementId: string;
  overviewRequirements: LinkedOverviewRequirementSummary[];
};

export type RecentProject = {
  folder: string;
  projectName: string;
  viewedAt: string;
};

export type ProjectJsonDraft = {
  project_name: string;
  country: string;
  customer: string;
  sales: string;
  created_at: string;
};

export type ProjectAsset = {
  publicId: string;
  resourceType: "image" | "video" | "raw";
  type: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  createdAt: string;
  secureUrl: string;
  downloadUrl: string;
  previewUrl?: string;
  originalFilename: string;
};

export type ProjectReference = {
  id: string;
  path: string;
  name: string;
  size?: number;
  modified_at?: string;
  added_at: string;
  exists: boolean;
  url: string;
};

export type ReferenceBrowseEntry = {
  name: string;
  path: string;
  kind: "directory" | "file";
  size?: number;
  modified_at?: string;
};

export type ReportGenerateDraft = {
  startDate: string;
  endDate: string;
};

export type ReportGenerateResponse =
  | {
      status: "no_data";
      ticketCount: 0;
      requirementCount: 0;
    }
  | {
      status: "sent";
      report: string;
      ticketCount: number;
      requirementCount: number;
    };
