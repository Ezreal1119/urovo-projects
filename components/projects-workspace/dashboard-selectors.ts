import type { DashboardData } from "@/lib/types";
import type { DashboardFilter, DashboardRequirement, DashboardTicket } from "./types";
import { requirementStatusLabels } from "./labels";

export function flattenDashboardTickets(
  data: DashboardData | null,
): DashboardTicket[] {
  return (data?.projects ?? []).flatMap((project) =>
    project.tickets.map((ticket) => ({
      folder: project.folder,
      project: project.project,
      ticket,
    })),
  );
}

export function flattenDashboardRequirements(
  data: DashboardData | null,
): DashboardRequirement[] {
  return (data?.projects ?? []).flatMap((project) =>
    project.requirements.map((requirement) => ({
      folder: project.folder,
      project: project.project,
      requirement,
    })),
  );
}

export function filterDashboardTickets(
  tickets: DashboardTicket[],
  filter: DashboardFilter,
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  return tickets.filter((item) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && item.ticket.status !== "resolved") ||
      (filter === "pending_internal" &&
        item.ticket.status === "pending_internal") ||
      (filter === "pending_customer" &&
        item.ticket.status === "pending_customer") ||
      (filter === "urgent" && item.ticket.priority === "urgent") ||
      (filter === "priority_low" && item.ticket.priority === "low") ||
      (filter === "priority_medium" && item.ticket.priority === "medium") ||
      (filter === "priority_high" && item.ticket.priority === "high") ||
      (filter === "resolved" && item.ticket.status === "resolved");

    if (!matchesFilter) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [
      item.project.project_name,
      item.folder,
      item.ticket.id,
      item.ticket.title,
      item.ticket.summary,
      item.ticket.next_action,
      item.ticket.status,
      item.ticket.priority,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
}

export function filterDashboardRequirements(
  requirements: DashboardRequirement[],
  filter: DashboardFilter,
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  return requirements.filter((item) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "active" &&
        ["in_progress", "testing"].includes(item.requirement.status)) ||
      (filter === "pending_internal" &&
        item.requirement.status === "pending") ||
      (filter === "pending_customer" &&
        item.requirement.status === "in_progress") ||
      (filter === "urgent" && item.requirement.status === "testing") ||
      (filter === "resolved" && item.requirement.status === "finished");

    if (!matchesFilter) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [
      item.project.project_name,
      item.folder,
      item.requirement.id,
      item.requirement.title,
      item.requirement.details,
      item.requirement.status,
      requirementStatusLabels[item.requirement.status],
      ...item.requirement.related_tickets,
      ...item.requirement.timeline.map(
        (entry) => `${entry.time} ${entry.remark}`,
      ),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
}

export function dashboardMetrics(tickets: DashboardTicket[]) {
  return {
    total: tickets.length,
    active: tickets.filter((item) => item.ticket.status !== "resolved").length,
    pendingInternal: tickets.filter(
      (item) => item.ticket.status === "pending_internal",
    ).length,
    pendingCustomer: tickets.filter(
      (item) => item.ticket.status === "pending_customer",
    ).length,
    urgent: tickets.filter((item) => item.ticket.priority === "urgent").length,
    resolved: tickets.filter((item) => item.ticket.status === "resolved")
      .length,
  };
}

export function dashboardRequirementMetrics(requirements: DashboardRequirement[]) {
  return {
    total: requirements.length,
    active: requirements.filter((item) =>
      ["in_progress", "testing"].includes(item.requirement.status),
    ).length,
    pending: requirements.filter(
      (item) => item.requirement.status === "pending",
    ).length,
    inProgress: requirements.filter(
      (item) => item.requirement.status === "in_progress",
    ).length,
    testing: requirements.filter(
      (item) => item.requirement.status === "testing",
    ).length,
    finished: requirements.filter(
      (item) => item.requirement.status === "finished",
    ).length,
  };
}
