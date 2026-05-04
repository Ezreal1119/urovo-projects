"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { DashboardData, Overview, OverviewRequirement, ProjectInfo, ProjectListItem, Requirement, Ticket } from "@/lib/types";
import type { DashboardFilter, DashboardRequirement, DashboardTicket, DashboardMode, EventDraft, OverviewRequirementDraft, OverviewSettingsDraft, ProjectJsonDraft, ProjectMode, RecentProject, ReportGenerateDraft, ReportGenerateResponse, RequirementDeleteBlocker, RequirementDraft, RequirementTimelineDraft, TicketDeleteBlocker, TicketDraft, TicketFilter, ViewMode } from "./projects-workspace/types";
import { RECENT_PROJECTS_KEY, TICKETS_PER_PAGE } from "./projects-workspace/constants";
import { api, ApiError, projectApiPath } from "./projects-workspace/api-client";
import { flattenDashboardRequirements, flattenDashboardTickets, filterDashboardRequirements, filterDashboardTickets } from "./projects-workspace/dashboard-selectors";
import { emptyOverview, eventDraftForApi, overviewRequirementDraftForApi, requirementDraftForApi, requirementTimelineDraftForApi, ticketToDraft } from "./projects-workspace/drafts";
import { createUuid } from "./projects-workspace/formatters";
import { requirementStatusLabels, dashboardModeLabel, projectModeLabel } from "./projects-workspace/labels";
import { readRecentProjects } from "./projects-workspace/recent-projects";
import { buildProjectSummary } from "./projects-workspace/summary";
import { DashboardView } from "./projects-workspace/dashboard/DashboardView";
import { ProjectHeader, OverviewRequirementDrawer, OverviewRequirementModal, OverviewWorkspace } from "./projects-workspace/overview/OverviewWorkspace";
import { RequirementDrawer, RequirementModal, RequirementsWorkspace } from "./projects-workspace/requirements/RequirementsWorkspace";
import { TicketCard, TicketDrawer, TicketModal } from "./projects-workspace/tickets/TicketsWorkspace";
import { ProjectTreeGroup } from "./projects-workspace/sidebar/ProjectTreeGroup";
import { Metric, Toast, Pagination } from "./projects-workspace/ui";
import { GenerateReportDialog, ProjectJsonGeneratorDialog, ProjectJsonResultDialog, ProjectSummaryDialog, RequirementDeleteBlockedDialog, TicketDeleteBlockedDialog } from "./projects-workspace/dialogs/Dialogs";

export default function ProjectsWorkspace() {
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [projectMode, setProjectMode] = useState<ProjectMode>("tickets");
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>("tickets");
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null,
  );
  const [selectedFolder, setSelectedFolder] = useState("");
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(
    null,
  );
  const [overview, setOverview] = useState<Overview>(emptyOverview);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [selectedRequirementId, setSelectedRequirementId] = useState("");
  const [selectedOverviewRequirementId, setSelectedOverviewRequirementId] =
    useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [globalQuery, setGlobalQuery] = useState("");
  const [ticketFilter, setTicketFilter] = useState<TicketFilter>("all");
  const [dashboardFilter, setDashboardFilter] =
    useState<DashboardFilter>("all");
  const [dashboardTicketPage, setDashboardTicketPage] = useState(1);
  const [dashboardRequirementPage, setDashboardRequirementPage] = useState(1);
  const [ticketPage, setTicketPage] = useState(1);
  const [requirementPage, setRequirementPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [showNewRequirement, setShowNewRequirement] = useState(false);
  const [showNewOverviewRequirement, setShowNewOverviewRequirement] =
    useState(false);
  const [showProjectJsonGenerator, setShowProjectJsonGenerator] =
    useState(false);
  const [showGenerateReport, setShowGenerateReport] = useState(false);
  const [generatedProjectJson, setGeneratedProjectJson] = useState("");
  const [generatedProjectSummary, setGeneratedProjectSummary] = useState("");
  const [editingNextActionId, setEditingNextActionId] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [selectedTicketDirty, setSelectedTicketDirty] = useState(false);
  const [selectedRequirementDirty, setSelectedRequirementDirty] =
    useState(false);
  const [overviewDirty, setOverviewDirty] = useState(false);
  const [
    selectedOverviewRequirementDirty,
    setSelectedOverviewRequirementDirty,
  ] = useState(false);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [ticketDeleteBlocker, setTicketDeleteBlocker] =
    useState<TicketDeleteBlocker | null>(null);
  const [requirementDeleteBlocker, setRequirementDeleteBlocker] =
    useState<RequirementDeleteBlocker | null>(null);
  const loadProjectRequestId = useRef(0);

  const selectedTicket =
    tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;
  const selectedRequirement =
    requirements.find(
      (requirement) => requirement.id === selectedRequirementId,
    ) ?? null;
  const selectedOverviewRequirement =
    overview.requirements.find(
      (requirement) => requirement.id === selectedOverviewRequirementId,
    ) ?? null;

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
      projects: groupProjects.sort((a, b) =>
        a.project.project_name.localeCompare(b.project.project_name),
      ),
    })).sort((a, b) => a.country.localeCompare(b.country));
  }, [filteredProjects]);

  const filteredTickets = useMemo(() => {
    const query = globalQuery.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesDashboardFilter =
        ticketFilter === "all" ||
        (ticketFilter === "active" &&
          ["pending_internal", "pending_customer"].includes(ticket.status)) ||
        (ticketFilter === "pending_internal" &&
          ticket.status === "pending_internal") ||
        (ticketFilter === "urgent" && ticket.priority === "urgent");

      if (!matchesDashboardFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        ticket.id,
        ticket.title,
        ticket.summary,
        ticket.next_action,
        ticket.status,
        ticket.priority,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [tickets, globalQuery, ticketFilter]);

  const filteredRequirements = useMemo(() => {
    const query = globalQuery.trim().toLowerCase();
    if (!query) {
      return requirements;
    }
    return requirements.filter((requirement) =>
      [
        requirement.id,
        requirement.title,
        requirement.details,
        requirement.status,
        requirementStatusLabels[requirement.status],
        ...requirement.related_tickets,
        ...requirement.timeline.map((item) => `${item.time} ${item.remark}`),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [requirements, globalQuery]);

  const filteredOverviewRequirements = useMemo(() => {
    const query = globalQuery.trim().toLowerCase();
    if (!query) {
      return overview.requirements;
    }
    return overview.requirements.filter((requirement) =>
      [
        overview.description,
        ...overview.models,
        ...overview.others,
        requirement.id,
        requirement.product,
        ...requirement.simple_requirements,
        ...requirement.linked_requirements,
        requirement.remark,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [overview, globalQuery]);

  const metrics = useMemo(() => {
    return {
      total: tickets.length,
      active: tickets.filter((ticket) => ticket.status !== "resolved").length,
      pendingInternal: tickets.filter(
        (ticket) => ticket.status === "pending_internal",
      ).length,
      urgent: tickets.filter((ticket) => ticket.priority === "urgent").length,
    };
  }, [tickets]);

  const totalTicketPages = Math.max(
    1,
    Math.ceil(filteredTickets.length / TICKETS_PER_PAGE),
  );
  const visibleTicketPage = Math.min(ticketPage, totalTicketPages);
  const paginatedTickets = filteredTickets.slice(
    (visibleTicketPage - 1) * TICKETS_PER_PAGE,
    visibleTicketPage * TICKETS_PER_PAGE,
  );
  const totalRequirementPages = Math.max(
    1,
    Math.ceil(filteredRequirements.length / TICKETS_PER_PAGE),
  );
  const visibleRequirementPage = Math.min(
    requirementPage,
    totalRequirementPages,
  );
  const paginatedRequirements = filteredRequirements.slice(
    (visibleRequirementPage - 1) * TICKETS_PER_PAGE,
    visibleRequirementPage * TICKETS_PER_PAGE,
  );

  const dashboardTickets = useMemo(
    () => flattenDashboardTickets(dashboardData),
    [dashboardData],
  );
  const dashboardRequirements = useMemo(
    () => flattenDashboardRequirements(dashboardData),
    [dashboardData],
  );
  const filteredDashboardTickets = useMemo(
    () =>
      filterDashboardTickets(dashboardTickets, dashboardFilter, globalQuery),
    [dashboardTickets, dashboardFilter, globalQuery],
  );
  const filteredDashboardRequirements = useMemo(
    () =>
      filterDashboardRequirements(
        dashboardRequirements,
        dashboardFilter,
        globalQuery,
      ),
    [dashboardRequirements, dashboardFilter, globalQuery],
  );
  const totalDashboardTicketPages = Math.max(
    1,
    Math.ceil(filteredDashboardTickets.length / TICKETS_PER_PAGE),
  );
  const visibleDashboardTicketPage = Math.min(
    dashboardTicketPage,
    totalDashboardTicketPages,
  );
  const paginatedDashboardTickets = filteredDashboardTickets.slice(
    (visibleDashboardTicketPage - 1) * TICKETS_PER_PAGE,
    visibleDashboardTicketPage * TICKETS_PER_PAGE,
  );
  const totalDashboardRequirementPages = Math.max(
    1,
    Math.ceil(filteredDashboardRequirements.length / TICKETS_PER_PAGE),
  );
  const visibleDashboardRequirementPage = Math.min(
    dashboardRequirementPage,
    totalDashboardRequirementPages,
  );
  const paginatedDashboardRequirements = filteredDashboardRequirements.slice(
    (visibleDashboardRequirementPage - 1) * TICKETS_PER_PAGE,
    visibleDashboardRequirementPage * TICKETS_PER_PAGE,
  );

  function applyTicketFilter(filter: TicketFilter) {
    setTicketFilter(filter);
    setTicketPage(1);
    if (filter === "all") {
      setGlobalQuery("");
    }
  }

  function updateGlobalQuery(value: string) {
    setGlobalQuery(value);
    setTicketPage(1);
    setRequirementPage(1);
    setDashboardTicketPage(1);
    setDashboardRequirementPage(1);
  }

  function canDiscardTicketChanges() {
    return !selectedTicketDirty || confirm("Discard unsaved ticket changes?");
  }

  function canDiscardRequirementChanges() {
    return (
      !selectedRequirementDirty ||
      confirm("Discard unsaved requirement changes?")
    );
  }

  function canDiscardOverviewChanges() {
    return !overviewDirty || confirm("Discard unsaved overview changes?");
  }

  function canDiscardOverviewRequirementChanges() {
    return (
      !selectedOverviewRequirementDirty ||
      confirm("Discard unsaved overview item changes?")
    );
  }

  function canLeaveProjectWork() {
    return (
      canDiscardTicketChanges() &&
      canDiscardRequirementChanges() &&
      canDiscardOverviewChanges() &&
      canDiscardOverviewRequirementChanges()
    );
  }

  function closeSelectedTicket() {
    if (!canDiscardTicketChanges()) {
      return;
    }
    setSelectedTicketId("");
    setSelectedTicketDirty(false);
  }

  function closeSelectedRequirement() {
    if (!canDiscardRequirementChanges()) {
      return;
    }
    setSelectedRequirementId("");
    setSelectedRequirementDirty(false);
  }

  function openDashboard() {
    if (!canLeaveProjectWork()) {
      return;
    }
    setViewMode("dashboard");
    setSelectedTicketId("");
    setSelectedTicketDirty(false);
    setSelectedRequirementId("");
    setSelectedRequirementDirty(false);
    setSelectedOverviewRequirementId("");
    setOverviewDirty(false);
    setSelectedOverviewRequirementDirty(false);
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

  function selectRequirement(requirementId: string) {
    if (requirementId === selectedRequirementId) {
      return;
    }
    if (!canDiscardRequirementChanges()) {
      return;
    }
    setSelectedRequirementId(requirementId);
    setSelectedRequirementDirty(false);
  }

  function selectOverviewRequirement(requirementId: string) {
    if (requirementId === selectedOverviewRequirementId) {
      return;
    }
    if (!canDiscardOverviewRequirementChanges()) {
      return;
    }
    setSelectedOverviewRequirementId(requirementId);
    setSelectedOverviewRequirementDirty(false);
  }

  async function loadProject(
    folder: string,
    options: { ticketId?: string; requirementId?: string } = {},
  ) {
    if (!canLeaveProjectWork()) {
      return;
    }
    const requestId = loadProjectRequestId.current + 1;
    loadProjectRequestId.current = requestId;
    setSelectedFolder(folder);
    setSelectedTicketId("");
    setSelectedRequirementId("");
    setSelectedOverviewRequirementId("");
    setOverview(emptyOverview);
    setTickets([]);
    setRequirements([]);
    setSelectedTicketDirty(false);
    setSelectedRequirementDirty(false);
    setOverviewDirty(false);
    setSelectedOverviewRequirementDirty(false);
    setProjectMode("overview");
    setTicketPage(1);
    setRequirementPage(1);
    setViewMode("project");
    setError("");
    try {
      const data = await api<{ project: ProjectInfo; tickets: Ticket[] }>(
        `${projectApiPath(folder)}/tickets`,
      );
      if (loadProjectRequestId.current !== requestId) {
        return;
      }
      setSelectedProject(data.project);
      setTickets(data.tickets);
      const overviewData = await api<{ overview: Overview }>(
        `${projectApiPath(folder)}/overview`,
      );
      if (loadProjectRequestId.current !== requestId) {
        return;
      }
      setOverview(overviewData.overview);
      const requirementsData = await api<{ requirements: Requirement[] }>(
        `${projectApiPath(folder)}/requirements`,
      );
      if (loadProjectRequestId.current !== requestId) {
        return;
      }
      setRequirements(requirementsData.requirements);
      setProjectMode(
        options.ticketId
          ? "tickets"
          : options.requirementId
            ? "requirements"
            : "overview",
      );
      setSelectedTicketId(options.ticketId ?? "");
      setSelectedRequirementId(options.requirementId ?? "");
      rememberRecentProject(folder, data.project.project_name);
    } catch (requestError) {
      if (loadProjectRequestId.current !== requestId) {
        return;
      }
      setError((requestError as Error).message);
      setSelectedProject(null);
      setOverview(emptyOverview);
      setTickets([]);
      setRequirements([]);
    }
  }

  function switchProjectMode(mode: ProjectMode) {
    if (mode === projectMode) {
      return;
    }
    if (!canLeaveProjectWork()) {
      return;
    }
    setProjectMode(mode);
    setSelectedTicketId("");
    setSelectedRequirementId("");
    setSelectedOverviewRequirementId("");
    setSelectedTicketDirty(false);
    setSelectedRequirementDirty(false);
    setOverviewDirty(false);
    setSelectedOverviewRequirementDirty(false);
  }

  async function refreshDashboard() {
    const data = await api<DashboardData>("/api/dashboard");
    setDashboardData(data);
    setProjects(
      data.projects.map(({ folder, project }) => ({ folder, project })),
    );
  }

  function refreshDashboardQuietly() {
    void refreshDashboard().catch((requestError) =>
      setError((requestError as Error).message),
    );
  }

  function rememberRecentProject(folder: string, projectName: string) {
    const nextRecent = [
      { folder, projectName, viewedAt: new Date().toISOString() },
      ...recentProjects.filter((project) => project.folder !== folder),
    ].slice(0, 5);
    setRecentProjects(nextRecent);
    window.localStorage.setItem(
      RECENT_PROJECTS_KEY,
      JSON.stringify(nextRecent),
    );
  }

  function openDashboardTicket(item: DashboardTicket) {
    void loadProject(item.folder, { ticketId: item.ticket.id });
  }

  function openDashboardRequirement(item: DashboardRequirement) {
    void loadProject(item.folder, { requirementId: item.requirement.id });
  }

  async function generateDashboardReport(draft: ReportGenerateDraft) {
    const result = await api<ReportGenerateResponse>("/api/reports/generate", {
      method: "POST",
      body: JSON.stringify(draft),
    });
    if (result.status === "sent") {
      setToast("Report sent to email.");
    }
    return result;
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
        setProjects(
          data.projects.map(({ folder, project }) => ({ folder, project })),
        );
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
      const data = await api<{ ticket: Ticket }>(
        `${projectApiPath(selectedFolder)}/tickets`,
        {
          method: "POST",
          body: JSON.stringify(draft),
        },
      );
      setTickets((current) => [data.ticket, ...current]);
      setTicketPage(1);
      setSelectedTicketId(data.ticket.id);
      setShowNewTicket(false);
      refreshDashboardQuietly();
    } finally {
      setSaving(false);
    }
  }

  async function updateTicket(
    ticketId: string,
    draft: TicketDraft,
    options: { showSuccessToast?: boolean } = {},
  ) {
    setSaving(true);
    try {
      const data = await api<{ ticket: Ticket }>(
        `${projectApiPath(selectedFolder)}/tickets/${ticketId}`,
        {
          method: "PUT",
          body: JSON.stringify(draft),
        },
      );
      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === ticketId ? data.ticket : ticket,
        ),
      );
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
    await updateTicket(
      ticket.id,
      {
        ...ticketToDraft(ticket),
        next_action: nextActionDraft,
      },
      { showSuccessToast: false },
    );
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
      await api(`${projectApiPath(selectedFolder)}/tickets/${ticketId}`, {
        method: "DELETE",
      });
      setTickets((current) =>
        current.filter((ticket) => ticket.id !== ticketId),
      );
      setSelectedTicketId("");
      refreshDashboardQuietly();
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.data?.code === "TICKET_LINKED_TO_REQUIREMENTS"
      ) {
        setTicketDeleteBlocker({
          ticketId,
          requirements: Array.isArray(error.data.requirements)
            ? error.data.requirements
            : [],
        });
        return;
      }
      setError((error as Error).message);
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
      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === ticketId ? data.ticket : ticket,
        ),
      );
      refreshDashboardQuietly();
    } finally {
      setSaving(false);
    }
  }

  async function updateEvent(
    ticketId: string,
    index: number,
    draft: EventDraft,
  ) {
    setSaving(true);
    try {
      const data = await api<{ ticket: Ticket }>(
        `${projectApiPath(selectedFolder)}/tickets/${ticketId}/events/${index}`,
        {
          method: "PUT",
          body: JSON.stringify(eventDraftForApi(draft)),
        },
      );
      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === ticketId ? data.ticket : ticket,
        ),
      );
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
      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === ticketId ? data.ticket : ticket,
        ),
      );
      refreshDashboardQuietly();
    } finally {
      setSaving(false);
    }
  }

  async function createRequirement(draft: RequirementDraft) {
    if (!selectedFolder) {
      return;
    }
    setSaving(true);
    try {
      const data = await api<{ requirement: Requirement }>(
        `${projectApiPath(selectedFolder)}/requirements`,
        {
          method: "POST",
          body: JSON.stringify(requirementDraftForApi(draft)),
        },
      );
      setRequirements((current) => [data.requirement, ...current]);
      setRequirementPage(1);
      setSelectedRequirementId(data.requirement.id);
      setShowNewRequirement(false);
      refreshDashboardQuietly();
    } finally {
      setSaving(false);
    }
  }

  async function updateOverviewSettings(draft: OverviewSettingsDraft) {
    if (!selectedFolder) {
      return;
    }
    setSaving(true);
    try {
      const data = await api<{ overview: Overview }>(
        `${projectApiPath(selectedFolder)}/overview`,
        {
          method: "PUT",
          body: JSON.stringify(draft),
        },
      );
      setOverview(data.overview);
      setOverviewDirty(false);
      showToast("Overview changes saved.");
    } finally {
      setSaving(false);
    }
  }

  async function createOverviewRequirement(draft: OverviewRequirementDraft) {
    if (!selectedFolder) {
      return;
    }
    setSaving(true);
    try {
      const data = await api<{ requirement: OverviewRequirement }>(
        `${projectApiPath(selectedFolder)}/overview/requirements`,
        {
          method: "POST",
          body: JSON.stringify(overviewRequirementDraftForApi(draft)),
        },
      );
      setOverview((current) => ({
        ...current,
        requirements: [data.requirement, ...current.requirements],
      }));
      setSelectedOverviewRequirementId(data.requirement.id);
      setShowNewOverviewRequirement(false);
    } finally {
      setSaving(false);
    }
  }

  function generateProjectJson(draft: ProjectJsonDraft) {
    const project: ProjectInfo = {
      project_id: createUuid(),
      project_name: draft.project_name.trim(),
      country: draft.country.trim(),
      customer: draft.customer.trim(),
      sales: draft.sales.trim(),
      created_at: draft.created_at,
    };
    setGeneratedProjectJson(`${JSON.stringify(project, null, 2)}\n`);
    setShowProjectJsonGenerator(false);
  }

  function generateProjectSummary() {
    if (!selectedProject) {
      return;
    }
    setGeneratedProjectSummary(
      buildProjectSummary(selectedProject, overview, requirements, tickets),
    );
  }

  async function updateOverviewRequirement(
    requirementId: string,
    draft: OverviewRequirementDraft,
  ) {
    setSaving(true);
    try {
      const data = await api<{ requirement: OverviewRequirement }>(
        `${projectApiPath(selectedFolder)}/overview/requirements/${requirementId}`,
        {
          method: "PUT",
          body: JSON.stringify(overviewRequirementDraftForApi(draft)),
        },
      );
      setOverview((current) => ({
        ...current,
        requirements: current.requirements.map((requirement) =>
          requirement.id === requirementId ? data.requirement : requirement,
        ),
      }));
      showToast("Overview item changes saved.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteOverviewRequirement(requirementId: string) {
    if (
      !confirm(
        "Delete this overview item? This writes directly to overview.json.",
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await api(
        `${projectApiPath(selectedFolder)}/overview/requirements/${requirementId}`,
        { method: "DELETE" },
      );
      setOverview((current) => ({
        ...current,
        requirements: current.requirements.filter(
          (requirement) => requirement.id !== requirementId,
        ),
      }));
      setSelectedOverviewRequirementId("");
    } finally {
      setSaving(false);
    }
  }

  async function updateRequirement(
    requirementId: string,
    draft: RequirementDraft,
  ) {
    setSaving(true);
    try {
      const data = await api<{ requirement: Requirement }>(
        `${projectApiPath(selectedFolder)}/requirements/${requirementId}`,
        {
          method: "PUT",
          body: JSON.stringify(requirementDraftForApi(draft)),
        },
      );
      setRequirements((current) =>
        current.map((requirement) =>
          requirement.id === requirementId ? data.requirement : requirement,
        ),
      );
      refreshDashboardQuietly();
      showToast("Requirement changes saved.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRequirement(requirementId: string) {
    if (
      !confirm(
        "Delete this requirement? This writes directly to requirements.json.",
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await api(
        `${projectApiPath(selectedFolder)}/requirements/${requirementId}`,
        { method: "DELETE" },
      );
      setRequirements((current) =>
        current.filter((requirement) => requirement.id !== requirementId),
      );
      setSelectedRequirementId("");
      refreshDashboardQuietly();
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.data?.code === "REQUIREMENT_LINKED_TO_OVERVIEW"
      ) {
        setRequirementDeleteBlocker({
          requirementId,
          overviewRequirements: Array.isArray(error.data.overviewRequirements)
            ? error.data.overviewRequirements
            : [],
        });
        return;
      }
      setError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function addRequirementTimeline(
    requirementId: string,
    draft: RequirementTimelineDraft,
  ) {
    setSaving(true);
    try {
      const data = await api<{ requirement: Requirement }>(
        `${projectApiPath(selectedFolder)}/requirements/${requirementId}/timeline`,
        {
          method: "POST",
          body: JSON.stringify(requirementTimelineDraftForApi(draft)),
        },
      );
      setRequirements((current) =>
        current.map((requirement) =>
          requirement.id === requirementId ? data.requirement : requirement,
        ),
      );
      refreshDashboardQuietly();
    } finally {
      setSaving(false);
    }
  }

  async function updateRequirementTimeline(
    requirementId: string,
    index: number,
    draft: RequirementTimelineDraft,
  ) {
    setSaving(true);
    try {
      const data = await api<{ requirement: Requirement }>(
        `${projectApiPath(selectedFolder)}/requirements/${requirementId}/timeline/${index}`,
        {
          method: "PUT",
          body: JSON.stringify(requirementTimelineDraftForApi(draft)),
        },
      );
      setRequirements((current) =>
        current.map((requirement) =>
          requirement.id === requirementId ? data.requirement : requirement,
        ),
      );
      refreshDashboardQuietly();
    } finally {
      setSaving(false);
    }
  }

  async function deleteRequirementTimeline(
    requirementId: string,
    index: number,
  ) {
    setSaving(true);
    try {
      const data = await api<{ requirement: Requirement }>(
        `${projectApiPath(selectedFolder)}/requirements/${requirementId}/timeline/${index}`,
        { method: "DELETE" },
      );
      setRequirements((current) =>
        current.map((requirement) =>
          requirement.id === requirementId ? data.requirement : requirement,
        ),
      );
      refreshDashboardQuietly();
    } finally {
      setSaving(false);
    }
  }

  function openRelatedTicket(ticketId: string) {
    const ticket = tickets.find((current) => current.id === ticketId);
    if (!ticket) {
      return;
    }
    if (!canDiscardRequirementChanges()) {
      return;
    }
    setProjectMode("tickets");
    setSelectedRequirementId("");
    setSelectedRequirementDirty(false);
    setSelectedTicketId(ticket.id);
  }

  function openLinkedRequirement(requirementId: string) {
    const requirement = requirements.find(
      (current) => current.id === requirementId,
    );
    if (!requirement) {
      return;
    }
    if (
      !canDiscardTicketChanges() ||
      !canDiscardRequirementChanges() ||
      !canDiscardOverviewChanges() ||
      !canDiscardOverviewRequirementChanges()
    ) {
      return;
    }
    setProjectMode("requirements");
    setSelectedTicketId("");
    setSelectedTicketDirty(false);
    setSelectedOverviewRequirementId("");
    setOverviewDirty(false);
    setSelectedOverviewRequirementDirty(false);
    setSelectedRequirementId(requirement.id);
  }

  function openLinkedOverviewRequirement(requirementId: string) {
    const requirement = overview.requirements.find(
      (current) => current.id === requirementId,
    );
    if (!requirement) {
      return;
    }
    if (
      !canDiscardTicketChanges() ||
      !canDiscardRequirementChanges() ||
      !canDiscardOverviewRequirementChanges()
    ) {
      return;
    }
    setProjectMode("overview");
    setSelectedTicketId("");
    setSelectedTicketDirty(false);
    setSelectedRequirementId("");
    setSelectedRequirementDirty(false);
    setSelectedOverviewRequirementId(requirement.id);
    setSelectedOverviewRequirementDirty(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8fb] text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 shadow-sm shadow-slate-200/40 backdrop-blur">
        <div className="flex min-h-16 items-center gap-3 px-4 py-2 lg:px-5">
          <button
            type="button"
            onClick={openDashboard}
            className="group flex min-w-0 items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-slate-50"
            aria-label="Open dashboard"
          >
            <Image
              src="/patrick.png"
              alt="Urovo Projects"
              width={44}
              height={44}
              className="h-10 w-10 rounded-xl object-cover ring-1 ring-slate-200 transition group-hover:ring-slate-300"
              priority
            />
            <div className="min-w-0">
              <div className="truncate text-base font-semibold tracking-tight text-slate-950">
                Urovo Projects
              </div>
              <div className="truncate text-xs font-medium text-slate-500">
                {viewMode === "dashboard"
                  ? "Dashboard"
                  : selectedProject?.project_name || "Project workspace"}
              </div>
            </div>
          </button>

          <div className="hidden h-9 shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 lg:flex">
            {viewMode === "dashboard"
              ? dashboardModeLabel(dashboardMode)
              : projectModeLabel(projectMode)}
          </div>

          <label className="relative ml-auto hidden w-full max-w-lg md:block">
            <span className="sr-only">
              {viewMode === "dashboard"
                ? dashboardMode === "requirements"
                  ? "Search all requirements"
                  : "Search all tickets"
                : projectMode === "overview"
                  ? "Search demand"
                  : projectMode === "requirements"
                    ? "Search requirements"
                    : "Search tickets"}
            </span>
            <input
              value={globalQuery}
              onChange={(event) => updateGlobalQuery(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm shadow-inner shadow-slate-200/50 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:shadow-sm"
              placeholder={
                viewMode === "dashboard"
                  ? dashboardMode === "requirements"
                    ? "Search all requirements"
                    : "Search all tickets"
                  : projectMode === "overview"
                    ? "Search demand"
                    : projectMode === "requirements"
                      ? "Search requirements"
                      : "Search tickets"
              }
            />
          </label>
          {viewMode === "project" && selectedFolder ? (
            <div className="grid shrink-0 grid-cols-1 gap-2 sm:flex sm:items-center">
              <button
                onClick={() =>
                  projectMode === "overview"
                    ? setShowNewOverviewRequirement(true)
                    : projectMode === "requirements"
                      ? setShowNewRequirement(true)
                      : setShowNewTicket(true)
                }
                className="h-10 shrink-0 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm shadow-slate-300 transition hover:bg-slate-800"
              >
                {projectMode === "overview"
                  ? "New Demand"
                  : projectMode === "requirements"
                    ? "New Requirement"
                    : "New Ticket"}
              </button>
              <button
                type="button"
                onClick={generateProjectSummary}
                className="h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
              >
                Generate Summary
              </button>
            </div>
          ) : viewMode === "dashboard" ? (
            <button
              type="button"
              onClick={() => setShowGenerateReport(true)}
              className="h-10 shrink-0 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm shadow-slate-300 transition hover:bg-slate-800"
            >
              Generate Report
            </button>
          ) : null}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white p-4 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Projects
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowProjectJsonGenerator(true)}
                className="grid h-6 w-6 place-items-center rounded-md border border-slate-200 bg-white text-base leading-none text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
                aria-label="Generate project JSON"
              >
                +
              </button>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500">
                {projects.length}
              </span>
            </div>
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
              mode={dashboardMode}
              onModeChange={(mode) => {
                setDashboardMode(mode);
                setDashboardFilter("all");
                setDashboardTicketPage(1);
                setDashboardRequirementPage(1);
              }}
              tickets={paginatedDashboardTickets}
              ticketCount={filteredDashboardTickets.length}
              requirements={paginatedDashboardRequirements}
              requirementCount={filteredDashboardRequirements.length}
              page={
                dashboardMode === "requirements"
                  ? visibleDashboardRequirementPage
                  : visibleDashboardTicketPage
              }
              totalPages={
                dashboardMode === "requirements"
                  ? totalDashboardRequirementPages
                  : totalDashboardTicketPages
              }
              allTickets={dashboardTickets}
              allRequirements={dashboardRequirements}
              activeFilter={dashboardFilter}
              onFilterChange={(filter) => {
                setDashboardFilter(filter);
                setDashboardTicketPage(1);
                setDashboardRequirementPage(1);
              }}
              onPreviousPage={() =>
                dashboardMode === "requirements"
                  ? setDashboardRequirementPage((current) =>
                      Math.max(1, current - 1),
                    )
                  : setDashboardTicketPage((current) =>
                      Math.max(1, current - 1),
                    )
              }
              onNextPage={() =>
                dashboardMode === "requirements"
                  ? setDashboardRequirementPage((current) =>
                      Math.min(totalDashboardRequirementPages, current + 1),
                    )
                  : setDashboardTicketPage((current) =>
                      Math.min(totalDashboardTicketPages, current + 1),
                    )
              }
              onOpenProject={(folder) => void loadProject(folder)}
              onOpenTicket={openDashboardTicket}
              onOpenRequirement={openDashboardRequirement}
            />
          ) : selectedProject ? (
            <>
              <ProjectHeader
                project={selectedProject}
                mode={projectMode}
                onModeChange={switchProjectMode}
              />
              {projectMode === "overview" ? (
                <OverviewWorkspace
                  key={selectedFolder}
                  overview={overview}
                  requirements={filteredOverviewRequirements}
                  allRequirements={requirements}
                  selectedRequirementId={selectedOverviewRequirementId}
                  saving={saving}
                  onSettingsDirtyChange={setOverviewDirty}
                  onSaveSettings={updateOverviewSettings}
                  onSelect={selectOverviewRequirement}
                  onOpenRequirement={openLinkedRequirement}
                />
              ) : projectMode === "tickets" ? (
                <>
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
                      <h2 className="text-sm font-semibold text-slate-900">
                        Ticket Dashboard
                      </h2>
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
                          isEditingNextAction={
                            ticket.id === editingNextActionId
                          }
                          nextActionDraft={nextActionDraft}
                          onStartNextActionEdit={() =>
                            startNextActionEdit(ticket)
                          }
                          onNextActionDraftChange={setNextActionDraft}
                          onSaveNextAction={() => void saveNextAction(ticket)}
                        />
                      ))}
                    </div>
                    {filteredTickets.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center">
                        <div className="text-sm font-medium text-slate-900">
                          No tickets to show
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          Create a ticket or adjust the search filter.
                        </p>
                      </div>
                    ) : null}
                    {filteredTickets.length > TICKETS_PER_PAGE ? (
                      <Pagination
                        page={visibleTicketPage}
                        totalPages={totalTicketPages}
                        onPrevious={() =>
                          setTicketPage((current) => Math.max(1, current - 1))
                        }
                        onNext={() =>
                          setTicketPage((current) =>
                            Math.min(totalTicketPages, current + 1),
                          )
                        }
                      />
                    ) : null}
                  </section>
                </>
              ) : (
                <RequirementsWorkspace
                  requirements={paginatedRequirements}
                  totalRequirements={filteredRequirements.length}
                  page={visibleRequirementPage}
                  totalPages={totalRequirementPages}
                  selectedRequirementId={selectedRequirementId}
                  onSelect={selectRequirement}
                  onPreviousPage={() =>
                    setRequirementPage((current) => Math.max(1, current - 1))
                  }
                  onNextPage={() =>
                    setRequirementPage((current) =>
                      Math.min(totalRequirementPages, current + 1),
                    )
                  }
                />
              )}
            </>
          ) : (
            <div className="grid min-h-[60vh] place-items-center rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center">
              <div>
                <h1 className="text-lg font-semibold">Select a project</h1>
                <p className="mt-2 max-w-md text-sm text-slate-500">
                  The sidebar reads country folders from `PROJECTS_ROOT` and
                  lists one layer of `proj_` project folders inside them.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {selectedTicket ? (
        <TicketDrawer
          ticket={selectedTicket}
          assetApiPath={`${projectApiPath(selectedFolder)}/tickets/${selectedTicket.id}/assets`}
          browseApiPath={`${projectApiPath(selectedFolder)}/references/browse`}
          referenceApiPath={`${projectApiPath(selectedFolder)}/tickets/${selectedTicket.id}/references`}
          saving={saving}
          onClose={closeSelectedTicket}
          onDirtyChange={setSelectedTicketDirty}
          onSave={(draft) => updateTicket(selectedTicket.id, draft)}
          onDelete={() => void deleteTicket(selectedTicket.id)}
          onAddEvent={(draft) => void addEvent(selectedTicket.id, draft)}
          onUpdateEvent={(index, draft) =>
            void updateEvent(selectedTicket.id, index, draft)
          }
          onDeleteEvent={(index) => void deleteEvent(selectedTicket.id, index)}
        />
      ) : null}

      {selectedRequirement ? (
        <RequirementDrawer
          requirement={selectedRequirement}
          assetApiPath={`${projectApiPath(selectedFolder)}/requirements/${selectedRequirement.id}/assets`}
          browseApiPath={`${projectApiPath(selectedFolder)}/references/browse`}
          referenceApiPath={`${projectApiPath(selectedFolder)}/requirements/${selectedRequirement.id}/references`}
          tickets={tickets}
          saving={saving}
          onClose={closeSelectedRequirement}
          onDirtyChange={setSelectedRequirementDirty}
          onSave={(draft) => updateRequirement(selectedRequirement.id, draft)}
          onDelete={() => void deleteRequirement(selectedRequirement.id)}
          onOpenTicket={openRelatedTicket}
          onAddTimeline={(draft) =>
            void addRequirementTimeline(selectedRequirement.id, draft)
          }
          onUpdateTimeline={(index, draft) =>
            void updateRequirementTimeline(selectedRequirement.id, index, draft)
          }
          onDeleteTimeline={(index) =>
            void deleteRequirementTimeline(selectedRequirement.id, index)
          }
        />
      ) : null}

      {selectedOverviewRequirement ? (
        <OverviewRequirementDrawer
          requirement={selectedOverviewRequirement}
          products={[...overview.models, ...overview.others]}
          requirements={requirements}
          saving={saving}
          onClose={() => {
            if (!canDiscardOverviewRequirementChanges()) {
              return;
            }
            setSelectedOverviewRequirementId("");
            setSelectedOverviewRequirementDirty(false);
          }}
          onDirtyChange={setSelectedOverviewRequirementDirty}
          onSave={(draft) =>
            updateOverviewRequirement(selectedOverviewRequirement.id, draft)
          }
          onDelete={() =>
            void deleteOverviewRequirement(selectedOverviewRequirement.id)
          }
          onOpenRequirement={openLinkedRequirement}
        />
      ) : null}

      {showNewTicket ? (
        <TicketModal
          saving={saving}
          onClose={() => setShowNewTicket(false)}
          onCreate={createTicket}
        />
      ) : null}

      {showNewRequirement ? (
        <RequirementModal
          saving={saving}
          onClose={() => setShowNewRequirement(false)}
          onCreate={createRequirement}
        />
      ) : null}

      {showNewOverviewRequirement ? (
        <OverviewRequirementModal
          products={[...overview.models, ...overview.others]}
          requirements={requirements}
          saving={saving}
          onClose={() => setShowNewOverviewRequirement(false)}
          onCreate={createOverviewRequirement}
        />
      ) : null}

      {showProjectJsonGenerator ? (
        <ProjectJsonGeneratorDialog
          onClose={() => setShowProjectJsonGenerator(false)}
          onGenerate={generateProjectJson}
        />
      ) : null}

      {showGenerateReport ? (
        <GenerateReportDialog
          onClose={() => setShowGenerateReport(false)}
          onGenerate={generateDashboardReport}
        />
      ) : null}

      {generatedProjectJson ? (
        <ProjectJsonResultDialog
          json={generatedProjectJson}
          onClose={() => setGeneratedProjectJson("")}
        />
      ) : null}

      {generatedProjectSummary ? (
        <ProjectSummaryDialog
          summary={generatedProjectSummary}
          onClose={() => setGeneratedProjectSummary("")}
        />
      ) : null}

      {ticketDeleteBlocker ? (
        <TicketDeleteBlockedDialog
          blocker={ticketDeleteBlocker}
          onClose={() => setTicketDeleteBlocker(null)}
          onOpenRequirement={(requirementId) => {
            setTicketDeleteBlocker(null);
            openLinkedRequirement(requirementId);
          }}
        />
      ) : null}

      {requirementDeleteBlocker ? (
        <RequirementDeleteBlockedDialog
          blocker={requirementDeleteBlocker}
          onClose={() => setRequirementDeleteBlocker(null)}
          onOpenOverviewRequirement={(requirementId) => {
            setRequirementDeleteBlocker(null);
            openLinkedOverviewRequirement(requirementId);
          }}
        />
      ) : null}

      {toast ? <Toast message={toast} /> : null}
    </div>
  );
}
