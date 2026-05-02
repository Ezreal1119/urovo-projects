"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { APP_TIME_ZONE, beijingTodayDate } from "@/lib/time";
import {
  DashboardData,
  EVENT_ROLES,
  EventRole,
  PRIORITIES,
  ProjectInfo,
  ProjectListItem,
  STATUSES,
  Ticket,
  TicketPriority,
  TicketStatus,
  TimelineEvent,
} from "@/lib/types";

type TicketDraft = {
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  summary: string;
  next_action: string;
};

type EventDraft = {
  time: string;
  role: EventRole;
  content: string;
};

type ProjectGroup = {
  country: string;
  projects: ProjectListItem[];
};

type ViewMode = "dashboard" | "project";

type TicketFilter = "all" | "active" | "pending_internal" | "urgent";

type DashboardFilter =
  | "all"
  | "active"
  | "pending_internal"
  | "pending_customer"
  | "urgent"
  | "priority_low"
  | "priority_medium"
  | "priority_high"
  | "resolved";

type DashboardTicket = {
  folder: string;
  project: ProjectInfo;
  ticket: Ticket;
};

type RecentProject = {
  folder: string;
  projectName: string;
  viewedAt: string;
};

const TICKETS_PER_PAGE = 10;
const RECENT_PROJECTS_KEY = "urovo-projects:recent-projects";

const emptyTicketDraft: TicketDraft = {
  title: "",
  status: "pending_internal",
  priority: "medium",
  summary: "",
  next_action: "",
};

const emptyEventDraft: EventDraft = {
  time: todayDate(),
  role: "support",
  content: "",
};

const statusLabels: Record<TicketStatus, string> = {
  pending_internal: "[Pending]: Internal",
  pending_customer: "[Pending]: Customer",
  resolved: "[Resolved]",
};

const priorityLabels: Record<TicketPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const eventRoleLabels: Record<EventRole, string> = {
  customer: "Customer",
  support: "Support",
  internal: "Internal",
  sales: "Sales",
  others: "Others",
};

const eventRoleStyles: Record<EventRole, string> = {
  customer: "bg-sky-50 text-sky-700 ring-sky-200",
  support: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  internal: "bg-violet-50 text-violet-700 ring-violet-200",
  sales: "bg-amber-50 text-amber-800 ring-amber-200",
  others: "bg-slate-100 text-slate-600 ring-slate-200",
};

export default function ProjectsWorkspace() {
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [globalQuery, setGlobalQuery] = useState("");
  const [ticketFilter, setTicketFilter] = useState<TicketFilter>("all");
  const [dashboardFilter, setDashboardFilter] = useState<DashboardFilter>("all");
  const [ticketPage, setTicketPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [editingNextActionId, setEditingNextActionId] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [selectedTicketDirty, setSelectedTicketDirty] = useState(false);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;

  const filteredProjects = useMemo(() => {
    const query = projectQuery.trim().toLowerCase();
    if (!query) {
      return projects;
    }
    return projects.filter(({ folder, project }) =>
      [folder, project.project_name, project.customer, project.country]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [projects, projectQuery]);

  const projectGroups = useMemo(() => {
    const groups = new Map<string, ProjectListItem[]>();

    for (const item of filteredProjects) {
      const [country = "Unknown"] = item.folder.split("/");
      const current = groups.get(country) ?? [];
      current.push(item);
      groups.set(country, current);
    }

    return Array.from(groups, ([country, groupProjects]) => ({
      country,
      projects: groupProjects.sort((a, b) => a.project.project_name.localeCompare(b.project.project_name)),
    })).sort((a, b) => a.country.localeCompare(b.country));
  }, [filteredProjects]);

  const filteredTickets = useMemo(() => {
    const query = globalQuery.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesDashboardFilter =
        ticketFilter === "all" ||
        (ticketFilter === "active" && ["pending_internal", "pending_customer"].includes(ticket.status)) ||
        (ticketFilter === "pending_internal" && ticket.status === "pending_internal") ||
        (ticketFilter === "urgent" && ticket.priority === "urgent");

      if (!matchesDashboardFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [ticket.id, ticket.title, ticket.summary, ticket.next_action, ticket.status, ticket.priority]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [tickets, globalQuery, ticketFilter]);

  const metrics = useMemo(() => {
    return {
      total: tickets.length,
      active: tickets.filter((ticket) => ticket.status !== "resolved").length,
      pendingInternal: tickets.filter((ticket) => ticket.status === "pending_internal").length,
      urgent: tickets.filter((ticket) => ticket.priority === "urgent").length,
    };
  }, [tickets]);

  const totalTicketPages = Math.max(1, Math.ceil(filteredTickets.length / TICKETS_PER_PAGE));
  const visibleTicketPage = Math.min(ticketPage, totalTicketPages);
  const paginatedTickets = filteredTickets.slice(
    (visibleTicketPage - 1) * TICKETS_PER_PAGE,
    visibleTicketPage * TICKETS_PER_PAGE,
  );

  const dashboardTickets = useMemo(() => flattenDashboardTickets(dashboardData), [dashboardData]);
  const filteredDashboardTickets = useMemo(
    () => filterDashboardTickets(dashboardTickets, dashboardFilter, globalQuery),
    [dashboardTickets, dashboardFilter, globalQuery],
  );

  useEffect(() => {
    setTicketPage(1);
  }, [selectedFolder, globalQuery, ticketFilter]);

  useEffect(() => {
    if (ticketPage > totalTicketPages) {
      setTicketPage(totalTicketPages);
    }
  }, [ticketPage, totalTicketPages]);

  function applyTicketFilter(filter: TicketFilter) {
    setTicketFilter(filter);
    setTicketPage(1);
    if (filter === "all") {
      setGlobalQuery("");
    }
  }

  function canDiscardTicketChanges() {
    return !selectedTicketDirty || confirm("Discard unsaved ticket changes?");
  }

  function closeSelectedTicket() {
    if (!canDiscardTicketChanges()) {
      return;
    }
    setSelectedTicketId("");
    setSelectedTicketDirty(false);
  }

  function openDashboard() {
    if (!canDiscardTicketChanges()) {
      return;
    }
    setViewMode("dashboard");
    setSelectedTicketId("");
    setSelectedTicketDirty(false);
  }

  function selectTicket(ticketId: string) {
    if (ticketId === selectedTicketId) {
      return;
    }
    if (!canDiscardTicketChanges()) {
      return;
    }
    setSelectedTicketId(ticketId);
    setSelectedTicketDirty(false);
  }

  async function loadProject(folder: string, options: { ticketId?: string } = {}) {
    if (!canDiscardTicketChanges()) {
      return;
    }
    setSelectedFolder(folder);
    setSelectedTicketId("");
    setSelectedTicketDirty(false);
    setViewMode("project");
    setError("");
    try {
      const data = await api<{ project: ProjectInfo; tickets: Ticket[] }>(`${projectApiPath(folder)}/tickets`);
      setSelectedProject(data.project);
      setTickets(data.tickets);
      setSelectedTicketId(options.ticketId ?? "");
      rememberRecentProject(folder, data.project.project_name);
    } catch (requestError) {
      setError((requestError as Error).message);
      setSelectedProject(null);
      setTickets([]);
    }
  }

  async function refreshDashboard() {
    const data = await api<DashboardData>("/api/dashboard");
    setDashboardData(data);
    setProjects(data.projects.map(({ folder, project }) => ({ folder, project })));
  }

  function refreshDashboardQuietly() {
    void refreshDashboard().catch((requestError) => setError((requestError as Error).message));
  }

  function rememberRecentProject(folder: string, projectName: string) {
    const nextRecent = [
      { folder, projectName, viewedAt: new Date().toISOString() },
      ...recentProjects.filter((project) => project.folder !== folder),
    ].slice(0, 5);
    setRecentProjects(nextRecent);
    window.localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(nextRecent));
  }

  function openDashboardTicket(item: DashboardTicket) {
    void loadProject(item.folder, { ticketId: item.ticket.id });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialProjects() {
      setLoading(true);
      setError("");
      try {
        const storedRecent = readRecentProjects();
        const data = await api<DashboardData>("/api/dashboard");
        if (cancelled) {
          return;
        }
        setDashboardData(data);
        setProjects(data.projects.map(({ folder, project }) => ({ folder, project })));
        setRecentProjects(storedRecent);
      } catch (requestError) {
        if (!cancelled) {
          setError((requestError as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialProjects();

    return () => {
      cancelled = true;
    };
  }, []);

  async function createTicket(draft: TicketDraft) {
    if (!selectedFolder) {
      return;
    }
    setSaving(true);
    try {
      const data = await api<{ ticket: Ticket }>(`${projectApiPath(selectedFolder)}/tickets`, {
        method: "POST",
        body: JSON.stringify(draft),
      });
      setTickets((current) => [data.ticket, ...current]);
      setTicketPage(1);
      setSelectedTicketId(data.ticket.id);
      setShowNewTicket(false);
      refreshDashboardQuietly();
    } finally {
      setSaving(false);
    }
  }

  async function updateTicket(ticketId: string, draft: TicketDraft, options: { showSuccessToast?: boolean } = {}) {
    setSaving(true);
    try {
      const data = await api<{ ticket: Ticket }>(`${projectApiPath(selectedFolder)}/tickets/${ticketId}`, {
        method: "PUT",
        body: JSON.stringify(draft),
      });
      setTickets((current) => current.map((ticket) => (ticket.id === ticketId ? data.ticket : ticket)));
      refreshDashboardQuietly();
      if (options.showSuccessToast ?? true) {
        showToast("Ticket changes saved.");
      }
    } finally {
      setSaving(false);
    }
  }

  function startNextActionEdit(ticket: Ticket) {
    setEditingNextActionId(ticket.id);
    setNextActionDraft(ticket.next_action);
  }

  async function saveNextAction(ticket: Ticket) {
    await updateTicket(ticket.id, {
      ...ticketToDraft(ticket),
      next_action: nextActionDraft,
    }, { showSuccessToast: false });
    setEditingNextActionId("");
    setNextActionDraft("");
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  async function deleteTicket(ticketId: string) {
    if (!confirm("Delete this ticket? This writes directly to tickets.json.")) {
      return;
    }
    setSaving(true);
    try {
      await api(`${projectApiPath(selectedFolder)}/tickets/${ticketId}`, { method: "DELETE" });
      setTickets((current) => current.filter((ticket) => ticket.id !== ticketId));
      setSelectedTicketId("");
      refreshDashboardQuietly();
    } finally {
      setSaving(false);
    }
  }

  async function addEvent(ticketId: string, draft: EventDraft) {
    setSaving(true);
    try {
      const data = await api<{ ticket: Ticket }>(
        `${projectApiPath(selectedFolder)}/tickets/${ticketId}/events`,
        {
          method: "POST",
          body: JSON.stringify(eventDraftForApi(draft)),
        },
      );
      setTickets((current) => current.map((ticket) => (ticket.id === ticketId ? data.ticket : ticket)));
      refreshDashboardQuietly();
    } finally {
      setSaving(false);
    }
  }

  async function updateEvent(ticketId: string, index: number, draft: EventDraft) {
    setSaving(true);
    try {
      const data = await api<{ ticket: Ticket }>(
        `${projectApiPath(selectedFolder)}/tickets/${ticketId}/events/${index}`,
        {
          method: "PUT",
          body: JSON.stringify(eventDraftForApi(draft)),
        },
      );
      setTickets((current) => current.map((ticket) => (ticket.id === ticketId ? data.ticket : ticket)));
      refreshDashboardQuietly();
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(ticketId: string, index: number) {
    setSaving(true);
    try {
      const data = await api<{ ticket: Ticket }>(
        `${projectApiPath(selectedFolder)}/tickets/${ticketId}/events/${index}`,
        { method: "DELETE" },
      );
      setTickets((current) => current.map((ticket) => (ticket.id === ticketId ? data.ticket : ticket)));
      refreshDashboardQuietly();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8fb] text-slate-950">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/90 px-5 backdrop-blur">
        <button
          type="button"
          onClick={openDashboard}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition hover:opacity-80"
          aria-label="Open dashboard"
        >
          <Image
            src="/patrick.png"
            alt="Urovo Projects"
            width={44}
            height={44}
            className="h-11 w-11 rounded-xl object-cover"
            priority
          />
          <div className="min-w-0">
            <div className="text-lg font-semibold tracking-tight text-slate-950">Urovo Projects</div>
          </div>
        </button>
        <label className="relative hidden w-full max-w-md md:block">
          <span className="sr-only">Search tickets</span>
          <input
            value={globalQuery}
            onChange={(event) => setGlobalQuery(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
            placeholder={viewMode === "dashboard" ? "Search all tickets" : "Search tickets"}
          />
        </label>
        <button
          onClick={() => setShowNewTicket(true)}
          disabled={viewMode !== "project" || !selectedFolder}
          className="h-10 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          New Ticket
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white p-4 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Projects</h2>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500">{projects.length}</span>
          </div>
          <input
            value={projectQuery}
            onChange={(event) => setProjectQuery(event.target.value)}
            className="mb-3 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
            placeholder="Filter projects"
          />
          <div className="space-y-3">
            {projectGroups.map((group) => (
              <ProjectTreeGroup
                key={group.country}
                group={group}
                selectedFolder={selectedFolder}
                onSelect={(folder) => void loadProject(folder)}
              />
            ))}
            {!loading && filteredProjects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                No `proj_` folders found.
              </div>
            ) : null}
          </div>
        </aside>

        <main className="min-w-0 p-4 lg:p-6">
          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {viewMode === "dashboard" ? (
            <DashboardView
              data={dashboardData}
              tickets={filteredDashboardTickets}
              allTickets={dashboardTickets}
              activeFilter={dashboardFilter}
              recentProjects={recentProjects}
              onFilterChange={setDashboardFilter}
              onOpenProject={(folder) => void loadProject(folder)}
              onOpenTicket={openDashboardTicket}
            />
          ) : selectedProject ? (
            <>
              <ProjectHeader project={selectedProject} />
              <section className="mt-5 grid gap-3 md:grid-cols-4">
                <Metric
                  label="Total tickets"
                  value={metrics.total}
                  active={ticketFilter === "all" && !globalQuery}
                  onClick={() => applyTicketFilter("all")}
                />
                <Metric
                  label="Active tickets"
                  value={metrics.active}
                  active={ticketFilter === "active"}
                  onClick={() => applyTicketFilter("active")}
                />
                <Metric
                  label="Pending internal"
                  value={metrics.pendingInternal}
                  active={ticketFilter === "pending_internal"}
                  onClick={() => applyTicketFilter("pending_internal")}
                />
                <Metric
                  label="Urgent"
                  value={metrics.urgent}
                  active={ticketFilter === "urgent"}
                  onClick={() => applyTicketFilter("urgent")}
                />
              </section>

              <section className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">Ticket Dashboard</h2>
                  <span className="text-xs text-slate-500">
                    {filteredTickets.length === 0
                      ? "0 shown"
                      : `${(visibleTicketPage - 1) * TICKETS_PER_PAGE + 1}-${Math.min(
                          visibleTicketPage * TICKETS_PER_PAGE,
                          filteredTickets.length,
                        )} of ${filteredTickets.length} shown`}
                  </span>
                </div>
                <div className="space-y-3">
                  {paginatedTickets.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      active={ticket.id === selectedTicketId}
                      onClick={() => selectTicket(ticket.id)}
                      isEditingNextAction={ticket.id === editingNextActionId}
                      nextActionDraft={nextActionDraft}
                      onStartNextActionEdit={() => startNextActionEdit(ticket)}
                      onNextActionDraftChange={setNextActionDraft}
                      onSaveNextAction={() => void saveNextAction(ticket)}
                    />
                  ))}
                </div>
                {filteredTickets.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center">
                    <div className="text-sm font-medium text-slate-900">No tickets to show</div>
                    <p className="mt-1 text-sm text-slate-500">Create a ticket or adjust the search filter.</p>
                  </div>
                ) : null}
                {filteredTickets.length > TICKETS_PER_PAGE ? (
                  <Pagination
                    page={visibleTicketPage}
                    totalPages={totalTicketPages}
                    onPrevious={() => setTicketPage((current) => Math.max(1, current - 1))}
                    onNext={() => setTicketPage((current) => Math.min(totalTicketPages, current + 1))}
                  />
                ) : null}
              </section>
            </>
          ) : (
            <div className="grid min-h-[60vh] place-items-center rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center">
              <div>
                <h1 className="text-lg font-semibold">Select a project</h1>
                <p className="mt-2 max-w-md text-sm text-slate-500">
                  The sidebar reads country folders from `PROJECTS_ROOT` and lists one layer of `proj_` project
                  folders inside them.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {selectedTicket ? (
        <TicketDrawer
          ticket={selectedTicket}
          saving={saving}
          onClose={closeSelectedTicket}
          onDirtyChange={setSelectedTicketDirty}
          onSave={(draft) => updateTicket(selectedTicket.id, draft)}
          onDelete={() => void deleteTicket(selectedTicket.id)}
          onAddEvent={(draft) => void addEvent(selectedTicket.id, draft)}
          onUpdateEvent={(index, draft) => void updateEvent(selectedTicket.id, index, draft)}
          onDeleteEvent={(index) => void deleteEvent(selectedTicket.id, index)}
        />
      ) : null}

      {showNewTicket ? (
        <TicketModal
          saving={saving}
          onClose={() => setShowNewTicket(false)}
          onCreate={createTicket}
        />
      ) : null}

      {toast ? <Toast message={toast} /> : null}
    </div>
  );
}

function ProjectHeader({ project }: { project: ProjectInfo }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{project.project_name}</h1>
          <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
            {project.status || "active"}
          </span>
        </div>
        <p className="w-full text-sm leading-6 text-slate-600">{project.description || "No description."}</p>
        <div className="mt-3 text-xs text-slate-400">Created at {formatDate(project.created_at)}</div>
      </div>
    </section>
  );
}

function DashboardView({
  data,
  tickets,
  allTickets,
  activeFilter,
  recentProjects,
  onFilterChange,
  onOpenProject,
  onOpenTicket,
}: {
  data: DashboardData | null;
  tickets: DashboardTicket[];
  allTickets: DashboardTicket[];
  activeFilter: DashboardFilter;
  recentProjects: RecentProject[];
  onFilterChange: (filter: DashboardFilter) => void;
  onOpenProject: (folder: string) => void;
  onOpenTicket: (item: DashboardTicket) => void;
}) {
  const metrics = dashboardMetrics(allTickets);
  const topProjects = (data?.projects ?? [])
    .map((project) => ({
      ...project,
      active: project.tickets.filter((ticket) => ticket.status !== "resolved").length,
      urgent: project.tickets.filter((ticket) => ticket.priority === "urgent").length,
    }))
    .sort((a, b) => b.active - a.active || b.urgent - a.urgent || a.project.project_name.localeCompare(b.project.project_name))
    .slice(0, 5);
  const recentActivity = [...allTickets].sort((a, b) => b.ticket.updated_at.localeCompare(a.ticket.updated_at)).slice(0, 8);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">
              Monitor every support ticket across {data?.projects.length ?? 0} projects.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <DashboardMetric label="Total tickets" value={metrics.total} active={activeFilter === "all"} onClick={() => onFilterChange("all")} />
        <DashboardMetric label="Active tickets" value={metrics.active} active={activeFilter === "active"} onClick={() => onFilterChange("active")} />
        <DashboardMetric label="Pending internal" value={metrics.pendingInternal} active={activeFilter === "pending_internal"} onClick={() => onFilterChange("pending_internal")} />
        <DashboardMetric label="Pending customer" value={metrics.pendingCustomer} active={activeFilter === "pending_customer"} onClick={() => onFilterChange("pending_customer")} />
        <DashboardMetric label="Urgent" value={metrics.urgent} active={activeFilter === "urgent"} onClick={() => onFilterChange("urgent")} />
        <DashboardMetric label="Resolved" value={metrics.resolved} active={activeFilter === "resolved"} onClick={() => onFilterChange("resolved")} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="space-y-4">
          <ChartPanel title="Status">
            <PieChart
              onTotalClick={() => onFilterChange("all")}
              items={[
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
              ]}
            />
          </ChartPanel>
          <ChartPanel title="Priority">
            <PieChart
              onTotalClick={() => onFilterChange("all")}
              items={[
                {
                  label: "Low",
                  value: allTickets.filter((item) => item.ticket.priority === "low").length,
                  color: "#94a3b8",
                  active: activeFilter === "priority_low",
                  onClick: () => onFilterChange("priority_low"),
                },
                {
                  label: "Medium",
                  value: allTickets.filter((item) => item.ticket.priority === "medium").length,
                  color: "#3b82f6",
                  active: activeFilter === "priority_medium",
                  onClick: () => onFilterChange("priority_medium"),
                },
                {
                  label: "High",
                  value: allTickets.filter((item) => item.ticket.priority === "high").length,
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
                      <div className="truncate text-sm font-semibold text-slate-950">{project.project.project_name}</div>
                      <div className="mt-1 text-xs text-slate-500">{project.folder.split("/")[0]}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold text-slate-950">{project.active} active</div>
                      <div className="text-xs text-red-600">{project.urgent} urgent</div>
                    </div>
                  </div>
                </button>
              ))}
              {topProjects.length === 0 ? <EmptyState text="No project data yet." /> : null}
            </div>
          </ChartPanel>
          <ChartPanel title="Recently viewed projects">
            <RecentProjectsList
              recentProjects={recentProjects}
              data={data}
              onOpenProject={onOpenProject}
            />
          </ChartPanel>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ChartPanel title={`${dashboardFilterLabel(activeFilter)} tickets`}>
          <div className="space-y-2">
            {tickets.map((item) => (
              <DashboardTicketRow key={`${item.folder}-${item.ticket.id}`} item={item} onClick={() => onOpenTicket(item)} />
            ))}
            {tickets.length === 0 ? <EmptyState text="No tickets match this dashboard filter." /> : null}
          </div>
        </ChartPanel>
        <ChartPanel title="Recent activity">
          <div className="space-y-2">
            {recentActivity.map((item) => (
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
                  <span className="text-xs text-slate-500">{item.project.project_name}</span>
                  <span className="text-xs text-slate-400">Updated {formatDateTimeFull(item.ticket.updated_at)}</span>
                </div>
              </button>
            ))}
            {recentActivity.length === 0 ? <EmptyState text="No recent ticket activity." /> : null}
          </div>
        </ChartPanel>
      </section>
    </div>
  );
}

function DashboardMetric({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md ${
        active ? "border-slate-400 ring-2 ring-slate-200" : "border-slate-200"
      }`}
    >
      <div className="text-2xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{label}</div>
    </button>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function PieChart({
  items,
  onTotalClick,
}: {
  items: {
    label: string;
    value: number;
    color: string;
    active: boolean;
    onClick: () => void;
  }[];
  onTotalClick: () => void;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
      <div className="relative grid aspect-square max-w-[180px] place-items-center justify-self-center rounded-full bg-slate-50">
        <svg viewBox="0 0 120 120" className="h-full w-full rotate-[-90deg]">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="18" />
          {items.map((item) => {
            const length = total > 0 ? (item.value / total) * circumference : 0;
            const strokeDashoffset = -offset;
            offset += length;
            return (
              <circle
                key={item.label}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={item.active ? 22 : 18}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="butt"
                className="cursor-pointer transition-all hover:opacity-80"
                onClick={item.onClick}
              />
            );
          })}
        </svg>
        <button
          type="button"
          onClick={onTotalClick}
          className="absolute grid h-20 w-20 place-items-center rounded-full border border-slate-200 bg-white text-center shadow-sm"
        >
          <span>
            <span className="block text-xl font-semibold text-slate-950">{total}</span>
            <span className="block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">Total</span>
          </span>
        </button>
      </div>
      <div className="grid gap-2">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            className={`flex items-center justify-between gap-3 rounded-lg border p-2 text-left transition hover:border-slate-300 hover:bg-slate-50 ${
              item.active ? "border-slate-400 bg-slate-50 ring-2 ring-slate-100" : "border-slate-200"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="truncate text-sm font-medium text-slate-700">{item.label}</span>
            </span>
            <span className="text-sm font-semibold text-slate-950">{item.value}</span>
          </button>
        ))}
      </div>
      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 sm:col-span-2">
          No ticket data for this chart.
        </div>
      ) : null}
    </div>
  );
}

function RecentProjectsList({
  recentProjects,
  data,
  onOpenProject,
}: {
  recentProjects: RecentProject[];
  data: DashboardData | null;
  onOpenProject: (folder: string) => void;
}) {
  if (recentProjects.length === 0) {
    return <EmptyState text="Open projects to build your recent list." />;
  }

  return (
    <div className="space-y-2">
      {recentProjects.map((recent) => {
        const project = data?.projects.find((item) => item.folder === recent.folder);
        const tickets = project?.tickets ?? [];
        return (
          <button
            key={recent.folder}
            type="button"
            onClick={() => onOpenProject(recent.folder)}
            className="w-full rounded-lg border border-slate-200 p-3 text-left transition hover:bg-slate-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">
                  {project?.project.project_name ?? recent.projectName}
                </div>
                <div className="mt-1 text-xs text-slate-500">{recent.folder}</div>
              </div>
              <div className="shrink-0 text-right text-xs text-slate-500">
                <div>{tickets.filter((ticket) => ticket.status !== "resolved").length} active</div>
                <div>{tickets.filter((ticket) => ticket.priority === "urgent").length} urgent</div>
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-400">Viewed {formatDateTimeFull(recent.viewedAt)}</div>
          </button>
        );
      })}
    </div>
  );
}

function DashboardTicketRow({ item, onClick }: { item: DashboardTicket; onClick: () => void }) {
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
          <div className="mt-1 text-xs text-slate-500">{item.project.project_name}</div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">
          <StatusBadge status={item.ticket.status} />
          <PriorityBadge priority={item.ticket.priority} />
        </div>
      </div>
      <div className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
        {item.ticket.next_action || item.ticket.summary || "No next action."}
      </div>
      <div className="mt-2 text-xs text-slate-400">Updated {formatDateTimeFull(item.ticket.updated_at)}</div>
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">{text}</div>;
}

function Pagination({
  page,
  totalPages,
  onPrevious,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <button
        type="button"
        onClick={onPrevious}
        disabled={page <= 1}
        className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Previous
      </button>
      <div className="text-sm font-medium text-slate-600">
        Page {page} of {totalPages}
      </div>
      <button
        type="button"
        onClick={onNext}
        disabled={page >= totalPages}
        className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}

function Metric({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md ${
        active ? "border-slate-400 ring-2 ring-slate-200" : "border-slate-200"
      }`}
    >
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{label}</div>
    </button>
  );
}

function ProjectTreeGroup({
  group,
  selectedFolder,
  onSelect,
}: {
  group: ProjectGroup;
  selectedFolder: string;
  onSelect: (folder: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50"
        aria-expanded={expanded}
      >
        <span className="w-3 text-slate-400">{expanded ? "▾" : "▸"}</span>
        <span className="truncate">{group.country}</span>
        <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
          {group.projects.length}
        </span>
      </button>
      {expanded ? (
        <div className="ml-3 border-l border-slate-200 pl-2">
          {group.projects.map(({ folder, project }) => (
            <button
              key={folder}
              onClick={() => onSelect(folder)}
              className={`mt-1 flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition ${
                folder === selectedFolder ? "bg-slate-100 text-slate-950" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{project.project_name}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TicketCard({
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
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{ticket.summary || "No summary."}</p>
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
          <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Next action</div>
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
          <p className="mt-1 line-clamp-2 text-sm text-slate-700">{ticket.next_action || "No next action."}</p>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>Updated {formatDateTimeFull(ticket.updated_at)}</span>
        <span>{ticket.events.length} events</span>
      </div>
    </div>
  );
}

function TicketModal({
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

function TicketDrawer({
  ticket,
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
  saving: boolean;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (draft: TicketDraft) => Promise<void>;
  onDelete: () => void;
  onAddEvent: (draft: EventDraft) => void;
  onUpdateEvent: (index: number, draft: EventDraft) => void;
  onDeleteEvent: (index: number) => void;
}) {
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
            <div className="text-xs font-medium text-slate-500">{ticket.id}</div>
            <h2 className="mt-1 text-xl font-semibold">{ticket.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>

        <div className="space-y-6 p-5">
          <TicketForm
            key={ticket.id}
            initial={ticketToDraft(ticket)}
            saving={saving}
            submitLabel="Save changes"
            showNextAction={false}
            onDirtyChange={onDirtyChange}
            onSubmit={saveTicket}
          />
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
                    if (confirm("Delete this timeline event? This writes directly to tickets.json.")) {
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
          </section>

          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-3 text-sm font-semibold">Add timeline event</h3>
            <EventForm saving={saving} submitLabel="Add event" onSubmit={onAddEvent} />
          </section>
        </div>
      </aside>
    </div>
  );
}

function TicketForm({
  initial,
  saving,
  submitLabel,
  showNextAction = true,
  preventEnterSubmit = false,
  onDirtyChange,
  onSubmit,
}: {
  initial: TicketDraft;
  saving: boolean;
  submitLabel: string;
  showNextAction?: boolean;
  preventEnterSubmit?: boolean;
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
    <form onSubmit={submit} onKeyDown={preventKeyboardSubmit} className="space-y-4">
      <Field label="Title">
        <input
          required
          value={draft.title}
          onChange={(event) => updateDraft({ ...draft, title: event.target.value })}
          className="form-input"
          placeholder="Describe the issue"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Status">
          <select
            value={draft.status}
            onChange={(event) => updateDraft({ ...draft, status: event.target.value as TicketStatus })}
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
            onChange={(event) => updateDraft({ ...draft, priority: event.target.value as TicketPriority })}
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
          onChange={(event) => updateDraft({ ...draft, summary: event.target.value })}
          className="form-input min-h-28 resize-y"
          placeholder="Current issue context and investigation notes"
        />
      </Field>
      {showNextAction ? (
        <Field label="Next action">
          <textarea
            value={draft.next_action}
            onChange={(event) => updateDraft({ ...draft, next_action: event.target.value })}
            className="form-input min-h-20 resize-y"
            placeholder="Owner, expected response, or next technical step"
          />
        </Field>
      ) : null}
      <button
        disabled={saving}
        className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}

function TimelineItem({
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
            <span className={`rounded-md px-2 py-1 text-xs font-medium ring-1 ${eventRoleStyles[event.role]}`}>
              {eventRoleLabels[event.role]}
            </span>
            <span className="text-xs text-slate-500">{formatDateOnly(event.time)}</span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{event.content || "-"}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button onClick={() => setEditing(!editing)} className="rounded-md px-2 py-1 text-xs hover:bg-slate-100">
            Edit
          </button>
          <button onClick={onDelete} className="rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50">
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

function EventForm({
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
            onChange={(event) => setDraft({ ...draft, time: event.target.value })}
            className="form-input"
          />
        </Field>
        <Field label="Role">
          <select
            value={draft.role}
            onChange={(event) => setDraft({ ...draft, role: event.target.value as EventRole })}
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
          onChange={(event) => setDraft({ ...draft, content: event.target.value })}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const styles: Record<TicketStatus, string> = {
    pending_internal: "bg-orange-50 text-orange-800",
    pending_customer: "bg-amber-50 text-amber-800",
    resolved: "bg-emerald-50 text-emerald-700",
  };
  return <span className={`rounded-md px-2 py-1 text-xs font-medium ${styles[status]}`}>{statusLabels[status]}</span>;
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const styles: Record<TicketPriority, string> = {
    low: "bg-slate-100 text-slate-600",
    medium: "bg-blue-50 text-blue-700",
    high: "bg-rose-50 text-rose-700",
    urgent: "bg-red-600 text-white",
  };
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-medium ${styles[priority]}`}>
      {priorityLabels[priority]}
    </span>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/30 p-4">{children}</div>;
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-800 shadow-xl">
      {message}
    </div>
  );
}

function projectApiPath(key: string) {
  return `/api/projects/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data as T;
}

function ticketToDraft(ticket: Ticket): TicketDraft {
  return {
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    summary: ticket.summary,
    next_action: ticket.next_action,
  };
}

function ticketDraftsEqual(left: TicketDraft, right: TicketDraft, includeNextAction: boolean) {
  return (
    left.title === right.title &&
    left.status === right.status &&
    left.priority === right.priority &&
    left.summary === right.summary &&
    (!includeNextAction || left.next_action === right.next_action)
  );
}

function flattenDashboardTickets(data: DashboardData | null): DashboardTicket[] {
  return (data?.projects ?? []).flatMap((project) =>
    project.tickets.map((ticket) => ({
      folder: project.folder,
      project: project.project,
      ticket,
    })),
  );
}

function filterDashboardTickets(tickets: DashboardTicket[], filter: DashboardFilter, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  return tickets.filter((item) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && item.ticket.status !== "resolved") ||
      (filter === "pending_internal" && item.ticket.status === "pending_internal") ||
      (filter === "pending_customer" && item.ticket.status === "pending_customer") ||
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

function dashboardMetrics(tickets: DashboardTicket[]) {
  return {
    total: tickets.length,
    active: tickets.filter((item) => item.ticket.status !== "resolved").length,
    pendingInternal: tickets.filter((item) => item.ticket.status === "pending_internal").length,
    pendingCustomer: tickets.filter((item) => item.ticket.status === "pending_customer").length,
    urgent: tickets.filter((item) => item.ticket.priority === "urgent").length,
    resolved: tickets.filter((item) => item.ticket.status === "resolved").length,
  };
}

function dashboardFilterLabel(filter: DashboardFilter) {
  const labels: Record<DashboardFilter, string> = {
    all: "All",
    active: "Active",
    pending_internal: "Pending internal",
    pending_customer: "Pending customer",
    urgent: "Urgent",
    priority_low: "Low priority",
    priority_medium: "Medium priority",
    priority_high: "High priority",
    resolved: "Resolved",
  };
  return labels[filter];
}

function percent(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return (value / total) * 100;
}

function readRecentProjects(): RecentProject[] {
  try {
    const raw = window.localStorage.getItem(RECENT_PROJECTS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as RecentProject[];
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (project) =>
              typeof project.folder === "string" &&
              typeof project.projectName === "string" &&
              typeof project.viewedAt === "string",
          )
          .slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

function eventToDraft(event: TimelineEvent): EventDraft {
  return {
    time: dateInputValue(event.time),
    role: event.role,
    content: event.content,
  };
}

function eventDraftForApi(draft: EventDraft): EventDraft {
  return {
    ...draft,
    time: draft.time.includes("T") ? draft.time : `${draft.time}T00:00:00`,
  };
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: APP_TIME_ZONE }).format(new Date(value));
}

function formatDateOnly(value: string) {
  if (!value) {
    return "-";
  }
  return dateInputValue(value);
}

function formatDateTimeFull(value: string) {
  if (!value) {
    return "-";
  }
  if (hasExplicitTimeZone(value)) {
    return formatBeijingDateTime(value);
  }
  const normalized = value.replace("T", " ");
  if (normalized.length === 10) {
    return `${normalized} 00:00:00`;
  }
  return normalized.slice(0, 19);
}

function formatBeijingDateTime(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

function hasExplicitTimeZone(value: string) {
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
}

function dateInputValue(value: string) {
  return value.includes("T") ? value.split("T")[0] : value;
}

function todayDate() {
  return beijingTodayDate();
}
