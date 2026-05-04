import type { EventRole, RequirementStatus, TicketPriority, TicketStatus } from "@/lib/types";
import type { DashboardMode, ProjectMode, DashboardFilter } from "./types";

export const statusLabels: Record<TicketStatus, string> = {
  pending_internal: "[Pending]: Internal",
  pending_customer: "[Pending]: Customer",
  resolved: "[Resolved]",
};

export const priorityLabels: Record<TicketPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const requirementStatusLabels: Record<RequirementStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  testing: "Testing",
  finished: "Finished",
};

export const eventRoleLabels: Record<EventRole, string> = {
  customer: "Customer",
  support: "Support",
  internal: "Internal",
  sales: "Sales",
  others: "Others",
};

export const eventRoleStyles: Record<EventRole, string> = {
  customer: "bg-sky-50 text-sky-700 ring-sky-200",
  support: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  internal: "bg-violet-50 text-violet-700 ring-violet-200",
  sales: "bg-amber-50 text-amber-800 ring-amber-200",
  others: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function projectModeLabel(mode: ProjectMode) {
  const labels: Record<ProjectMode, string> = {
    overview: "Overview",
    tickets: "Tickets",
    requirements: "Requirements",
  };
  return labels[mode];
}

export function dashboardModeLabel(mode: DashboardMode) {
  const labels: Record<DashboardMode, string> = {
    tickets: "Tickets",
    requirements: "Requirements",
  };
  return labels[mode];
}

export function dashboardFilterLabel(
  filter: DashboardFilter,
  mode: DashboardMode = "tickets",
) {
  if (mode === "requirements") {
    const labels: Record<DashboardFilter, string> = {
      all: "All",
      active: "Active",
      pending_internal: "Pending",
      pending_customer: "In progress",
      urgent: "Testing",
      priority_low: "Low priority",
      priority_medium: "Medium priority",
      priority_high: "High priority",
      resolved: "Finished",
    };
    return labels[filter];
  }
  const labels: Record<DashboardFilter, string> = {
    all: "All",
    active: "Active",
    pending_internal: "Pending internal",
    pending_customer: "Pending customer",
    urgent: "Urgent",
    priority_low: "Low priority",
    priority_medium: "Medium priority",
    priority_high: "High priority",
    resolved: "Resolved",
  };
  return labels[filter];
}
