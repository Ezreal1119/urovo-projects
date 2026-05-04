import { useEffect, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import type { EventRole, Ticket, TicketPriority, TicketStatus, TimelineEvent } from "@/lib/types";
import { EVENT_ROLES, PRIORITIES, STATUSES } from "@/lib/types";
import type { EventDraft, TicketDraft } from "../types";
import { emptyEventDraft, emptyTicketDraft, eventToDraft, ticketDraftsEqual, ticketToDraft } from "../drafts";
import { eventRoleLabels, eventRoleStyles, priorityLabels, statusLabels } from "../labels";
import { formatDateOnly, formatDateTimeFull } from "../formatters";
import { AssetManager } from "../assets/AssetManager";
import { ReferenceManager } from "../references/ReferenceManager";
import { Field, Overlay, PriorityBadge, StatusBadge } from "../ui";

export function TicketCard({
  ticket,
  active,
  onClick,
  isEditingNextAction,
  nextActionDraft,
  onStartNextActionEdit,
  onNextActionDraftChange,
  onSaveNextAction,
}: {
  ticket: Ticket;
  active: boolean;
  onClick: () => void;
  isEditingNextAction: boolean;
  nextActionDraft: string;
  onStartNextActionEdit: () => void;
  onNextActionDraftChange: (value: string) => void;
  onSaveNextAction: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`w-full cursor-pointer rounded-lg border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md ${
        active ? "border-slate-400 ring-2 ring-slate-200" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-base font-semibold leading-6 text-slate-950">
            <span className="mr-2 inline-flex rounded-md bg-slate-950 px-2 py-0.5 text-xs font-semibold text-white">
              {ticket.id}
            </span>
            <span>{ticket.title}</span>
          </h3>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </div>
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
        {ticket.summary || "No summary."}
      </p>
      <div
        className={`mt-4 rounded-lg bg-slate-50 p-3 ${isEditingNextAction ? "" : "cursor-pointer hover:bg-slate-100"}`}
        onClick={(event) => {
          event.stopPropagation();
          if (isEditingNextAction) {
            const target = event.target as HTMLElement;
            if (target.tagName !== "TEXTAREA") {
              onSaveNextAction();
            }
          } else {
            onStartNextActionEdit();
          }
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
            Next action
          </div>
        </div>
        {isEditingNextAction ? (
          <div className="mt-2">
            <textarea
              value={nextActionDraft}
              onChange={(event) => onNextActionDraftChange(event.target.value)}
              className="form-input min-h-20 resize-y"
              placeholder="Owner, expected response, or next technical step"
            />
          </div>
        ) : (
          <p className="mt-1 line-clamp-2 text-sm text-slate-700">
            {ticket.next_action || "No next action."}
          </p>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>Updated {formatDateTimeFull(ticket.updated_at)}</span>
        <span>{ticket.events.length} events</span>
      </div>
    </div>
  );
}

export function TicketModal({
  saving,
  onClose,
  onCreate,
}: {
  saving: boolean;
  onClose: () => void;
  onCreate: (draft: TicketDraft) => void | Promise<void>;
}) {
  const [dirty, setDirty] = useState(false);

  function closeModal() {
    if (dirty && !confirm("Discard this new ticket draft?")) {
      return;
    }
    onClose();
  }

  return (
    <Overlay>
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Ticket</h2>
          <button
            onClick={closeModal}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>
        <TicketForm
          initial={emptyTicketDraft}
          saving={saving}
          submitLabel="Create ticket"
          preventEnterSubmit
          onDirtyChange={setDirty}
          onSubmit={onCreate}
        />
      </div>
    </Overlay>
  );
}

export function TicketDrawer({
  ticket,
  assetApiPath,
  browseApiPath,
  referenceApiPath,
  saving,
  onClose,
  onDirtyChange,
  onSave,
  onDelete,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
}: {
  ticket: Ticket;
  assetApiPath: string;
  browseApiPath: string;
  referenceApiPath: string;
  saving: boolean;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (draft: TicketDraft) => Promise<void>;
  onDelete: () => void;
  onAddEvent: (draft: EventDraft) => void;
  onUpdateEvent: (index: number, draft: EventDraft) => void;
  onDeleteEvent: (index: number) => void;
}) {
  const formId = "ticket-detail-form";
  const [addingEvent, setAddingEvent] = useState(false);

  useEffect(() => {
    onDirtyChange(false);
  }, [onDirtyChange, ticket.id]);

  async function saveTicket(draft: TicketDraft) {
    await onSave(draft);
    onDirtyChange(false);
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-slate-950/20">
      <aside className="flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white p-5">
          <div>
            <div className="text-xs font-medium text-slate-500">
              {ticket.id}
            </div>
            <h2 className="mt-1 text-xl font-semibold">{ticket.title}</h2>
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
          <TicketForm
            key={ticket.id}
            formId={formId}
            initial={ticketToDraft(ticket)}
            saving={saving}
            submitLabel="Save"
            showNextAction={false}
            showSubmitButton={false}
            onDirtyChange={onDirtyChange}
            onSubmit={saveTicket}
          />
          <ReferenceManager
            key={`ticket-references-${ticket.id}`}
            browseApiPath={browseApiPath}
            referenceApiPath={referenceApiPath}
            initialCount={ticket.references.length}
          />
          <AssetManager assetApiPath={assetApiPath} />
          <div className="flex justify-end">
            <button
              onClick={onDelete}
              disabled={saving}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Delete ticket
            </button>
          </div>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Timeline</h3>
              <span className="text-xs text-slate-500">Chronological</span>
            </div>
            <div className="space-y-3">
              {ticket.events.map((event, index) => (
                <TimelineItem
                  key={`${event.time}-${index}`}
                  event={event}
                  index={index}
                  saving={saving}
                  onUpdate={(draft) => onUpdateEvent(index, draft)}
                  onDelete={() => {
                    if (
                      confirm(
                        "Delete this timeline event? This writes directly to tickets.json.",
                      )
                    ) {
                      onDeleteEvent(index);
                    }
                  }}
                />
              ))}
            </div>
            {ticket.events.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                No timeline events yet.
              </div>
            ) : null}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setAddingEvent(true)}
                disabled={saving}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950 disabled:opacity-60"
              >
                Add
              </button>
            </div>
          </section>

          {addingEvent ? (
            <TimelineEventDialog
              saving={saving}
              onClose={() => setAddingEvent(false)}
              onSubmit={(draft) => {
                onAddEvent(draft);
                setAddingEvent(false);
              }}
            />
          ) : null}
        </div>
      </aside>
    </div>
  );
}

export function TimelineEventDialog({
  saving,
  onClose,
  onSubmit,
}: {
  saving: boolean;
  onClose: () => void;
  onSubmit: (draft: EventDraft) => void;
}) {
  return (
    <Overlay>
      <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Add timeline event</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>
        <EventForm saving={saving} submitLabel="Add event" onSubmit={onSubmit} />
      </div>
    </Overlay>
  );
}

export function TimelineItem({
  event,
  index,
  saving,
  onUpdate,
  onDelete,
}: {
  event: TimelineEvent;
  index: number;
  saving: boolean;
  onUpdate: (draft: EventDraft) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="relative rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-md px-2 py-1 text-xs font-medium ring-1 ${eventRoleStyles[event.role]}`}
            >
              {eventRoleLabels[event.role]}
            </span>
            <span className="text-xs text-slate-500">
              {formatDateOnly(event.time)}
            </span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {event.content || "-"}
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
          <EventForm
            key={`${event.time}-${event.role}-${index}`}
            initial={eventToDraft(event)}
            saving={saving}
            submitLabel="Save event"
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

export function EventForm({
  initial = emptyEventDraft,
  saving,
  submitLabel,
  onSubmit,
}: {
  initial?: EventDraft;
  saving: boolean;
  submitLabel: string;
  onSubmit: (draft: EventDraft) => void;
}) {
  const [draft, setDraft] = useState<EventDraft>(initial);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(draft);
    if (!initial.content) {
      setDraft(emptyEventDraft);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Time">
          <input
            type="date"
            value={draft.time}
            onChange={(event) =>
              setDraft({ ...draft, time: event.target.value })
            }
            className="form-input"
          />
        </Field>
        <Field label="Role">
          <select
            value={draft.role}
            onChange={(event) =>
              setDraft({ ...draft, role: event.target.value as EventRole })
            }
            className="form-input"
          >
            {EVENT_ROLES.map((role) => (
              <option key={role} value={role}>
                {eventRoleLabels[role]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Content">
        <textarea
          required
          value={draft.content}
          onChange={(event) =>
            setDraft({ ...draft, content: event.target.value })
          }
          className="form-input min-h-20 resize-y"
          placeholder="Add the customer update, support response, or internal note"
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

export function TicketForm({
  initial,
  saving,
  submitLabel,
  formId,
  showNextAction = true,
  preventEnterSubmit = false,
  showSubmitButton = true,
  onDirtyChange,
  onSubmit,
}: {
  initial: TicketDraft;
  saving: boolean;
  submitLabel: string;
  formId?: string;
  showNextAction?: boolean;
  preventEnterSubmit?: boolean;
  showSubmitButton?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (draft: TicketDraft) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<TicketDraft>(initial);
  const [baseline, setBaseline] = useState<TicketDraft>(initial);

  function updateDraft(nextDraft: TicketDraft) {
    setDraft(nextDraft);
    onDirtyChange?.(!ticketDraftsEqual(nextDraft, baseline, showNextAction));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(draft);
    setBaseline(draft);
    onDirtyChange?.(false);
  }

  function preventKeyboardSubmit(event: KeyboardEvent<HTMLFormElement>) {
    if (!preventEnterSubmit || event.key !== "Enter") {
      return;
    }
    if (event.target instanceof HTMLTextAreaElement) {
      return;
    }
    event.preventDefault();
  }

  return (
    <form
      id={formId}
      onSubmit={submit}
      onKeyDown={preventKeyboardSubmit}
      className="space-y-4"
    >
      <Field label="Title">
        <input
          required
          value={draft.title}
          onChange={(event) =>
            updateDraft({ ...draft, title: event.target.value })
          }
          className="form-input"
          placeholder="[Model]Describe the issue"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Status">
          <select
            value={draft.status}
            onChange={(event) =>
              updateDraft({
                ...draft,
                status: event.target.value as TicketStatus,
              })
            }
            className="form-input"
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select
            value={draft.priority}
            onChange={(event) =>
              updateDraft({
                ...draft,
                priority: event.target.value as TicketPriority,
              })
            }
            className="form-input"
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priorityLabels[priority]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Summary">
        <textarea
          value={draft.summary}
          onChange={(event) =>
            updateDraft({ ...draft, summary: event.target.value })
          }
          className="form-input min-h-28 resize-y"
          placeholder="Current issue context and investigation notes"
        />
      </Field>
      {showNextAction ? (
        <Field label="Next action">
          <textarea
            value={draft.next_action}
            onChange={(event) =>
              updateDraft({ ...draft, next_action: event.target.value })
            }
            className="form-input min-h-20 resize-y"
            placeholder="Owner, expected response, or next technical step"
          />
        </Field>
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
