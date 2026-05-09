"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type {
  Overview,
  ProjectInfo,
  Requirement,
  Ticket,
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
  const summary = useMemo(
    () => buildProjectSummary(project, overview, requirements, tickets),
    [overview, project, requirements, tickets],
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

        {tab === "overview" ? (
          <OverviewPreview overview={overview} requirements={requirements} />
        ) : tab === "tickets" ? (
          <TicketsPreview tickets={tickets} />
        ) : (
          <RequirementsPreview requirements={requirements} tickets={tickets} />
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

function OverviewPreview({
  overview,
  requirements,
}: {
  overview: Overview;
  requirements: Requirement[];
}) {
  const requirementMap = new Map(
    requirements.map((requirement) => [requirement.id, requirement]),
  );
  const demands = sortOverviewDemandsForSummary(overview.requirements);

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
            {demands.length} shown
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
                            ? `[${requirement.id}] ${stripBracketMetadata(requirement.title)}`
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

function TicketsPreview({ tickets }: { tickets: Ticket[] }) {
  return (
    <section className="mt-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Tickets</h2>
        <span className="text-xs text-slate-500">{tickets.length} shown</span>
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
                  {stripBracketMetadata(ticket.title)}
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
          <EmptyPreview text="No tickets for this project." />
        ) : null}
      </div>
    </section>
  );
}

function RequirementsPreview({
  requirements,
  tickets,
}: {
  requirements: Requirement[];
  tickets: Ticket[];
}) {
  const ticketMap = new Map(tickets.map((ticket) => [ticket.id, ticket]));

  return (
    <section className="mt-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Requirements</h2>
        <span className="text-xs text-slate-500">
          {requirements.length} shown
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
                  {stripBracketMetadata(requirement.title)}
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
                              ? `[${ticket.id}] ${stripBracketMetadata(ticket.title)}`
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
          <EmptyPreview text="No requirements for this project." />
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
