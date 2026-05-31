"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type {
  Overview,
  ProjectInfo,
  ReleaseRecord,
  Requirement,
  RequirementStatus,
  Ticket,
  TicketEventSummariesFile,
  TicketEventSummary,
  TicketEventSummaryTicket,
  TicketPriority,
  TicketStatus,
  TimelineEvent,
} from "@/lib/types";
import {
  sortOverviewDemandsForSummary,
  stripBracketMetadata,
} from "@/components/projects-workspace/summary";
import {
  eventRoleLabels,
  eventRoleStyles,
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
  ticketEventSummaryForTicket,
} from "@/components/projects-workspace/tickets/TicketEventSummaries";

type PreviewTab = "overview" | "release" | "tickets" | "requirements";
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

type DisplaySummary = {
  summary: TicketEventSummary;
  events: TimelineEvent[];
};

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

const previewTabs: { value: PreviewTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "release", label: "Release" },
  { value: "tickets", label: "Tickets" },
  { value: "requirements", label: "Requirements" },
];

export default function ProjectPublicPreview({
  project,
  overview,
  requirements,
  tickets,
  releaseRecords,
  ticketEventSummaries,
}: {
  project: ProjectInfo;
  overview: Overview;
  requirements: Requirement[];
  tickets: Ticket[];
  releaseRecords: ReleaseRecord[];
  ticketEventSummaries: TicketEventSummariesFile;
}) {
  const [tab, setTab] = useState<PreviewTab>("overview");
  const [query, setQuery] = useState("");
  const [ticketFilter, setTicketFilter] = useState<TicketPreviewFilter>("all");
  const [requirementFilter, setRequirementFilter] =
    useState<RequirementPreviewFilter>("all");
  const filteredDemands = useMemo(
    () => filterPreviewDemands(overview, requirements, query),
    [overview, requirements, query],
  );
  const filteredReleaseRecords = useMemo(
    () => filterPreviewReleaseRecords(releaseRecords, query),
    [releaseRecords, query],
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
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#edf7f6_44%,#f7f7fb_100%)] text-slate-950">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/75 shadow-sm shadow-slate-200/70 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 lg:px-6">
          <BrandLockup />
          <TabSwitcher tab={tab} onChange={setTab} />
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-5 lg:px-6">
        <section className="overflow-hidden rounded-lg border border-white/80 bg-white/90 shadow-xl shadow-slate-200/70 ring-1 ring-slate-900/[0.03]">
          <div className="grid gap-0 border-b border-slate-200/70 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_42%,#dff7f3_100%)] lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="px-5 py-6 lg:px-6">
              <div className="flex min-w-0 items-start gap-4">
                <Image
                  src="/patrick.png"
                  alt="Urovo Projects"
                  width={76}
                  height={76}
                  className="h-16 w-16 shrink-0 rounded-lg border border-white bg-white object-cover shadow-lg shadow-slate-300/50 ring-1 ring-slate-900/5"
                  priority
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                    Urovo Projects
                  </div>
                  <h1 className="mt-1 break-words text-3xl font-semibold tracking-tight text-slate-950 [overflow-wrap:anywhere]">
                    {project.project_name}
                  </h1>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium">
                    <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700 shadow-sm shadow-emerald-100">
                      {project.sales || "Unknown"}
                    </span>
                    <span className="rounded-md border border-slate-200 bg-white/85 px-2 py-1 text-slate-500 shadow-sm shadow-slate-200/60">
                      Created at {formatDate(project.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="hidden border-l border-white/80 bg-slate-950 p-5 text-white shadow-inner shadow-black/20 lg:block">
              <div className="h-full rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  Public project preview
                </div>
                <div className="mt-3 h-px bg-gradient-to-r from-cyan-300 via-emerald-300 to-transparent" />
                <div className="mt-4 text-sm leading-6 text-slate-200">
                  {project.project_name}
                </div>
              </div>
            </div>
          </div>
          <PreviewFilterBar
            tab={tab}
            query={query}
            ticketFilter={ticketFilter}
            requirementFilter={requirementFilter}
            onQueryChange={setQuery}
            onTicketFilterChange={setTicketFilter}
            onRequirementFilterChange={setRequirementFilter}
          />
        </section>

        {tab === "overview" ? (
          <OverviewPreview
            overview={overview}
            requirements={requirements}
            demands={filteredDemands}
            totalDemands={overview.requirements.length}
            searching={query.trim().length > 0}
          />
        ) : tab === "release" ? (
          <ReleaseRecordsPreview
            releaseRecords={filteredReleaseRecords}
            totalReleaseRecords={releaseRecords.length}
            filtering={query.trim().length > 0}
          />
        ) : tab === "tickets" ? (
          <TicketsPreview
            tickets={filteredTickets}
            totalTickets={tickets.length}
            filtering={query.trim().length > 0 || ticketFilter !== "all"}
            ticketEventSummaries={ticketEventSummaries}
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

function BrandLockup() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="rounded-lg bg-gradient-to-br from-cyan-200 via-white to-emerald-200 p-px shadow-sm shadow-slate-200">
        <Image
          src="/patrick.png"
          alt="Urovo Projects"
          width={48}
          height={48}
          className="h-11 w-11 rounded-lg bg-white object-cover"
          priority
        />
      </div>
      <div className="min-w-0">
        <div className="truncate text-base font-semibold tracking-tight text-slate-950">
          Urovo Projects
        </div>
        <div className="truncate text-xs font-medium text-slate-500">
          Public project preview
        </div>
      </div>
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
    <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-slate-200/80 bg-white/80 p-1 shadow-inner shadow-slate-200/60">
      {previewTabs.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={`h-9 shrink-0 rounded-md px-3 text-sm font-medium transition ${
            tab === item.value
              ? "bg-slate-950 text-white shadow-sm shadow-slate-300"
              : "text-slate-500 hover:bg-cyan-50 hover:text-slate-950"
          }`}
        >
          {item.label}
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
    <div className="bg-white/80 px-5 py-4 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <label className="min-w-64 flex-1">
          <span className="sr-only">Search preview</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-cyan-400 to-emerald-400" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-7 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              placeholder={
                tab === "overview"
                  ? "Search demands"
                  : tab === "release"
                    ? "Search release records"
                    : tab === "tickets"
                      ? "Search tickets"
                      : "Search requirements"
              }
            />
          </div>
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
    </div>
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
              ? "border-slate-950 bg-slate-950 text-white shadow-sm shadow-slate-300"
              : "border-slate-200 bg-white text-slate-600 shadow-sm shadow-slate-100 hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-50 hover:text-slate-950"
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
      <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-lg shadow-slate-200/60 ring-1 ring-slate-900/[0.03]">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="space-y-3">
            <RelatedLine label="Models" values={overview.models} />
            <RelatedLine label="Services" values={overview.others} />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Description
            </div>
            <div className="rounded-lg border border-slate-200 bg-[linear-gradient(135deg,#f8fafc,#ffffff)] p-3 text-sm leading-6 text-slate-700 shadow-inner shadow-slate-100">
              {overview.description || "No description."}
            </div>
          </div>
        </div>
      </section>
      <section>
        <SectionHeader
          title="Product demands"
          count={visibleCountText(demands.length, totalDemands)}
        />
        <div className="grid gap-3">
          {demands.map((demand) => (
            <article
              key={demand.id}
              className="group overflow-hidden rounded-lg border border-white/80 bg-white shadow-lg shadow-slate-200/60 ring-1 ring-slate-900/[0.04] transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-300/50"
            >
              <div className="h-1 bg-gradient-to-r from-cyan-400 via-emerald-400 to-slate-200" />
              <div className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="min-w-0 break-words text-base font-semibold leading-6 text-slate-950 [overflow-wrap:anywhere]">
                  <EntityId>{demand.id}</EntityId>
                  {demand.product}
                </h3>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500">
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
                <div className="mt-3 space-y-2 border-l-2 border-cyan-200 pl-3">
                  {demand.linked_requirements.map((requirementId) => {
                    const requirement = requirementMap.get(requirementId);
                    return (
                      <div
                        key={requirementId}
                        className="relative flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cyan-100 bg-cyan-50/60 px-3 py-2 text-sm shadow-sm shadow-cyan-100/60"
                      >
                        <span className="absolute -left-[17px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-cyan-400 ring-4 ring-white" />
                        <span className="min-w-0 break-words font-medium text-slate-700 [overflow-wrap:anywhere]">
                          {requirement
                            ? `[${requirement.id}] ${requirement.title}`
                            : requirementId}
                        </span>
                        {requirement ? (
                          <RequirementStatusPill status={requirement.status} />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {demand.remark ? (
                <p className="mt-3 rounded-lg border border-slate-200 bg-[linear-gradient(135deg,#f8fafc,#ffffff)] p-3 text-sm leading-6 text-slate-600">
                  {demand.remark}
                </p>
              ) : null}
              </div>
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
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>
      {values.length > 0 ? (
        values.map((value) => (
          <span
            key={value}
            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600"
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

function ReleaseRecordsPreview({
  releaseRecords,
  totalReleaseRecords,
  filtering,
}: {
  releaseRecords: ReleaseRecord[];
  totalReleaseRecords: number;
  filtering: boolean;
}) {
  return (
    <section className="mt-5">
      <SectionHeader
        title="Release Records"
        count={visibleCountText(releaseRecords.length, totalReleaseRecords)}
      />
      {releaseRecords.length > 0 ? (
        <div className="grid gap-3">
          {releaseRecords.map((record) => (
            <article
              key={record.id}
              className="overflow-hidden rounded-lg border border-white/80 bg-white shadow-lg shadow-slate-200/60 ring-1 ring-slate-900/[0.04] transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-300/50"
            >
              <div className="h-1 bg-gradient-to-r from-emerald-400 via-cyan-400 to-slate-200" />
              <div className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Model
                  </div>
                  <h3 className="mt-1 break-words text-base font-semibold text-slate-950 [overflow-wrap:anywhere]">
                    {record.model || "-"}
                  </h3>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <span
                    className={`rounded-md border px-2 py-1 text-xs font-medium ${
                      record.release_date
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    {record.release_date ?? "Not Released"}
                  </span>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
                    Order {record.order_count ?? "-"}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.35fr)]">
                <div className="space-y-2 rounded-lg border border-slate-200 bg-[linear-gradient(135deg,#f8fafc,#ffffff)] p-3 shadow-inner shadow-slate-100">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Firmware
                  </div>
                  <FirmwareValue label="OS" value={record.firmware.os} />
                  <FirmwareValue label="UFS" value={record.firmware.ufs} />
                  <FirmwareValue label="SE" value={record.firmware.se} />
                </div>

                <div className="rounded-lg border border-slate-200 bg-[linear-gradient(135deg,#f8fafc,#ffffff)] p-3 shadow-inner shadow-slate-100">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    ChangeLog
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">
                    {record.change_log || "No changelog."}
                  </p>
                </div>
              </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyPreview
          text={
            filtering
              ? "No matching release records."
              : "No release records for this project."
          }
        />
      )}
    </section>
  );
}

function FirmwareValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-2">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <span className="break-words text-sm text-slate-700 [overflow-wrap:anywhere]">
        {value || "-"}
      </span>
    </div>
  );
}

function TicketsPreview({
  tickets,
  totalTickets,
  filtering,
  ticketEventSummaries,
}: {
  tickets: Ticket[];
  totalTickets: number;
  filtering: boolean;
  ticketEventSummaries: TicketEventSummariesFile;
}) {
  return (
    <section className="mt-5">
      <SectionHeader
        title="Ticket Dashboard"
        count={visibleCountText(tickets.length, totalTickets)}
      />
      <div className="grid gap-3">
        {tickets.map((ticket) => {
          const summaryTicket = ticketEventSummaryForTicket(
            ticketEventSummaries,
            ticket,
          );
          return (
            <PublicTicketEventSummaryCard
              key={ticket.id}
              ticket={ticket}
              summaryTicket={summaryTicket}
              showEmptySummaries
            />
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

function PublicTicketEventSummaryCard({
  ticket,
  summaryTicket,
  showEmptySummaries = false,
}: {
  ticket: Ticket;
  summaryTicket: TicketEventSummaryTicket | undefined;
  showEmptySummaries?: boolean;
}) {
  const summaries = displaySummaries(ticket, summaryTicket);
  const [showSummaries, setShowSummaries] = useState(false);
  if (summaries.length === 0 && !showEmptySummaries) {
    return null;
  }

  return (
    <>
      <article className="overflow-hidden rounded-lg border border-white/80 bg-white text-left shadow-lg shadow-slate-200/60 ring-1 ring-slate-900/[0.04] transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-300/50">
        <div className={`h-1 ${ticketAccentClass(ticket)}`} />
        <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-base font-semibold leading-6 text-slate-950">
              <EntityId>{ticket.id}</EntityId>
              <span>{ticket.title}</span>
            </h3>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            <TicketStatusPill status={ticket.status} />
            <PriorityPill priority={ticket.priority} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowSummaries(true)}
          className="mt-4 w-full rounded-lg border border-cyan-100 bg-[linear-gradient(135deg,#ecfeff,#f8fafc)] p-3 text-left shadow-sm shadow-cyan-100/70 transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-50 focus:outline-none focus:ring-4 focus:ring-cyan-100"
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
            <span className="shrink-0 rounded-md border border-cyan-200 bg-white px-2 py-1 text-xs font-medium text-cyan-700 shadow-sm">
              Open
            </span>
          </div>
        </button>

        {ticket.next_action ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-[linear-gradient(135deg,#f8fafc,#ffffff)] p-3 shadow-inner shadow-slate-100">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Next action
            </div>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-700">
              {ticket.next_action}
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            Updated {formatDateTimeFull(ticket.updated_at)}
            {summaryTicket?.last_polished_at ? (
              <>
                {" "}
                | AI polished{" "}
                {formatDateTimeFull(summaryTicket.last_polished_at)}
              </>
            ) : null}
          </span>
          <span>{ticket.events.length} events</span>
        </div>
        </div>
      </article>

      {showSummaries ? (
        <PublicEventSummaryDialog
          ticket={ticket}
          summaries={summaries}
          onClose={() => setShowSummaries(false)}
        />
      ) : null}
    </>
  );
}

function PublicEventSummaryDialog({
  ticket,
  summaries,
  onClose,
}: {
  ticket: Ticket;
  summaries: DisplaySummary[];
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filteredSummaries = filterSummaries(summaries, search);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-white/20 bg-white shadow-2xl shadow-slate-950/30">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc,#ecfeff)] p-5">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {ticket.id}
            </div>
            <h2 className="mt-1 line-clamp-2 text-lg font-semibold text-slate-950">
              {ticket.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search event summaries"
            className="mb-4 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
          />
          <div className="space-y-3">
            {filteredSummaries.map(({ summary, events }) => (
              <section
                key={summary.uuid}
                className="rounded-lg border border-slate-200 bg-[linear-gradient(135deg,#f8fafc,#ffffff)] p-3 shadow-sm shadow-slate-100"
              >
                <div className="text-sm font-semibold text-slate-950">
                  {summaryTitle(summary)}
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">
                  {summary.message}
                </p>
                <details className="mt-3 rounded-lg border border-cyan-100 bg-white">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-cyan-700">
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
    </div>
  );
}

function RawEventRow({ event }: { event: TimelineEvent }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3">
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
      <SectionHeader
        title="Requirements"
        count={visibleCountText(requirements.length, totalRequirements)}
      />
      <div className="grid gap-3">
        {requirements.map((requirement) => (
          <article
            key={requirement.id}
            className="overflow-hidden rounded-lg border border-white/80 bg-white shadow-lg shadow-slate-200/60 ring-1 ring-slate-900/[0.04] transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-300/50"
          >
            <div className={`h-1 ${requirementAccentClass(requirement.status)}`} />
            <div className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="line-clamp-2 text-base font-semibold leading-6 text-slate-950">
                <EntityId>{requirement.id}</EntityId>
                {requirement.title}
              </h3>
              <RequirementStatusPill status={requirement.status} />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {requirement.details || "No details."}
            </p>
            {requirement.related_tickets.length > 0 ? (
              <div className="mt-3 rounded-lg border border-cyan-100 bg-cyan-50/50 p-3 shadow-sm shadow-cyan-100/60">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Related tickets
                </div>
                <div className="mt-2 space-y-2">
                  {requirement.related_tickets.map((ticketId) => {
                    const ticket = ticketMap.get(ticketId);
                    return (
                      <div
                        key={ticketId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white bg-white px-3 py-2 text-sm shadow-sm shadow-cyan-100/60"
                      >
                        <span className="min-w-0 break-words font-medium text-slate-700 [overflow-wrap:anywhere]">
                          {ticket
                            ? `[${ticket.id}] ${ticket.title}`
                            : ticketId}
                        </span>
                        {ticket ? (
                          <span className="flex shrink-0 flex-wrap items-center gap-1">
                            <TicketStatusPill status={ticket.status} />
                            <PriorityPill priority={ticket.priority} />
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <span>
                Updated {formatDateTimeFull(requirement.last_updated)}
              </span>
              <span>{requirement.timeline.length} updates</span>
            </div>
            </div>
          </article>
        ))}
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

function SectionHeader({ title, count }: { title: string; count: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="h-2 w-2 rounded-full bg-cyan-500 shadow-sm shadow-cyan-300" />
        {title}
      </h2>
      <span className="rounded-md border border-white/80 bg-white/90 px-2 py-1 text-xs font-medium text-slate-500 shadow-sm shadow-slate-200">
        {count}
      </span>
    </div>
  );
}

function EntityId({ children }: { children: string }) {
  return (
    <span className="mr-2 inline-flex rounded-md bg-slate-950 px-2 py-0.5 text-xs font-semibold text-white shadow-sm shadow-slate-300">
      {children}
    </span>
  );
}

function RequirementStatusPill({ status }: { status: RequirementStatus }) {
  const styles: Record<RequirementStatus, string> = {
    pending: "border-slate-200 bg-slate-100 text-slate-700",
    in_progress: "border-blue-200 bg-blue-50 text-blue-700",
    testing: "border-violet-200 bg-violet-50 text-violet-700",
    finished: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
  return (
    <span
      className={`rounded-md border px-2 py-1 text-xs font-medium ${styles[status]}`}
    >
      {requirementStatusLabels[status]}
    </span>
  );
}

function TicketStatusPill({ status }: { status: TicketStatus }) {
  const styles: Record<TicketStatus, string> = {
    pending_internal: "border-orange-200 bg-orange-50 text-orange-800",
    pending_customer: "border-amber-200 bg-amber-50 text-amber-800",
    resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
  return (
    <span
      className={`rounded-md border px-2 py-1 text-xs font-medium ${styles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function PriorityPill({ priority }: { priority: TicketPriority }) {
  const styles: Record<TicketPriority, string> = {
    low: "border-slate-200 bg-slate-100 text-slate-600",
    medium: "border-blue-200 bg-blue-50 text-blue-700",
    high: "border-rose-200 bg-rose-50 text-rose-700",
    urgent: "border-red-600 bg-red-600 text-white",
  };
  return (
    <span
      className={`rounded-md border px-2 py-1 text-xs font-medium ${styles[priority]}`}
    >
      {priorityLabels[priority]}
    </span>
  );
}

function ticketAccentClass(ticket: Ticket) {
  if (ticket.priority === "urgent") {
    return "bg-gradient-to-r from-red-500 via-rose-400 to-slate-200";
  }
  if (ticket.status === "resolved") {
    return "bg-gradient-to-r from-emerald-400 via-cyan-400 to-slate-200";
  }
  if (ticket.status === "pending_customer") {
    return "bg-gradient-to-r from-amber-400 via-cyan-400 to-slate-200";
  }
  return "bg-gradient-to-r from-orange-400 via-cyan-400 to-slate-200";
}

function requirementAccentClass(status: RequirementStatus) {
  const styles: Record<RequirementStatus, string> = {
    pending: "bg-gradient-to-r from-slate-400 via-cyan-400 to-slate-200",
    in_progress: "bg-gradient-to-r from-blue-500 via-cyan-400 to-slate-200",
    testing: "bg-gradient-to-r from-violet-500 via-cyan-400 to-slate-200",
    finished: "bg-gradient-to-r from-emerald-400 via-cyan-400 to-slate-200",
  };
  return styles[status];
}

function EmptyPreview({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-cyan-200 bg-white/85 p-10 text-center text-sm text-slate-500 shadow-lg shadow-slate-200/50">
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

function filterPreviewReleaseRecords(
  releaseRecords: ReleaseRecord[],
  query: string,
) {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return releaseRecords;
  }

  return releaseRecords.filter((record) =>
    includesQuery(
      [
        record.model,
        record.firmware.os,
        record.firmware.ufs,
        record.firmware.se,
        record.change_log,
        record.release_date || "Not Released",
        String(record.order_count ?? ""),
      ],
      normalizedQuery,
    ),
  );
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
  const latest = eventTime(b.events.at(-1)).localeCompare(
    eventTime(a.events.at(-1)),
  );
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

function includesQuery(values: string[], normalizedQuery: string) {
  return values.join(" ").toLowerCase().includes(normalizedQuery);
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

function visibleCountText(visible: number, total: number) {
  return visible === total ? `${total} shown` : `${visible} of ${total} shown`;
}
