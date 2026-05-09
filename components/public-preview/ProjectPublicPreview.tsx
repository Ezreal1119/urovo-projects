"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type {
  Overview,
  ProjectInfo,
  Requirement,
  RequirementStatus,
  Ticket,
  TicketStatus,
} from "@/lib/types";
import {
  buildProjectSummary,
  copyTextToClipboard,
  downloadSummaryMarkdownAsPng,
  latestRequirementTimelineItem,
  latestTicketEvent,
  projectSummaryPngFilename,
  sortOverviewDemandsForSummary,
  stripBracketMetadata,
} from "@/components/projects-workspace/summary";
import {
  eventRoleLabels,
  priorityLabels,
  requirementStatusLabels,
  statusLabels,
} from "@/components/projects-workspace/labels";
import {
  formatDate,
  formatDateOnly,
  formatDateTimeFull,
} from "@/components/projects-workspace/formatters";
import {
  PriorityBadge,
  RequirementStatusBadge,
  StatusBadge,
} from "@/components/projects-workspace/ui";

type PreviewTab = "overview" | "tickets" | "requirements";
type TicketPreviewFilter =
  | "all"
  | "active"
  | "pending_internal"
  | "pending_customer"
  | "urgent"
  | "resolved";
type RequirementPreviewFilter =
  | "all"
  | "active"
  | "pending"
  | "in_progress"
  | "testing"
  | "finished";

const ticketPreviewFilters: { value: TicketPreviewFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pending_internal", label: "Pending Internal" },
  { value: "pending_customer", label: "Pending Customer" },
  { value: "urgent", label: "Urgent" },
  { value: "resolved", label: "Resolved" },
];

const requirementPreviewFilters: {
  value: RequirementPreviewFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "testing", label: "Testing" },
  { value: "finished", label: "Finished" },
];

export default function ProjectPublicPreview({
  project,
  overview,
  requirements,
  tickets,
}: {
  project: ProjectInfo;
  overview: Overview;
  requirements: Requirement[];
  tickets: Ticket[];
}) {
  const [tab, setTab] = useState<PreviewTab>("overview");
  const [query, setQuery] = useState("");
  const [ticketFilter, setTicketFilter] = useState<TicketPreviewFilter>("all");
  const [requirementFilter, setRequirementFilter] =
    useState<RequirementPreviewFilter>("all");
  const summary = useMemo(
    () => buildProjectSummary(project, overview, requirements, tickets),
    [overview, project, requirements, tickets],
  );
  const filteredDemands = useMemo(
    () => filterPreviewDemands(overview, requirements, query),
    [overview, requirements, query],
  );
  const filteredTickets = useMemo(
    () => filterPreviewTickets(tickets, ticketFilter, query),
    [tickets, ticketFilter, query],
  );
  const filteredRequirements = useMemo(
    () =>
      filterPreviewRequirements(requirements, tickets, requirementFilter, query),
    [requirements, tickets, requirementFilter, query],
  );

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 shadow-sm shadow-slate-200/40 backdrop-blur">
        <div className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-2 lg:px-5">
          <div className="flex min-w-0 items-center gap-3 rounded-xl px-2 py-1.5">
            <Image
              src="/patrick.png"
              alt="Urovo Projects"
              width={44}
              height={44}
              className="h-10 w-10 rounded-xl object-cover ring-1 ring-slate-200"
            />
            <div className="min-w-0">
              <div className="truncate text-base font-semibold tracking-tight text-slate-950">
                Urovo Projects
              </div>
              <div className="truncate text-xs font-medium text-slate-500">
                Public project preview
              </div>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <SummaryActions project={project} summary={summary} />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-5 lg:px-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {project.project_name}
                </h1>
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                  {project.sales || "Unknown"}
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Created at {formatDate(project.created_at)}
              </div>
            </div>
            <TabSwitcher tab={tab} onChange={setTab} />
          </div>
        </section>

        <PreviewFilterBar
          tab={tab}
          query={query}
          ticketFilter={ticketFilter}
          requirementFilter={requirementFilter}
          onQueryChange={setQuery}
          onTicketFilterChange={setTicketFilter}
          onRequirementFilterChange={setRequirementFilter}
        />

        {tab === "overview" ? (
          <OverviewPreview
            overview={overview}
            requirements={requirements}
            demands={filteredDemands}
            totalDemands={overview.requirements.length}
            searching={query.trim().length > 0}
          />
        ) : tab === "tickets" ? (
          <TicketsPreview
            tickets={filteredTickets}
            totalTickets={tickets.length}
            filtering={query.trim().length > 0 || ticketFilter !== "all"}
          />
        ) : (
          <RequirementsPreview
            requirements={filteredRequirements}
            totalRequirements={requirements.length}
            tickets={tickets}
            filtering={query.trim().length > 0 || requirementFilter !== "all"}
          />
        )}
      </div>
    </main>
  );
}

function SummaryActions({
  project,
  summary,
}: {
  project: ProjectInfo;
  summary: string;
}) {
  const [message, setMessage] = useState("");

  async function copySummary() {
    const didCopy = await copyTextToClipboard(summary);
    setMessage(didCopy ? "Copied Markdown." : "Copy failed.");
    window.setTimeout(() => setMessage(""), 1800);
  }

  function downloadPng() {
    const didDownload = downloadSummaryMarkdownAsPng(
      summary,
      projectSummaryPngFilename(project.project_name),
    );
    setMessage(didDownload ? "PNG downloaded." : "PNG download failed.");
    window.setTimeout(() => setMessage(""), 1800);
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => void copySummary()}
        className="h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
      >
        Copy Markdown
      </button>
      <button
        type="button"
        onClick={downloadPng}
        className="h-10 shrink-0 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm shadow-slate-300 transition hover:bg-slate-800"
      >
        Download Summary PNG
      </button>
      <span className="min-w-28 text-sm font-medium text-slate-500">
        {message}
      </span>
    </div>
  );
}

function TabSwitcher({
  tab,
  onChange,
}: {
  tab: PreviewTab;
  onChange: (tab: PreviewTab) => void;
}) {
  return (
    <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
      {(["overview", "tickets", "requirements"] as const).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
            tab === item
              ? "bg-white text-slate-950 shadow-sm"
              : "text-slate-500 hover:text-slate-950"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function PreviewFilterBar({
  tab,
  query,
  ticketFilter,
  requirementFilter,
  onQueryChange,
  onTicketFilterChange,
  onRequirementFilterChange,
}: {
  tab: PreviewTab;
  query: string;
  ticketFilter: TicketPreviewFilter;
  requirementFilter: RequirementPreviewFilter;
  onQueryChange: (query: string) => void;
  onTicketFilterChange: (filter: TicketPreviewFilter) => void;
  onRequirementFilterChange: (filter: RequirementPreviewFilter) => void;
}) {
  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <label className="min-w-64 flex-1">
          <span className="sr-only">Search preview</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm shadow-inner shadow-slate-200/50 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:shadow-sm"
            placeholder={
              tab === "overview"
                ? "Search demands"
                : tab === "tickets"
                  ? "Search tickets"
                  : "Search requirements"
            }
          />
        </label>
        {tab === "tickets" ? (
          <FilterChips
            options={ticketPreviewFilters}
            value={ticketFilter}
            onChange={onTicketFilterChange}
          />
        ) : tab === "requirements" ? (
          <FilterChips
            options={requirementPreviewFilters}
            value={requirementFilter}
            onChange={onRequirementFilterChange}
          />
        ) : null}
      </div>
    </section>
  );
}

function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`h-9 rounded-lg border px-3 text-sm font-medium transition ${
            value === option.value
              ? "border-slate-900 bg-slate-950 text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function OverviewPreview({
  overview,
  requirements,
  demands,
  totalDemands,
  searching,
}: {
  overview: Overview;
  requirements: Requirement[];
  demands: Overview["requirements"];
  totalDemands: number;
  searching: boolean;
}) {
  const requirementMap = new Map(
    requirements.map((requirement) => [requirement.id, requirement]),
  );

  return (
    <div className="mt-5 space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="space-y-3">
          <RelatedLine label="Models" values={overview.models} />
          <RelatedLine label="Services" values={overview.others} />
          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">
              Description
            </div>
            <div className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              {overview.description || "No description."}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Product demands
          </h2>
          <span className="text-xs text-slate-500">
            {visibleCountText(demands.length, totalDemands)}
          </span>
        </div>
        <div className="space-y-3">
          {demands.map((demand) => (
            <article
              key={demand.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-base font-semibold leading-6 text-slate-950">
                  <span className="mr-2 inline-flex rounded-md bg-slate-950 px-2 py-0.5 text-xs font-semibold text-white">
                    {demand.id}
                  </span>
                  {demand.product}
                </h3>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                  {formatDateTimeFull(demand.created_at)}
                </span>
              </div>
              {demand.simple_requirements.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
                  {demand.simple_requirements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  No simple requirements.
                </p>
              )}
              {demand.linked_requirements.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {demand.linked_requirements.map((requirementId) => {
                    const requirement = requirementMap.get(requirementId);
                    return (
                      <div
                        key={requirementId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-slate-700">
                          {requirement
                            ? `[${requirement.id}] ${requirement.title}`
                            : requirementId}
                        </span>
                        {requirement ? (
                          <RequirementStatusBadge
                            status={requirement.status}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {demand.remark ? (
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  {demand.remark}
                </p>
              ) : null}
            </article>
          ))}
          {demands.length === 0 ? (
            <EmptyPreview
              text={
                searching
                  ? "No matching product demands."
                  : "No product demands for this project."
              }
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function RelatedLine({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {values.length > 0 ? (
        values.map((value) => (
          <span
            key={value}
            className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
          >
            {value}
          </span>
        ))
      ) : (
        <span className="text-sm text-slate-400">None</span>
      )}
    </div>
  );
}

function TicketsPreview({
  tickets,
  totalTickets,
  filtering,
}: {
  tickets: Ticket[];
  totalTickets: number;
  filtering: boolean;
}) {
  return (
    <section className="mt-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Tickets</h2>
        <span className="text-xs text-slate-500">
          {visibleCountText(tickets.length, totalTickets)}
        </span>
      </div>
      <div className="space-y-3">
        {tickets.map((ticket) => {
          const latestEvent = latestTicketEvent(ticket.events);
          return (
            <article
              key={ticket.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="line-clamp-2 text-base font-semibold leading-6 text-slate-950">
                  <span className="mr-2 inline-flex rounded-md bg-slate-950 px-2 py-0.5 text-xs font-semibold text-white">
                    {ticket.id}
                  </span>
                  {ticket.title}
                </h3>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                  <StatusBadge status={ticket.status} />
                  <PriorityBadge priority={ticket.priority} />
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {ticket.summary || "No summary."}
              </p>
              {ticket.next_action ? (
                <div className="mt-3 rounded-lg bg-slate-50 p-3">
                  <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                    Next action
                  </div>
                  <p className="mt-1 text-sm text-slate-700">
                    {ticket.next_action}
                  </p>
                </div>
              ) : null}
              {latestEvent ? (
                <ProgressBlock
                  title={`Latest progress (${eventRoleLabels[latestEvent.role]})`}
                  time={latestEvent.time}
                  content={latestEvent.content}
                />
              ) : null}
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>Updated {formatDateTimeFull(ticket.updated_at)}</span>
                <span>{ticket.events.length} events</span>
              </div>
            </article>
          );
        })}
        {tickets.length === 0 ? (
          <EmptyPreview
            text={
              filtering
                ? "No matching tickets."
                : "No tickets for this project."
            }
          />
        ) : null}
      </div>
    </section>
  );
}

function RequirementsPreview({
  requirements,
  totalRequirements,
  tickets,
  filtering,
}: {
  requirements: Requirement[];
  totalRequirements: number;
  tickets: Ticket[];
  filtering: boolean;
}) {
  const ticketMap = new Map(tickets.map((ticket) => [ticket.id, ticket]));

  return (
    <section className="mt-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Requirements</h2>
        <span className="text-xs text-slate-500">
          {visibleCountText(requirements.length, totalRequirements)}
        </span>
      </div>
      <div className="space-y-3">
        {requirements.map((requirement) => {
          const latestTimelineItem = latestRequirementTimelineItem(
            requirement.timeline,
          );
          return (
            <article
              key={requirement.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="line-clamp-2 text-base font-semibold leading-6 text-slate-950">
                  <span className="mr-2 inline-flex rounded-md bg-slate-950 px-2 py-0.5 text-xs font-semibold text-white">
                    {requirement.id}
                  </span>
                  {requirement.title}
                </h3>
                <RequirementStatusBadge status={requirement.status} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {requirement.details || "No details."}
              </p>
              {requirement.related_tickets.length > 0 ? (
                <div className="mt-3 rounded-lg bg-slate-50 p-3">
                  <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                    Related tickets
                  </div>
                  <div className="mt-2 space-y-2">
                    {requirement.related_tickets.map((ticketId) => {
                      const ticket = ticketMap.get(ticketId);
                      return (
                        <div
                          key={ticketId}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm ring-1 ring-slate-200"
                        >
                          <span className="font-medium text-slate-700">
                            {ticket
                              ? `[${ticket.id}] ${ticket.title}`
                              : ticketId}
                          </span>
                          {ticket ? (
                            <span className="text-xs text-slate-500">
                              {statusLabels[ticket.status]} |{" "}
                              {priorityLabels[ticket.priority]}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {latestTimelineItem ? (
                <ProgressBlock
                  title="Latest progress"
                  time={latestTimelineItem.time}
                  content={latestTimelineItem.remark}
                />
              ) : null}
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Updated {formatDateTimeFull(requirement.last_updated)}
                </span>
                <span>{requirement.timeline.length} updates</span>
              </div>
            </article>
          );
        })}
        {requirements.length === 0 ? (
          <EmptyPreview
            text={
              filtering
                ? "No matching requirements."
                : "No requirements for this project."
            }
          />
        ) : null}
      </div>
    </section>
  );
}

function ProgressBlock({
  title,
  time,
  content,
}: {
  title: string;
  time: string;
  content: string;
}) {
  return (
    <div className="mt-3 rounded-lg bg-slate-950 p-4 text-slate-50">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
        {title} - {formatDateOnly(time)}
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
        {content || "-"}
      </p>
    </div>
  );
}

function EmptyPreview({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function filterPreviewDemands(
  overview: Overview,
  requirements: Requirement[],
  query: string,
) {
  const normalizedQuery = normalizeQuery(query);
  const demands = sortOverviewDemandsForSummary(overview.requirements);
  if (!normalizedQuery) {
    return demands;
  }

  const requirementMap = new Map(
    requirements.map((requirement) => [requirement.id, requirement]),
  );

  return demands.filter((demand) => {
    const linkedRequirementText = demand.linked_requirements
      .map((requirementId) => {
        const requirement = requirementMap.get(requirementId);
        return requirement
          ? [
              requirement.id,
              requirement.title,
              stripBracketMetadata(requirement.title),
              requirementStatusLabels[requirement.status],
            ].join(" ")
          : requirementId;
      })
      .join(" ");

    return includesQuery(
      [
        overview.description,
        ...overview.models,
        ...overview.others,
        demand.id,
        demand.product,
        ...demand.simple_requirements,
        linkedRequirementText,
        demand.remark,
      ],
      normalizedQuery,
    );
  });
}

function filterPreviewTickets(
  tickets: Ticket[],
  filter: TicketPreviewFilter,
  query: string,
) {
  const normalizedQuery = normalizeQuery(query);
  return tickets.filter((ticket) => {
    if (!matchesTicketFilter(ticket, filter)) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return includesQuery(
      [
        ticket.id,
        ticket.title,
        stripBracketMetadata(ticket.title),
        statusLabels[ticket.status],
        priorityLabels[ticket.priority],
        ticket.summary,
        ticket.next_action,
        ...ticket.events.map((event) =>
          [
            eventRoleLabels[event.role],
            formatDateOnly(event.time),
            formatDateTimeFull(event.time),
            event.content,
          ].join(" "),
        ),
      ],
      normalizedQuery,
    );
  });
}

function filterPreviewRequirements(
  requirements: Requirement[],
  tickets: Ticket[],
  filter: RequirementPreviewFilter,
  query: string,
) {
  const normalizedQuery = normalizeQuery(query);
  const ticketMap = new Map(tickets.map((ticket) => [ticket.id, ticket]));

  return requirements.filter((requirement) => {
    if (!matchesRequirementFilter(requirement, filter)) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }

    const relatedTicketText = requirement.related_tickets
      .map((ticketId) => {
        const ticket = ticketMap.get(ticketId);
        return ticket
          ? [
              ticket.id,
              ticket.title,
              stripBracketMetadata(ticket.title),
              statusLabels[ticket.status],
              priorityLabels[ticket.priority],
            ].join(" ")
          : ticketId;
      })
      .join(" ");

    return includesQuery(
      [
        requirement.id,
        requirement.title,
        stripBracketMetadata(requirement.title),
        requirementStatusLabels[requirement.status],
        requirement.details,
        relatedTicketText,
        ...requirement.timeline.map((item) =>
          [
            formatDateOnly(item.time),
            formatDateTimeFull(item.time),
            item.remark,
          ].join(" "),
        ),
      ],
      normalizedQuery,
    );
  });
}

function matchesTicketFilter(ticket: Ticket, filter: TicketPreviewFilter) {
  const statusMatchers: Record<
    Exclude<TicketPreviewFilter, "all" | "active" | "urgent">,
    TicketStatus
  > = {
    pending_internal: "pending_internal",
    pending_customer: "pending_customer",
    resolved: "resolved",
  };

  if (filter === "all") {
    return true;
  }
  if (filter === "active") {
    return ticket.status !== "resolved";
  }
  if (filter === "urgent") {
    return ticket.priority === "urgent";
  }
  return ticket.status === statusMatchers[filter];
}

function matchesRequirementFilter(
  requirement: Requirement,
  filter: RequirementPreviewFilter,
) {
  const statusMatchers: Record<
    Exclude<RequirementPreviewFilter, "all" | "active">,
    RequirementStatus
  > = {
    pending: "pending",
    in_progress: "in_progress",
    testing: "testing",
    finished: "finished",
  };

  if (filter === "all") {
    return true;
  }
  if (filter === "active") {
    return requirement.status !== "finished";
  }
  return requirement.status === statusMatchers[filter];
}

function includesQuery(values: string[], normalizedQuery: string) {
  return values.join(" ").toLowerCase().includes(normalizedQuery);
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

function visibleCountText(visible: number, total: number) {
  return visible === total ? `${total} shown` : `${visible} of ${total} shown`;
}
