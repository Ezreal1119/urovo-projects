import type { DashboardData } from "@/lib/types";
import type { DashboardFilter, DashboardMode, DashboardReleaseNoteRow, DashboardRequirement, DashboardTicket } from "../types";
import { TICKETS_PER_PAGE } from "../constants";
import { dashboardFilterLabel, dashboardModeLabel } from "../labels";
import { dashboardMetrics, dashboardRequirementMetrics } from "../dashboard-selectors";
import { formatDateTimeFull } from "../formatters";
import { ChartPanel, EmptyState, Pagination, PieChart, PriorityBadge, RequirementStatusBadge, StatusBadge } from "../ui";

export function DashboardView({
  data,
  mode,
  onModeChange,
  tickets,
  ticketCount,
  requirements,
  requirementCount,
  page,
  totalPages,
  allTickets,
  allRequirements,
  activeFilter,
  onFilterChange,
  onPreviousPage,
  onNextPage,
  onOpenReleaseNotes,
  onOpenProject,
  onOpenTicket,
  onOpenRequirement,
}: {
  data: DashboardData | null;
  mode: DashboardMode;
  onModeChange: (mode: DashboardMode) => void;
  tickets: DashboardTicket[];
  ticketCount: number;
  requirements: DashboardRequirement[];
  requirementCount: number;
  page: number;
  totalPages: number;
  allTickets: DashboardTicket[];
  allRequirements: DashboardRequirement[];
  activeFilter: DashboardFilter;
  onFilterChange: (filter: DashboardFilter) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onOpenReleaseNotes: () => void;
  onOpenProject: (folder: string) => void;
  onOpenTicket: (item: DashboardTicket) => void;
  onOpenRequirement: (item: DashboardRequirement) => void;
}) {
  const metrics = dashboardMetrics(allTickets);
  const requirementMetrics = dashboardRequirementMetrics(allRequirements);
  const topProjects =
    mode === "requirements"
      ? (data?.projects ?? [])
          .map((project) => ({
            ...project,
            active: project.requirements.filter((requirement) =>
              ["in_progress", "testing"].includes(requirement.status),
            ).length,
            urgent: project.requirements.filter(
              (requirement) => requirement.status === "in_progress",
            ).length,
          }))
          .sort(
            (a, b) =>
              b.active - a.active ||
              b.urgent - a.urgent ||
              a.project.project_name.localeCompare(b.project.project_name),
          )
          .slice(0, 3)
      : (data?.projects ?? [])
          .map((project) => ({
            ...project,
            active: project.tickets.filter(
              (ticket) => ticket.status !== "resolved",
            ).length,
            urgent: project.tickets.filter(
              (ticket) => ticket.priority === "urgent",
            ).length,
          }))
          .sort(
            (a, b) =>
              b.active - a.active ||
              b.urgent - a.urgent ||
              a.project.project_name.localeCompare(b.project.project_name),
          )
          .slice(0, 6);
  const recentTicketActivity = [...allTickets]
    .sort((a, b) => b.ticket.updated_at.localeCompare(a.ticket.updated_at))
    .slice(0, 8);
  const recentRequirementActivity = [...allRequirements]
    .sort((a, b) =>
      b.requirement.last_updated.localeCompare(a.requirement.last_updated),
    )
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Monitor every{" "}
              {mode === "requirements" ? "requirement" : "support ticket"}{" "}
              across {data?.projects.length ?? 0} projects.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenReleaseNotes}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            >
              Release Note
            </button>
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              {(["tickets", "requirements"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onModeChange(item)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    mode === item
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-950"
                  }`}
                >
                  {dashboardModeLabel(item)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="space-y-4">
          <ChartPanel title="Status">
            <PieChart
              onTotalClick={() => onFilterChange("all")}
              emptyText={
                mode === "requirements"
                  ? "No requirement data for this chart."
                  : "No ticket data for this chart."
              }
              items={
                mode === "requirements"
                  ? [
                      {
                        label: "Pending",
                        value: requirementMetrics.pending,
                        color: "#94a3b8",
                        active: activeFilter === "pending_internal",
                        onClick: () => onFilterChange("pending_internal"),
                      },
                      {
                        label: "In Progress",
                        value: requirementMetrics.inProgress,
                        color: "#3b82f6",
                        active: activeFilter === "pending_customer",
                        onClick: () => onFilterChange("pending_customer"),
                      },
                      {
                        label: "Testing",
                        value: requirementMetrics.testing,
                        color: "#8b5cf6",
                        active: activeFilter === "urgent",
                        onClick: () => onFilterChange("urgent"),
                      },
                      {
                        label: "Finished",
                        value: requirementMetrics.finished,
                        color: "#10b981",
                        active: activeFilter === "resolved",
                        onClick: () => onFilterChange("resolved"),
                      },
                    ]
                  : [
                      {
                        label: "[Pending]: Internal",
                        value: metrics.pendingInternal,
                        color: "#fb923c",
                        active: activeFilter === "pending_internal",
                        onClick: () => onFilterChange("pending_internal"),
                      },
                      {
                        label: "[Pending]: Customer",
                        value: metrics.pendingCustomer,
                        color: "#fbbf24",
                        active: activeFilter === "pending_customer",
                        onClick: () => onFilterChange("pending_customer"),
                      },
                      {
                        label: "[Resolved]",
                        value: metrics.resolved,
                        color: "#10b981",
                        active: activeFilter === "resolved",
                        onClick: () => onFilterChange("resolved"),
                      },
                    ]
              }
            />
          </ChartPanel>
          {mode === "tickets" ? (
            <ChartPanel title="Priority">
              <PieChart
                onTotalClick={() => onFilterChange("all")}
                items={[
                  {
                    label: "Low",
                    value: allTickets.filter(
                      (item) => item.ticket.priority === "low",
                    ).length,
                    color: "#94a3b8",
                    active: activeFilter === "priority_low",
                    onClick: () => onFilterChange("priority_low"),
                  },
                  {
                    label: "Medium",
                    value: allTickets.filter(
                      (item) => item.ticket.priority === "medium",
                    ).length,
                    color: "#3b82f6",
                    active: activeFilter === "priority_medium",
                    onClick: () => onFilterChange("priority_medium"),
                  },
                  {
                    label: "High",
                    value: allTickets.filter(
                      (item) => item.ticket.priority === "high",
                    ).length,
                    color: "#fb7185",
                    active: activeFilter === "priority_high",
                    onClick: () => onFilterChange("priority_high"),
                  },
                  {
                    label: "Urgent",
                    value: metrics.urgent,
                    color: "#dc2626",
                    active: activeFilter === "urgent",
                    onClick: () => onFilterChange("urgent"),
                  },
                ]}
              />
            </ChartPanel>
          ) : null}
        </div>
        <div className="space-y-4">
          <ChartPanel title="Top active projects">
            <div className="space-y-2">
              {topProjects.map((project) => (
                <button
                  key={project.folder}
                  type="button"
                  onClick={() => onOpenProject(project.folder)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-950">
                        {project.project.project_name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {project.folder.split("/")[0]}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold text-slate-950">
                        {project.active} active
                      </div>
                      <div
                        className={`text-xs ${
                          mode === "requirements"
                            ? "text-blue-600"
                            : "text-red-600"
                        }`}
                      >
                        {project.urgent}{" "}
                        {mode === "requirements" ? "in progress" : "urgent"}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {topProjects.length === 0 ? (
                <EmptyState text="No project data yet." />
              ) : null}
            </div>
          </ChartPanel>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ChartPanel
          title={`${dashboardFilterLabel(activeFilter, mode)} ${mode}`}
        >
          <div className="space-y-2">
            {mode === "requirements"
              ? requirements.map((item) => (
                  <DashboardRequirementRow
                    key={`${item.folder}-${item.requirement.id}`}
                    item={item}
                    onClick={() => onOpenRequirement(item)}
                  />
                ))
              : tickets.map((item) => (
                  <DashboardTicketRow
                    key={`${item.folder}-${item.ticket.id}`}
                    item={item}
                    onClick={() => onOpenTicket(item)}
                  />
                ))}
            {(mode === "requirements" ? requirementCount : ticketCount) ===
            0 ? (
              <EmptyState text={`No ${mode} match this dashboard filter.`} />
            ) : null}
          </div>
          {(mode === "requirements" ? requirementCount : ticketCount) >
          TICKETS_PER_PAGE ? (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPrevious={onPreviousPage}
              onNext={onNextPage}
            />
          ) : null}
        </ChartPanel>
        <ChartPanel title="Recent activity">
          <div className="space-y-2">
            {mode === "requirements"
              ? recentRequirementActivity.map((item) => (
                  <button
                    key={`${item.folder}-${item.requirement.id}`}
                    type="button"
                    onClick={() => onOpenRequirement(item)}
                    className="w-full rounded-lg border border-slate-200 p-3 text-left transition hover:bg-slate-50"
                  >
                    <div className="truncate text-sm font-semibold text-slate-950">
                      [{item.requirement.id}] {item.requirement.title}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-500">
                        {item.project.project_name}
                      </span>
                      <span className="text-xs text-slate-400">
                        Updated{" "}
                        {formatDateTimeFull(item.requirement.last_updated)}
                      </span>
                    </div>
                  </button>
                ))
              : recentTicketActivity.map((item) => (
                  <button
                    key={`${item.folder}-${item.ticket.id}`}
                    type="button"
                    onClick={() => onOpenTicket(item)}
                    className="w-full rounded-lg border border-slate-200 p-3 text-left transition hover:bg-slate-50"
                  >
                    <div className="truncate text-sm font-semibold text-slate-950">
                      [{item.ticket.id}] {item.ticket.title}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-500">
                        {item.project.project_name}
                      </span>
                      <span className="text-xs text-slate-400">
                        Updated {formatDateTimeFull(item.ticket.updated_at)}
                      </span>
                    </div>
                  </button>
                ))}
            {(mode === "requirements"
              ? recentRequirementActivity.length
              : recentTicketActivity.length) === 0 ? (
              <EmptyState text={`No recent ${mode.slice(0, -1)} activity.`} />
            ) : null}
          </div>
        </ChartPanel>
      </section>
    </div>
  );
}

export function DashboardTicketRow({
  item,
  onClick,
}: {
  item: DashboardTicket;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="line-clamp-2 text-sm font-semibold text-slate-950">
            [{item.ticket.id}] {item.ticket.title}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {item.project.project_name}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">
          <StatusBadge status={item.ticket.status} />
          <PriorityBadge priority={item.ticket.priority} />
        </div>
      </div>
      <div className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
        {item.ticket.next_action || item.ticket.summary || "No next action."}
      </div>
      <div className="mt-2 text-xs text-slate-400">
        Updated {formatDateTimeFull(item.ticket.updated_at)}
      </div>
    </button>
  );
}

export function DashboardRequirementRow({
  item,
  onClick,
}: {
  item: DashboardRequirement;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="line-clamp-2 text-sm font-semibold text-slate-950">
            [{item.requirement.id}] {item.requirement.title}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {item.project.project_name}
          </div>
        </div>
        <RequirementStatusBadge status={item.requirement.status} />
      </div>
      <div className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
        {item.requirement.details || "No details."}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
        <span>Updated {formatDateTimeFull(item.requirement.last_updated)}</span>
        <span>{item.requirement.timeline.length} updates</span>
      </div>
    </button>
  );
}

export function ReleaseNotesDialog({
  rows,
  loading,
  error,
  onClose,
  onOpenProject,
}: {
  rows: DashboardReleaseNoteRow[];
  loading: boolean;
  error: string;
  onClose: () => void;
  onOpenProject: (folder: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/30 p-4">
      <div className="flex max-h-[84vh] w-full max-w-5xl flex-col rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              Release Note
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Released firmware records across all projects.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>
        {error ? (
          <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto p-5">
          {loading ? (
            <EmptyState text="Loading release notes..." />
          ) : rows.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="grid grid-cols-[160px_200px_180px_minmax(240px,1fr)] border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <div className="p-3">Country</div>
                <div className="p-3">Customer Name</div>
                <div className="p-3">Model</div>
                <div className="p-3">ChangeLog</div>
              </div>
              <div className="divide-y divide-slate-200">
                {rows.map((row, index) => (
                  <button
                    key={`${row.folder}-${row.model}-${index}`}
                    type="button"
                    onClick={() => onOpenProject(row.folder)}
                    className="grid w-full grid-cols-[160px_200px_180px_minmax(240px,1fr)] text-left text-sm transition hover:bg-slate-50"
                  >
                    <div className="truncate p-3 font-medium text-slate-700">
                      {row.country || "-"}
                    </div>
                    <div className="truncate p-3 text-slate-700">
                      {row.customer || "-"}
                    </div>
                    <div className="truncate p-3 font-medium text-slate-950">
                      {row.model || "-"}
                    </div>
                    <div className="line-clamp-2 p-3 leading-6 text-slate-600">
                      {row.change_log || "No changelog."}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState text="No release notes found." />
          )}
        </div>
      </div>
    </div>
  );
}
