import type { Requirement, Ticket } from "@/lib/types";
import { RequirementStatusBadge } from "./core";

export function RelatedTicketRows({
  ticketIds,
  tickets,
  onOpenTicket,
}: {
  ticketIds: string[];
  tickets: Ticket[];
  onOpenTicket: (ticketId: string) => void;
}) {
  return (
    <div className="space-y-2">
      {ticketIds.map((ticketId) => {
        const ticket = tickets.find((current) => current.id === ticketId);
        const exists = Boolean(ticket);
        return (
          <button
            key={ticketId}
            type="button"
            disabled={!exists}
            onClick={() => onOpenTicket(ticketId)}
            className={`w-full rounded-lg border px-3 py-2 text-left transition ${
              exists
                ? `${relatedTicketRowStyle(ticket)} hover:border-slate-300`
                : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
            }`}
          >
            <div className="line-clamp-2 text-sm font-semibold">
              [{ticketId}]: {ticket?.title ?? "Ticket not found"}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function LinkedRequirementChips({
  requirementIds,
  requirements,
  onOpenRequirement,
}: {
  requirementIds: string[];
  requirements: Requirement[];
  onOpenRequirement: (requirementId: string) => void;
}) {
  if (requirementIds.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">
        No linked requirements.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {requirementIds.map((requirementId) => {
        const requirement = requirements.find(
          (current) => current.id === requirementId,
        );
        if (!requirement) {
          return (
            <span
              key={requirementId}
              className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-400"
            >
              [{requirementId}]: Requirement not found
            </span>
          );
        }

        return (
          <button
            key={requirementId}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenRequirement(requirementId);
            }}
            className={`w-full rounded-lg border px-3 py-2 text-left transition ${linkedRequirementRowStyle(
              requirement,
            )}`}
            title={requirement.title}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="line-clamp-2 text-sm font-semibold">
                {formatRequirementLabel(requirementId, requirements)}
              </div>
              <RequirementStatusBadge status={requirement.status} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function formatRequirementLabel(
  requirementId: string,
  requirements: Requirement[],
) {
  const requirement = requirements.find(
    (current) => current.id === requirementId,
  );
  return requirement
    ? `[${requirementId}]: ${requirement.title}`
    : requirementId;
}

export function linkedRequirementRowStyle(requirement: Requirement | undefined) {
  if (!requirement) {
    return "border-slate-200 bg-slate-50 text-slate-400";
  }
  if (requirement.status === "pending") {
    return "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 hover:bg-slate-100";
  }
  if (requirement.status === "in_progress") {
    return "border-blue-200 bg-blue-50 text-blue-900 hover:border-blue-300 hover:bg-blue-100";
  }
  if (requirement.status === "testing") {
    return "border-violet-200 bg-violet-50 text-violet-900 hover:border-violet-300 hover:bg-violet-100";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100";
}

export function relatedTicketRowStyle(ticket: Ticket | undefined) {
  if (!ticket) {
    return "border-slate-200 bg-slate-50 text-slate-400";
  }
  if (ticket.priority === "urgent") {
    return "border-red-200 bg-red-50 text-red-900";
  }
  if (ticket.status === "resolved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }
  if (ticket.status === "pending_customer") {
    return "border-sky-200 bg-sky-50 text-sky-900";
  }
  return "border-amber-200 bg-amber-50 text-amber-950";
}
