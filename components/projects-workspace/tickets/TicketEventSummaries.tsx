import { useState } from "react";
import type {
  Ticket,
  TicketEventSummariesFile,
  TicketEventSummary,
  TicketEventSummaryTicket,
  TimelineEvent,
} from "@/lib/types";
import { eventRoleLabels, eventRoleStyles } from "../labels";
import { formatDateOnly, formatDateTimeFull } from "../formatters";
import { Overlay, PriorityBadge, StatusBadge } from "../ui";

type DisplaySummary = {
  summary: TicketEventSummary;
  events: TimelineEvent[];
};

export function ticketEventSummaryForTicket(
  summaries: TicketEventSummariesFile,
  ticket: Ticket,
) {
  return summaries.tickets.find(
    (item) =>
      (ticket.uuid && item.ticket_uuid === ticket.uuid) ||
      item.ticket_id === ticket.id,
  );
}

export function hasDisplayableTicketEventSummaries(
  ticket: Ticket,
  summaryTicket: TicketEventSummaryTicket | undefined,
) {
  return displaySummaries(ticket, summaryTicket).length > 0;
}

export function TicketEventSummaryCard({
  ticket,
  summaryTicket,
  active = false,
  polishing = false,
  isEditingNextAction = false,
  nextActionDraft = "",
  onClick,
  onPolish,
  onStartNextActionEdit,
  onNextActionDraftChange,
  onSaveNextAction,
  showEmptySummaries = false,
}: {
  ticket: Ticket;
  summaryTicket: TicketEventSummaryTicket | undefined;
  active?: boolean;
  polishing?: boolean;
  isEditingNextAction?: boolean;
  nextActionDraft?: string;
  onClick?: () => void;
  onPolish?: () => void;
  onStartNextActionEdit?: () => void;
  onNextActionDraftChange?: (value: string) => void;
  onSaveNextAction?: () => void;
  showEmptySummaries?: boolean;
}) {
  const summaries = displaySummaries(ticket, summaryTicket);
  const [showSummaries, setShowSummaries] = useState(false);
  if (summaries.length === 0 && !onPolish && !showEmptySummaries) {
    return null;
  }

  return (
    <>
      <article
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={(event) => {
          if (!onClick || (event.key !== "Enter" && event.key !== " ")) {
            return;
          }
          event.preventDefault();
          onClick();
        }}
        className={`w-full rounded-lg border bg-white p-4 text-left shadow-sm transition ${
          onClick ? "cursor-pointer hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md" : ""
        } ${active ? "border-slate-400 ring-2 ring-slate-200" : "border-slate-200"}`}
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

        <div
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            setShowSummaries(true);
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key !== "Enter" && event.key !== " ") {
              return;
            }
            event.preventDefault();
            setShowSummaries(true);
          }}
          className="mt-4 w-full rounded-lg bg-slate-50 p-3 text-left transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="line-clamp-1 text-sm font-semibold text-slate-950">
                Event Summary
              </div>
              <div className="mt-1 text-sm text-slate-700">
                {summaries.length} summaries from {ticket.events.length} raw{" "}
                {ticket.events.length === 1 ? "event" : "events"}
              </div>
            </div>
            <span className="shrink-0 text-xs font-medium text-slate-500">
              Open
            </span>
          </div>
        </div>

        {ticket.next_action || onStartNextActionEdit ? (
          <div
            className={`mt-4 rounded-lg bg-slate-50 p-3 ${
              onStartNextActionEdit && !isEditingNextAction
                ? "cursor-pointer hover:bg-slate-100"
                : ""
            }`}
            onClick={(event) => {
              event.stopPropagation();
              if (!onStartNextActionEdit || !onSaveNextAction) {
                return;
              }
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
            <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
              Next action
            </div>
            {isEditingNextAction && onNextActionDraftChange ? (
              <div className="mt-2">
                <textarea
                  value={nextActionDraft}
                  onChange={(event) =>
                    onNextActionDraftChange(event.target.value)
                  }
                  onClick={(event) => event.stopPropagation()}
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
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            Updated {formatDateTimeFull(ticket.updated_at)}
            {summaryTicket?.last_polished_at ? (
              <> | AI polished {formatDateTimeFull(summaryTicket.last_polished_at)}</>
            ) : null}
          </span>
          <span>{ticket.events.length} events</span>
        </div>
      </article>

      {showSummaries ? (
        <EventSummaryDialog
          ticket={ticket}
          summaries={summaries}
          polishing={polishing}
          onPolish={onPolish}
          onClose={() => setShowSummaries(false)}
        />
      ) : null}
    </>
  );
}

function EventSummaryDialog({
  ticket,
  summaries,
  polishing,
  onPolish,
  onClose,
}: {
  ticket: Ticket;
  summaries: DisplaySummary[];
  polishing?: boolean;
  onPolish?: () => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filteredSummaries = filterSummaries(summaries, search);

  return (
    <Overlay>
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-500">
              {ticket.id}
            </div>
            <h2 className="mt-1 line-clamp-2 text-lg font-semibold text-slate-950">
              {ticket.title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onPolish ? (
              <button
                type="button"
                onClick={onPolish}
                disabled={polishing}
                className="rounded-lg bg-slate-950 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {polishing ? "Polishing..." : "AI Polish"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
            >
              Close
            </button>
          </div>
        </div>
        <div className="overflow-y-auto p-5">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search event summaries"
            className="mb-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
          <div className="space-y-3">
            {filteredSummaries.map(({ summary, events }) => (
              <section
                key={summary.uuid}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="text-sm font-semibold text-slate-950">
                  {summaryTitle(summary)}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {summary.message}
                </p>
                <details className="mt-3 rounded-md border border-slate-200 bg-white">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-600">
                    {events.length} related raw{" "}
                    {events.length === 1 ? "event" : "events"}
                  </summary>
                  <div className="space-y-2 border-t border-slate-100 p-3">
                    {events.map((event) => (
                      <RawEventRow
                        key={event.uuid || `${event.time}-${event.content}`}
                        event={event}
                      />
                    ))}
                  </div>
                </details>
              </section>
            ))}
            {filteredSummaries.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                {summaries.length === 0
                  ? "No event summaries yet."
                  : "No event summaries match the search."}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function RawEventRow({ event }: { event: TimelineEvent }) {
  return (
    <div className="rounded-md border border-slate-100 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-md px-2 py-1 text-xs font-medium ring-1 ${eventRoleStyles[event.role]}`}
        >
          {eventRoleLabels[event.role]}
        </span>
        <span className="text-xs text-slate-500">
          {formatDateOnly(event.time)}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">
        {event.content || "-"}
      </p>
    </div>
  );
}

function displaySummaries(
  ticket: Ticket,
  summaryTicket: TicketEventSummaryTicket | undefined,
): DisplaySummary[] {
  if (!summaryTicket) {
    return [];
  }

  const eventByUuid = new Map(
    ticket.events
      .filter((event) => event.uuid)
      .map((event) => [event.uuid as string, event]),
  );

  return summaryTicket.summaries
    .map((summary) => ({
      summary,
      events: summary.related_event_uuids
        .map((eventUuid) => eventByUuid.get(eventUuid))
        .filter((event): event is TimelineEvent => Boolean(event))
        .sort(sortEventsByTime),
    }))
    .filter((item) => item.events.length > 0)
    .sort(sortDisplaySummaries);
}

function sortDisplaySummaries(a: DisplaySummary, b: DisplaySummary) {
  const latest = eventTime(b.events.at(-1)).localeCompare(eventTime(a.events.at(-1)));
  if (latest !== 0) {
    return latest;
  }

  const earliest = eventTime(b.events[0]).localeCompare(eventTime(a.events[0]));
  if (earliest !== 0) {
    return earliest;
  }

  return a.summary.uuid.localeCompare(b.summary.uuid);
}

function sortEventsByTime(a: TimelineEvent, b: TimelineEvent) {
  return a.time.localeCompare(b.time);
}

function eventTime(event: TimelineEvent | undefined) {
  return event?.time ?? "";
}

function summaryTitle(summary: TicketEventSummary) {
  return summary.title || fallbackTitle(summary.message);
}

function fallbackTitle(message: string) {
  const words = message
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
  return words.join(" ") || "Summary";
}

function filterSummaries(summaries: DisplaySummary[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) {
    return summaries;
  }

  return summaries.filter(({ summary, events }) => {
    const content = [
      summaryTitle(summary),
      summary.message,
      ...events.flatMap((event) => [
        eventRoleLabels[event.role],
        formatDateOnly(event.time),
        event.content,
      ]),
    ]
      .join(" ")
      .toLowerCase();
    return content.includes(query);
  });
}
