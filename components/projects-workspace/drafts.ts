import type { Overview, OverviewRequirement, Requirement, RequirementTimelineItem, Ticket, TimelineEvent } from "@/lib/types";
import type { EventDraft, OverviewRequirementDraft, OverviewSettingsDraft, ProjectJsonDraft, RequirementDraft, RequirementTimelineDraft, TicketDraft } from "./types";
import { dateInputValue, todayDate } from "./formatters";

export const emptyTicketDraft: TicketDraft = {
  title: "",
  status: "pending_internal",
  priority: "medium",
  summary: "",
  next_action: "",
};

export const emptyEventDraft: EventDraft = {
  time: todayDate(),
  role: "support",
  content: "",
};

export const emptyRequirementDraft: RequirementDraft = {
  title: "",
  status: "in_progress",
  details: "",
  related_tickets: [],
};

export const emptyRequirementTimelineDraft: RequirementTimelineDraft = {
  time: todayDate(),
  remark: "",
};

export const emptyOverview: Overview = {
  models: [],
  others: [],
  description: "",
  requirements: [],
};

export const emptyOverviewRequirementDraft: OverviewRequirementDraft = {
  product: "",
  simple_requirements: [],
  linked_requirements: [],
  remark: "",
};

export const emptyProjectJsonDraft: ProjectJsonDraft = {
  project_name: "",
  country: "",
  customer: "",
  sales: "",
  created_at: todayDate(),
};

export function ticketToDraft(ticket: Ticket): TicketDraft {
  return {
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    summary: ticket.summary,
    next_action: ticket.next_action,
  };
}

export function ticketDraftsEqual(
  left: TicketDraft,
  right: TicketDraft,
  includeNextAction: boolean,
) {
  return (
    left.title === right.title &&
    left.status === right.status &&
    left.priority === right.priority &&
    left.summary === right.summary &&
    (!includeNextAction || left.next_action === right.next_action)
  );
}

export function requirementToDraft(requirement: Requirement): RequirementDraft {
  return {
    title: requirement.title,
    status: requirement.status,
    details: requirement.details,
    related_tickets: requirement.related_tickets,
  };
}

export function requirementDraftForApi(draft: RequirementDraft) {
  return {
    title: draft.title,
    status: draft.status,
    details: draft.details,
    related_tickets: draft.related_tickets,
  };
}

export function requirementDraftsEqual(
  left: RequirementDraft,
  right: RequirementDraft,
) {
  return (
    left.title === right.title &&
    left.status === right.status &&
    left.details === right.details &&
    left.related_tickets.join("\n") === right.related_tickets.join("\n")
  );
}

export function requirementTimelineToDraft(
  item: RequirementTimelineItem,
): RequirementTimelineDraft {
  return {
    time: dateInputValue(item.time),
    remark: item.remark,
  };
}

export function requirementTimelineDraftForApi(
  draft: RequirementTimelineDraft,
): RequirementTimelineDraft {
  return {
    ...draft,
    time: draft.time.includes("T") ? draft.time : `${draft.time}T00:00:00`,
  };
}

export function overviewToSettingsDraft(overview: Overview): OverviewSettingsDraft {
  return {
    models: overview.models,
    others: overview.others,
    description: overview.description,
  };
}

export function overviewSettingsKey(overview: Overview) {
  return JSON.stringify({
    models: overview.models,
    others: overview.others,
    description: overview.description,
  });
}

export function overviewRequirementToDraft(
  requirement: OverviewRequirement,
): OverviewRequirementDraft {
  return {
    product: requirement.product,
    simple_requirements: requirement.simple_requirements,
    linked_requirements: requirement.linked_requirements,
    remark: requirement.remark,
  };
}

export function overviewRequirementDraftForApi(
  draft: OverviewRequirementDraft,
): OverviewRequirementDraft {
  return {
    product: draft.product,
    simple_requirements: draft.simple_requirements,
    linked_requirements: draft.linked_requirements,
    remark: draft.remark,
  };
}

export function overviewRequirementDraftsEqual(
  left: OverviewRequirementDraft,
  right: OverviewRequirementDraft,
) {
  return (
    left.product === right.product &&
    left.simple_requirements.join("\n") ===
      right.simple_requirements.join("\n") &&
    left.linked_requirements.join("\n") ===
      right.linked_requirements.join("\n") &&
    left.remark === right.remark
  );
}

export function projectJsonDraftsEqual(
  left: ProjectJsonDraft,
  right: ProjectJsonDraft,
) {
  return (
    left.project_name === right.project_name &&
    left.country === right.country &&
    left.customer === right.customer &&
    left.sales === right.sales &&
    left.created_at === right.created_at
  );
}

export function eventToDraft(event: TimelineEvent): EventDraft {
  return {
    time: dateInputValue(event.time),
    role: event.role,
    content: event.content,
  };
}

export function eventDraftForApi(draft: EventDraft): EventDraft {
  return {
    ...draft,
    time: draft.time.includes("T") ? draft.time : `${draft.time}T00:00:00`,
  };
}
