import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Requirement, RequirementStatus, RequirementTimelineItem, Ticket } from "@/lib/types";
import { REQUIREMENT_STATUSES } from "@/lib/types";
import type { RequirementDraft, RequirementTimelineDraft } from "../types";
import { TICKETS_PER_PAGE } from "../constants";
import { requirementStatusLabels } from "../labels";
import { requirementDraftsEqual, requirementTimelineToDraft, requirementToDraft, emptyRequirementDraft, emptyRequirementTimelineDraft } from "../drafts";
import { formatDateOnly, formatDateTimeFull } from "../formatters";
import { AssetManager } from "../assets/AssetManager";
import { ReferenceManager } from "../references/ReferenceManager";
import { Field, Overlay, Pagination, PriorityBadge, RelatedTicketRows, RequirementStatusBadge } from "../ui";

export function RequirementsWorkspace({
  requirements,
  totalRequirements,
  page,
  totalPages,
  selectedRequirementId,
  onSelect,
  onPreviousPage,
  onNextPage,
}: {
  requirements: Requirement[];
  totalRequirements: number;
  page: number;
  totalPages: number;
  selectedRequirementId: string;
  onSelect: (requirementId: string) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Requirements</h2>
        <span className="text-xs text-slate-500">
          {totalRequirements === 0
            ? "0 shown"
            : `${(page - 1) * TICKETS_PER_PAGE + 1}-${Math.min(
                page * TICKETS_PER_PAGE,
                totalRequirements,
              )} of ${totalRequirements} shown`}
        </span>
      </div>
      <div className="space-y-3">
        {requirements.map((requirement) => (
          <RequirementCard
            key={requirement.id}
            requirement={requirement}
            active={requirement.id === selectedRequirementId}
            onClick={() => onSelect(requirement.id)}
          />
        ))}
      </div>
      {totalRequirements === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center">
          <div className="text-sm font-medium text-slate-900">
            No requirements yet
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Create a requirement to track customer asks for this project.
          </p>
        </div>
      ) : null}
      {totalRequirements > TICKETS_PER_PAGE ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPrevious={onPreviousPage}
          onNext={onNextPage}
        />
      ) : null}
    </section>
  );
}

export function RequirementCard({
  requirement,
  active,
  onClick,
}: {
  requirement: Requirement;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`w-full cursor-pointer rounded-lg border bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md ${
        active ? "border-slate-400 ring-2 ring-slate-200" : "border-slate-200"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-base font-semibold leading-6 text-slate-950">
            <span className="mr-2 inline-flex rounded-md bg-slate-950 px-2 py-0.5 text-xs font-semibold text-white">
              {requirement.id}
            </span>
            <span>{requirement.title}</span>
          </h3>
        </div>
        <RequirementStatusBadge status={requirement.status} />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>Updated {formatDateTimeFull(requirement.last_updated)}</span>
        <span>{requirement.timeline.length} updates</span>
      </div>
    </div>
  );
}

export function RequirementModal({
  saving,
  onClose,
  onCreate,
}: {
  saving: boolean;
  onClose: () => void;
  onCreate: (draft: RequirementDraft) => void | Promise<void>;
}) {
  const [dirty, setDirty] = useState(false);

  function closeModal() {
    if (dirty && !confirm("Discard this new requirement draft?")) {
      return;
    }
    onClose();
  }

  return (
    <Overlay>
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Requirement</h2>
          <button
            onClick={closeModal}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>
        <RequirementForm
          initial={emptyRequirementDraft}
          tickets={[]}
          saving={saving}
          submitLabel="Create requirement"
          onDirtyChange={setDirty}
          onSubmit={onCreate}
        />
      </div>
    </Overlay>
  );
}

export function RequirementDrawer({
  requirement,
  assetApiPath,
  browseApiPath,
  referenceApiPath,
  tickets,
  saving,
  onClose,
  onDirtyChange,
  onSave,
  onDelete,
  onOpenTicket,
  onAddTimeline,
  onUpdateTimeline,
  onDeleteTimeline,
}: {
  requirement: Requirement;
  assetApiPath: string;
  browseApiPath: string;
  referenceApiPath: string;
  tickets: Ticket[];
  saving: boolean;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (draft: RequirementDraft) => Promise<void>;
  onDelete: () => void;
  onOpenTicket: (ticketId: string) => void;
  onAddTimeline: (draft: RequirementTimelineDraft) => void;
  onUpdateTimeline: (index: number, draft: RequirementTimelineDraft) => void;
  onDeleteTimeline: (index: number) => void;
}) {
  const formId = "requirement-detail-form";
  const [addingTimeline, setAddingTimeline] = useState(false);

  useEffect(() => {
    onDirtyChange(false);
  }, [onDirtyChange, requirement.id]);

  async function saveRequirement(draft: RequirementDraft) {
    await onSave(draft);
    onDirtyChange(false);
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-slate-950/20">
      <aside className="flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white p-5">
          <div>
            <div className="text-xs font-medium text-slate-500">
              {requirement.id}
            </div>
            <h2 className="mt-1 text-xl font-semibold">{requirement.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="submit"
              form={formId}
              disabled={saving}
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-6 p-5">
          <RequirementForm
            key={requirement.id}
            formId={formId}
            initial={requirementToDraft(requirement)}
            tickets={tickets}
            saving={saving}
            submitLabel="Save"
            showSubmitButton={false}
            onDirtyChange={onDirtyChange}
            onRelatedTicketsChange={saveRequirement}
            onSubmit={saveRequirement}
          />
          <ReferenceManager
            key={`requirement-references-${requirement.id}`}
            browseApiPath={browseApiPath}
            referenceApiPath={referenceApiPath}
            initialCount={requirement.references.length}
          />
          <AssetManager assetApiPath={assetApiPath} />

          {requirement.related_tickets.length > 0 ? (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Related tickets</h3>
              <RelatedTicketRows
                ticketIds={requirement.related_tickets}
                tickets={tickets}
                onOpenTicket={onOpenTicket}
              />
            </section>
          ) : null}

          <div className="flex justify-end">
            <button
              onClick={onDelete}
              disabled={saving}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Delete requirement
            </button>
          </div>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Timeline</h3>
              <span className="text-xs text-slate-500">Chronological</span>
            </div>
            <div className="space-y-3">
              {requirement.timeline.map((item, index) => (
                <RequirementTimelineItemView
                  key={`${item.time}-${index}`}
                  item={item}
                  index={index}
                  saving={saving}
                  onUpdate={(draft) => onUpdateTimeline(index, draft)}
                  onDelete={() => {
                    if (
                      confirm(
                        "Delete this requirement timeline update? This writes directly to requirements.json.",
                      )
                    ) {
                      onDeleteTimeline(index);
                    }
                  }}
                />
              ))}
            </div>
            {requirement.timeline.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                No requirement updates yet.
              </div>
            ) : null}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setAddingTimeline(true)}
                disabled={saving}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950 disabled:opacity-60"
              >
                Add
              </button>
            </div>
          </section>

          {addingTimeline ? (
            <RequirementTimelineDialog
              saving={saving}
              onClose={() => setAddingTimeline(false)}
              onSubmit={(draft) => {
                onAddTimeline(draft);
                setAddingTimeline(false);
              }}
            />
          ) : null}
        </div>
      </aside>
    </div>
  );
}

export function RequirementTimelineDialog({
  saving,
  onClose,
  onSubmit,
}: {
  saving: boolean;
  onClose: () => void;
  onSubmit: (draft: RequirementTimelineDraft) => void;
}) {
  return (
    <Overlay>
      <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Add timeline update</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>
        <RequirementTimelineForm
          saving={saving}
          submitLabel="Add update"
          onSubmit={onSubmit}
        />
      </div>
    </Overlay>
  );
}

export function RequirementForm({
  initial,
  tickets,
  saving,
  submitLabel,
  formId,
  showSubmitButton = true,
  onDirtyChange,
  onRelatedTicketsChange,
  onSubmit,
}: {
  initial: RequirementDraft;
  tickets: Ticket[];
  saving: boolean;
  submitLabel: string;
  formId?: string;
  showSubmitButton?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onRelatedTicketsChange?: (draft: RequirementDraft) => Promise<void>;
  onSubmit: (draft: RequirementDraft) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<RequirementDraft>(initial);
  const [baseline, setBaseline] = useState<RequirementDraft>(initial);
  const [ticketPickerOpen, setTicketPickerOpen] = useState(false);
  const [ticketDeleteMode, setTicketDeleteMode] = useState(false);
  const [ticketQuery, setTicketQuery] = useState("");

  const selectableTickets = tickets.filter((ticket) => {
    const query = ticketQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return [
      ticket.id,
      ticket.title,
      ticket.summary,
      ticket.status,
      ticket.priority,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  function updateDraft(nextDraft: RequirementDraft) {
    setDraft(nextDraft);
    onDirtyChange?.(!requirementDraftsEqual(nextDraft, baseline));
  }

  async function saveRelatedTickets(nextDraft: RequirementDraft) {
    updateDraft(nextDraft);
    if (!onRelatedTicketsChange) {
      return;
    }
    await onRelatedTicketsChange(nextDraft);
    setBaseline(nextDraft);
    onDirtyChange?.(false);
  }

  async function addRelatedTicket(ticketId: string) {
    if (draft.related_tickets.includes(ticketId)) {
      return;
    }
    await saveRelatedTickets({
      ...draft,
      related_tickets: [...draft.related_tickets, ticketId],
    });
  }

  async function removeRelatedTicket(ticketId: string) {
    await saveRelatedTickets({
      ...draft,
      related_tickets: draft.related_tickets.filter(
        (current) => current !== ticketId,
      ),
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(draft);
    setBaseline(draft);
    onDirtyChange?.(false);
  }

  return (
    <form id={formId} onSubmit={submit} className="space-y-4">
      <Field label="Title">
        <input
          required
          value={draft.title}
          onChange={(event) =>
            updateDraft({ ...draft, title: event.target.value })
          }
          className="form-input"
          placeholder="[Model]Short customer requirement"
        />
      </Field>
      <Field label="Status">
        <select
          value={draft.status}
          onChange={(event) =>
            updateDraft({
              ...draft,
              status: event.target.value as RequirementStatus,
            })
          }
          className="form-input"
        >
          {REQUIREMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {requirementStatusLabels[status]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Details">
        <textarea
          value={draft.details}
          onChange={(event) =>
            updateDraft({ ...draft, details: event.target.value })
          }
          className="form-input min-h-28 resize-y"
          placeholder="Requirement context, customer expectation, constraints, or certification notes"
        />
      </Field>
      <div>
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="block text-xs font-medium text-slate-600">
            Related tickets
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTicketPickerOpen(true)}
              disabled={saving}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setTicketDeleteMode((current) => !current)}
              disabled={draft.related_tickets.length === 0}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              {ticketDeleteMode ? "Cancel" : "Delete"}
            </button>
          </div>
        </div>
        {draft.related_tickets.length > 0 ? (
          <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
            {draft.related_tickets.map((ticketId) => (
              <span
                key={ticketId}
                className={`relative inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 ${
                  ticketDeleteMode ? "pr-5" : ""
                }`}
              >
                {ticketId}
                {ticketDeleteMode ? (
                  <button
                    type="button"
                    onClick={() => void removeRelatedTicket(ticketId)}
                    disabled={saving}
                    className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[10px] font-semibold leading-none text-white hover:bg-red-700"
                    aria-label={`Remove ${ticketId}`}
                  >
                    x
                  </button>
                ) : null}
              </span>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">
            No related tickets selected.
          </div>
        )}
      </div>
      {ticketPickerOpen ? (
        <Overlay>
          <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add related ticket</h3>
              <button
                type="button"
                onClick={() => setTicketPickerOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
              >
                Close
              </button>
            </div>
            <input
              value={ticketQuery}
              onChange={(event) => setTicketQuery(event.target.value)}
              className="mb-3 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
              placeholder="Search by ticket ID, title, status, or priority"
            />
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {selectableTickets.map((ticket) => {
                const selected = draft.related_tickets.includes(ticket.id);
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => {
                      void addRelatedTicket(ticket.id);
                      setTicketPickerOpen(false);
                      setTicketQuery("");
                    }}
                    disabled={selected || saving}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selected
                        ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          [{ticket.id}] {ticket.title}
                        </div>
                        <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                          {ticket.summary ||
                            ticket.next_action ||
                            "No summary."}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {selected ? (
                          <span className="rounded-md bg-slate-200 px-2 py-1 text-xs font-medium">
                            Selected
                          </span>
                        ) : (
                          <PriorityBadge priority={ticket.priority} />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              {selectableTickets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  No tickets match this search.
                </div>
              ) : null}
            </div>
          </div>
        </Overlay>
      ) : null}
      {showSubmitButton ? (
        <button
          disabled={saving}
          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? "Saving..." : submitLabel}
        </button>
      ) : null}
    </form>
  );
}

export function RequirementTimelineItemView({
  item,
  index,
  saving,
  onUpdate,
  onDelete,
}: {
  item: RequirementTimelineItem;
  index: number;
  saving: boolean;
  onUpdate: (draft: RequirementTimelineDraft) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-slate-500">
            {formatDateOnly(item.time)}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {item.remark || "-"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => setEditing(!editing)}
            className="rounded-md px-2 py-1 text-xs hover:bg-slate-100"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>
      {editing ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <RequirementTimelineForm
            key={`${item.time}-${index}`}
            initial={requirementTimelineToDraft(item)}
            saving={saving}
            submitLabel="Save update"
            onSubmit={(draft) => {
              onUpdate(draft);
              setEditing(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function RequirementTimelineForm({
  initial = emptyRequirementTimelineDraft,
  saving,
  submitLabel,
  onSubmit,
}: {
  initial?: RequirementTimelineDraft;
  saving: boolean;
  submitLabel: string;
  onSubmit: (draft: RequirementTimelineDraft) => void;
}) {
  const [draft, setDraft] = useState<RequirementTimelineDraft>(initial);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(draft);
    if (!initial.remark) {
      setDraft(emptyRequirementTimelineDraft);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Time">
        <input
          type="date"
          value={draft.time}
          onChange={(event) => setDraft({ ...draft, time: event.target.value })}
          className="form-input"
        />
      </Field>
      <Field label="Remark">
        <textarea
          required
          value={draft.remark}
          onChange={(event) =>
            setDraft({ ...draft, remark: event.target.value })
          }
          className="form-input min-h-20 resize-y"
          placeholder="Progress update or customer feedback"
        />
      </Field>
      <button
        disabled={saving}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
      >
        {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
