"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { APP_TIME_ZONE, beijingTodayDate } from "@/lib/time";
import {
  DashboardData,
  EVENT_ROLES,
  EventRole,
  Overview,
  OverviewRequirement,
  PRIORITIES,
  ProjectInfo,
  ProjectListItem,
  Requirement,
  RequirementStatus,
  RequirementTimelineItem,
  REQUIREMENT_STATUSES,
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

type RequirementDraft = {
  title: string;
  status: RequirementStatus;
  details: string;
  related_tickets: string[];
};

type RequirementTimelineDraft = {
  time: string;
  remark: string;
};

type OverviewSettingsDraft = {
  models: string[];
  others: string[];
  description: string;
};

type OverviewRequirementDraft = {
  product: string;
  simple_requirements: string[];
  linked_requirements: string[];
  remark: string;
};

type ProjectGroup = {
  country: string;
  projects: ProjectListItem[];
};

type ViewMode = "dashboard" | "project";
type ProjectMode = "overview" | "tickets" | "requirements";

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

type LinkedRequirementSummary = Pick<Requirement, "id" | "title">;

type TicketDeleteBlocker = {
  ticketId: string;
  requirements: LinkedRequirementSummary[];
};

type LinkedOverviewRequirementSummary = Pick<
  OverviewRequirement,
  "id" | "product" | "remark"
>;

type RequirementDeleteBlocker = {
  requirementId: string;
  overviewRequirements: LinkedOverviewRequirementSummary[];
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

const emptyRequirementDraft: RequirementDraft = {
  title: "",
  status: "in_progress",
  details: "",
  related_tickets: [],
};

const emptyRequirementTimelineDraft: RequirementTimelineDraft = {
  time: todayDate(),
  remark: "",
};

const emptyOverview: Overview = {
  models: [],
  others: [],
  description: "",
  requirements: [],
};

const emptyOverviewRequirementDraft: OverviewRequirementDraft = {
  product: "",
  simple_requirements: [],
  linked_requirements: [],
  remark: "",
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

const requirementStatusLabels: Record<RequirementStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  testing: "Testing",
  finished: "Finished",
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
  const [projectMode, setProjectMode] = useState<ProjectMode>("tickets");
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
  const [editingNextActionId, setEditingNextActionId] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [selectedTicketDirty, setSelectedTicketDirty] = useState(false);
  const [selectedRequirementDirty, setSelectedRequirementDirty] =
    useState(false);
  const [overviewDirty, setOverviewDirty] = useState(false);
  const [selectedOverviewRequirementDirty, setSelectedOverviewRequirementDirty] =
    useState(false);
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
  const filteredDashboardTickets = useMemo(
    () =>
      filterDashboardTickets(dashboardTickets, dashboardFilter, globalQuery),
    [dashboardTickets, dashboardFilter, globalQuery],
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
    options: { ticketId?: string } = {},
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
      setProjectMode(options.ticketId ? "tickets" : "overview");
      setSelectedTicketId(options.ticketId ?? "");
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
    if (!confirm("Delete this overview item? This writes directly to overview.json.")) {
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
    const requirement = requirements.find((current) => current.id === requirementId);
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
            <div className="text-lg font-semibold tracking-tight text-slate-950">
              Urovo Projects
            </div>
          </div>
        </button>
        <label className="relative hidden w-full max-w-md md:block">
          <span className="sr-only">
            {viewMode === "dashboard"
              ? "Search all tickets"
              : projectMode === "overview"
                ? "Search demand"
                : projectMode === "requirements"
                ? "Search requirements"
                : "Search tickets"}
          </span>
          <input
            value={globalQuery}
            onChange={(event) => updateGlobalQuery(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
            placeholder={
              viewMode === "dashboard"
                ? "Search all tickets"
                : projectMode === "overview"
                  ? "Search demand"
                  : projectMode === "requirements"
                  ? "Search requirements"
                  : "Search tickets"
            }
          />
        </label>
        <button
          onClick={() =>
            projectMode === "overview"
              ? setShowNewOverviewRequirement(true)
              : projectMode === "requirements"
              ? setShowNewRequirement(true)
              : setShowNewTicket(true)
          }
          disabled={viewMode !== "project" || !selectedFolder}
          className="h-10 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {projectMode === "overview"
            ? "New Demand"
            : projectMode === "requirements"
              ? "New Requirement"
              : "New Ticket"}
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white p-4 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Projects
            </h2>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500">
              {projects.length}
            </span>
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
              tickets={paginatedDashboardTickets}
              ticketCount={filteredDashboardTickets.length}
              page={visibleDashboardTicketPage}
              totalPages={totalDashboardTicketPages}
              allTickets={dashboardTickets}
              activeFilter={dashboardFilter}
              onFilterChange={(filter) => {
                setDashboardFilter(filter);
                setDashboardTicketPage(1);
              }}
              onPreviousPage={() =>
                setDashboardTicketPage((current) => Math.max(1, current - 1))
              }
              onNextPage={() =>
                setDashboardTicketPage((current) =>
                  Math.min(totalDashboardTicketPages, current + 1),
                )
              }
              onOpenProject={(folder) => void loadProject(folder)}
              onOpenTicket={openDashboardTicket}
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

function TicketDeleteBlockedDialog({
  blocker,
  onClose,
  onOpenRequirement,
}: {
  blocker: TicketDeleteBlocker;
  onClose: () => void;
  onOpenRequirement: (requirementId: string) => void;
}) {
  return (
    <Overlay>
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Ticket cannot be deleted
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              [{blocker.ticketId}] is linked to the requirement records below.
              Remove the related ticket link from each requirement first.
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

        <div className="mt-4 space-y-2">
          {blocker.requirements.map((requirement) => (
            <button
              key={requirement.id}
              type="button"
              onClick={() => onOpenRequirement(requirement.id)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-white"
            >
              <div className="text-sm font-semibold text-slate-950">
                [{requirement.id}]: {requirement.title || "Untitled requirement"}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Open requirement detail
              </div>
            </button>
          ))}
          {blocker.requirements.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              No requirement details were returned. Refresh and try again.
            </div>
          ) : null}
        </div>
      </div>
    </Overlay>
  );
}

function RequirementDeleteBlockedDialog({
  blocker,
  onClose,
  onOpenOverviewRequirement,
}: {
  blocker: RequirementDeleteBlocker;
  onClose: () => void;
  onOpenOverviewRequirement: (requirementId: string) => void;
}) {
  return (
    <Overlay>
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Requirement cannot be deleted
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              [{blocker.requirementId}] is linked to the overview items below.
              Remove the linked requirement from each overview item first.
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

        <div className="mt-4 space-y-2">
          {blocker.overviewRequirements.map((requirement) => (
            <button
              key={requirement.id}
              type="button"
              onClick={() => onOpenOverviewRequirement(requirement.id)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-white"
            >
              <div className="text-sm font-semibold text-slate-950">
                [{requirement.id}]: {requirement.product || "Overview item"}
              </div>
              {requirement.remark ? (
                <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                  {requirement.remark}
                </div>
              ) : (
                <div className="mt-1 text-xs text-slate-500">
                  Open overview item
                </div>
              )}
            </button>
          ))}
          {blocker.overviewRequirements.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              No overview item details were returned. Refresh and try again.
            </div>
          ) : null}
        </div>
      </div>
    </Overlay>
  );
}

function ProjectHeader({
  project,
  mode,
  onModeChange,
}: {
  project: ProjectInfo;
  mode: ProjectMode;
  onModeChange: (mode: ProjectMode) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {project.project_name}
            </h1>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
              {project.sales || "Unknown"}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-400">
            Created at {formatDate(project.created_at)}
          </div>
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          {(["overview", "tickets", "requirements"] as const).map((item) => (
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
              {projectModeLabel(item)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function OverviewWorkspace({
  overview,
  requirements,
  allRequirements,
  selectedRequirementId,
  saving,
  onSettingsDirtyChange,
  onSaveSettings,
  onSelect,
  onOpenRequirement,
}: {
  overview: Overview;
  requirements: OverviewRequirement[];
  allRequirements: Requirement[];
  selectedRequirementId: string;
  saving: boolean;
  onSettingsDirtyChange: (dirty: boolean) => void;
  onSaveSettings: (draft: OverviewSettingsDraft) => void | Promise<void>;
  onSelect: (requirementId: string) => void;
  onOpenRequirement: (requirementId: string) => void;
}) {
  return (
    <div className="mt-6 space-y-5">
      <OverviewSettingsPanel
        key={overviewSettingsKey(overview)}
        overview={overview}
        saving={saving}
        onDirtyChange={onSettingsDirtyChange}
        onSave={onSaveSettings}
      />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Product demands
          </h2>
          <span className="text-xs text-slate-500">
            {requirements.length} shown
          </span>
        </div>
        <div className="space-y-3">
          {requirements.map((requirement) => (
            <OverviewRequirementCard
              key={requirement.id}
              requirement={requirement}
              active={requirement.id === selectedRequirementId}
              requirements={allRequirements}
              onClick={() => onSelect(requirement.id)}
              onOpenRequirement={onOpenRequirement}
            />
          ))}
        </div>
        {requirements.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center">
            <div className="text-sm font-medium text-slate-900">
              No product demands yet
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Add models, services, description, or product demand rows.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function OverviewSettingsPanel({
  overview,
  saving,
  onDirtyChange,
  onSave,
}: {
  overview: Overview;
  saving: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (draft: OverviewSettingsDraft) => void | Promise<void>;
}) {
  const initial = overviewToSettingsDraft(overview);
  const [draft, setDraft] = useState<OverviewSettingsDraft>(initial);

  async function updateAndSave(nextDraft: OverviewSettingsDraft) {
    setDraft(nextDraft);
    await onSave(nextDraft);
    onDirtyChange(false);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-4">
        <ProductListEditor
          label="Models"
          values={draft.models}
          saving={saving}
          onChange={(models) => updateAndSave({ ...draft, models })}
        />
        <ProductListEditor
          label="Services"
          values={draft.others}
          saving={saving}
          onChange={(others) => updateAndSave({ ...draft, others })}
        />
        <DescriptionEditor
          value={draft.description}
          saving={saving}
          onDirtyChange={onDirtyChange}
          onSave={(description) => updateAndSave({ ...draft, description })}
        />
      </div>
    </section>
  );
}

function ProductListEditor({
  label,
  values,
  saving,
  onChange,
}: {
  label: string;
  values: string[];
  saving: boolean;
  onChange: (values: string[]) => void | Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [value, setValue] = useState("");

  async function addValue() {
    const nextValue = value.trim();
    if (!nextValue || values.includes(nextValue)) {
      return;
    }
    await onChange([...values, nextValue]);
    setValue("");
    setAdding(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="mr-1 text-xs font-medium text-slate-600">{label}</div>
      {values.length > 0 ? (
        values.map((item) => (
          <span
            key={item}
            className={`relative inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 ${
              deleting ? "pr-5" : ""
            }`}
          >
            {item}
            {deleting ? (
              <button
                type="button"
                onClick={() =>
                  void onChange(values.filter((current) => current !== item))
                }
                disabled={saving}
                className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[10px] font-semibold leading-none text-white hover:bg-red-700 disabled:opacity-60"
                aria-label={`Remove ${item}`}
              >
                x
              </button>
            ) : null}
          </span>
        ))
      ) : (
        <span className="text-sm text-slate-500">
          No {label.toLowerCase()} listed.
        </span>
      )}
      <button
        type="button"
        onClick={() => setAdding(true)}
        disabled={saving}
        className="ml-auto rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950 disabled:opacity-60"
      >
        Add
      </button>
      <button
        type="button"
        onClick={() => setDeleting((current) => !current)}
        disabled={saving || values.length === 0}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950 disabled:opacity-60"
      >
        {deleting ? "Cancel" : "Delete"}
      </button>
      {adding ? (
        <Overlay>
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add {label}</h3>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setValue("");
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
              >
                Close
              </button>
            </div>
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void addValue();
                }
              }}
              className="form-input"
              placeholder={`Add ${label.toLowerCase()}`}
              autoFocus
            />
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => void addValue()}
                disabled={saving || !value.trim()}
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Add"}
              </button>
            </div>
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}

function DescriptionEditor({
  value,
  saving,
  onDirtyChange,
  onSave,
}: {
  value: string;
  saving: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (value: string) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  async function saveDescription() {
    const nextValue = draft.trim();
    setEditing(false);
    if (nextValue === value) {
      onDirtyChange(false);
      return;
    }
    await onSave(nextValue);
    onDirtyChange(false);
  }

  if (editing) {
    return (
      <Field label="Description">
        <textarea
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            onDirtyChange(event.target.value.trim() !== value);
          }}
          onBlur={() => void saveDescription()}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              setDraft(value);
              setEditing(false);
              onDirtyChange(false);
            }
          }}
          className="form-input min-h-28 resize-y"
          placeholder="Project scope, market context, certification notes, or support coverage"
          autoFocus
        />
      </Field>
    );
  }

  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-600">
        Description
      </div>
      <div
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="min-h-24 cursor-pointer rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700 hover:bg-slate-100"
      >
        {saving ? (
          <span className="text-slate-500">Saving...</span>
        ) : value ? (
          <p className="whitespace-pre-wrap">{value}</p>
        ) : (
          <p className="text-slate-500">No description.</p>
        )}
      </div>
    </div>
  );
}

function OverviewRequirementCard({
  requirement,
  active,
  requirements,
  onClick,
  onOpenRequirement,
}: {
  requirement: OverviewRequirement;
  active: boolean;
  requirements: Requirement[];
  onClick: () => void;
  onOpenRequirement: (requirementId: string) => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`w-full cursor-pointer rounded-lg border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md ${
        active ? "border-slate-400 ring-2 ring-slate-200" : "border-slate-200"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-base font-semibold leading-6 text-slate-950">
            <span className="mr-2 inline-flex rounded-md bg-slate-950 px-2 py-0.5 text-xs font-semibold text-white">
              {requirement.id}
            </span>
            <span>{requirement.product || "No product selected"}</span>
          </h3>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          {formatDateTimeFull(requirement.created_at)}
        </span>
      </div>
      {requirement.simple_requirements.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
          {requirement.simple_requirements.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No simple requirements.</p>
      )}
      {requirement.remark ? (
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          {requirement.remark}
        </p>
      ) : null}
      <div className="mt-3">
        <LinkedRequirementChips
          requirementIds={requirement.linked_requirements}
          requirements={requirements}
          onOpenRequirement={onOpenRequirement}
        />
      </div>
    </div>
  );
}

function RequirementsWorkspace({
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

function RequirementCard({
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

function DashboardView({
  data,
  tickets,
  ticketCount,
  page,
  totalPages,
  allTickets,
  activeFilter,
  onFilterChange,
  onPreviousPage,
  onNextPage,
  onOpenProject,
  onOpenTicket,
}: {
  data: DashboardData | null;
  tickets: DashboardTicket[];
  ticketCount: number;
  page: number;
  totalPages: number;
  allTickets: DashboardTicket[];
  activeFilter: DashboardFilter;
  onFilterChange: (filter: DashboardFilter) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onOpenProject: (folder: string) => void;
  onOpenTicket: (item: DashboardTicket) => void;
}) {
  const metrics = dashboardMetrics(allTickets);
  const topProjects = (data?.projects ?? [])
    .map((project) => ({
      ...project,
      active: project.tickets.filter((ticket) => ticket.status !== "resolved")
        .length,
      urgent: project.tickets.filter((ticket) => ticket.priority === "urgent")
        .length,
    }))
    .sort(
      (a, b) =>
        b.active - a.active ||
        b.urgent - a.urgent ||
        a.project.project_name.localeCompare(b.project.project_name),
    )
    .slice(0, 6);
  const recentActivity = [...allTickets]
    .sort((a, b) => b.ticket.updated_at.localeCompare(a.ticket.updated_at))
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
              Monitor every support ticket across {data?.projects.length ?? 0}{" "}
              projects.
            </p>
          </div>
        </div>
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
                      <div className="text-xs text-red-600">
                        {project.urgent} urgent
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
        <ChartPanel title={`${dashboardFilterLabel(activeFilter)} tickets`}>
          <div className="space-y-2">
            {tickets.map((item) => (
              <DashboardTicketRow
                key={`${item.folder}-${item.ticket.id}`}
                item={item}
                onClick={() => onOpenTicket(item)}
              />
            ))}
            {ticketCount === 0 ? (
              <EmptyState text="No tickets match this dashboard filter." />
            ) : null}
          </div>
          {ticketCount > TICKETS_PER_PAGE ? (
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
                  <span className="text-xs text-slate-500">
                    {item.project.project_name}
                  </span>
                  <span className="text-xs text-slate-400">
                    Updated {formatDateTimeFull(item.ticket.updated_at)}
                  </span>
                </div>
              </button>
            ))}
            {recentActivity.length === 0 ? (
              <EmptyState text="No recent ticket activity." />
            ) : null}
          </div>
        </ChartPanel>
      </section>
    </div>
  );
}

function ChartPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
  const segments = items.reduce<
    Array<(typeof items)[number] & { length: number; offset: number }>
  >((current, item) => {
    const previous = current.at(-1);
    const offset = previous ? previous.offset + previous.length : 0;
    const length = total > 0 ? (item.value / total) * circumference : 0;
    return [...current, { ...item, length, offset }];
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
      <div className="relative grid aspect-square max-w-[180px] place-items-center justify-self-center rounded-full bg-slate-50">
        <svg viewBox="0 0 120 120" className="h-full w-full rotate-[-90deg]">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="18"
          />
          {segments.map((item) => {
            const strokeDashoffset = -item.offset;
            return (
              <circle
                key={item.label}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={item.active ? 22 : 18}
                strokeDasharray={`${item.length} ${circumference - item.length}`}
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
            <span className="block text-xl font-semibold text-slate-950">
              {total}
            </span>
            <span className="block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
              Total
            </span>
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
              item.active
                ? "border-slate-400 bg-slate-50 ring-2 ring-slate-100"
                : "border-slate-200"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate text-sm font-medium text-slate-700">
                {item.label}
              </span>
            </span>
            <span className="text-sm font-semibold text-slate-950">
              {item.value}
            </span>
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

function DashboardTicketRow({
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
      {text}
    </div>
  );
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
        Prev
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
      <div className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
        {label}
      </div>
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
                folder === selectedFolder
                  ? "bg-slate-100 text-slate-950"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {project.project_name}
                </span>
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

function RequirementModal({
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

function OverviewRequirementModal({
  products,
  requirements,
  saving,
  onClose,
  onCreate,
}: {
  products: string[];
  requirements: Requirement[];
  saving: boolean;
  onClose: () => void;
  onCreate: (draft: OverviewRequirementDraft) => void | Promise<void>;
}) {
  const [dirty, setDirty] = useState(false);

  function closeModal() {
    if (dirty && !confirm("Discard this new overview item draft?")) {
      return;
    }
    onClose();
  }

  return (
    <Overlay>
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Demand</h2>
          <button
            onClick={closeModal}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>
        <OverviewRequirementForm
          initial={{
            ...emptyOverviewRequirementDraft,
            product: products[0] ?? "",
          }}
          products={products}
          requirements={requirements}
          saving={saving}
          submitLabel="Create demand"
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
            <div className="text-xs font-medium text-slate-500">
              {ticket.id}
            </div>
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
          </section>

          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-3 text-sm font-semibold">Add timeline event</h3>
            <EventForm
              saving={saving}
              submitLabel="Add event"
              onSubmit={onAddEvent}
            />
          </section>
        </div>
      </aside>
    </div>
  );
}

function RequirementDrawer({
  requirement,
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
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>

        <div className="space-y-6 p-5">
          <RequirementForm
            key={requirement.id}
            initial={requirementToDraft(requirement)}
            tickets={tickets}
            saving={saving}
            submitLabel="Save changes"
            onDirtyChange={onDirtyChange}
            onSubmit={saveRequirement}
          />

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
          </section>

          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-3 text-sm font-semibold">Add timeline update</h3>
            <RequirementTimelineForm
              saving={saving}
              submitLabel="Add update"
              onSubmit={onAddTimeline}
            />
          </section>
        </div>
      </aside>
    </div>
  );
}

function OverviewRequirementDrawer({
  requirement,
  products,
  requirements,
  saving,
  onClose,
  onDirtyChange,
  onSave,
  onDelete,
  onOpenRequirement,
}: {
  requirement: OverviewRequirement;
  products: string[];
  requirements: Requirement[];
  saving: boolean;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (draft: OverviewRequirementDraft) => Promise<void>;
  onDelete: () => void;
  onOpenRequirement: (requirementId: string) => void;
}) {
  useEffect(() => {
    onDirtyChange(false);
  }, [onDirtyChange, requirement.id]);

  async function saveRequirement(draft: OverviewRequirementDraft) {
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
            <h2 className="mt-1 text-xl font-semibold">
              {requirement.product || "Overview item"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>

        <div className="space-y-6 p-5">
          <OverviewRequirementForm
            key={requirement.id}
            initial={overviewRequirementToDraft(requirement)}
            products={products}
            requirements={requirements}
            saving={saving}
            submitLabel="Save changes"
            onDirtyChange={onDirtyChange}
            onSubmit={saveRequirement}
          />

          {requirement.linked_requirements.length > 0 ? (
            <section>
              <h3 className="mb-2 text-sm font-semibold">
                Linked requirements
              </h3>
              <LinkedRequirementChips
                requirementIds={requirement.linked_requirements}
                requirements={requirements}
                onOpenRequirement={onOpenRequirement}
              />
            </section>
          ) : null}

          <div className="flex justify-end">
            <button
              onClick={onDelete}
              disabled={saving}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Delete overview item
            </button>
          </div>
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
    <form
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
      <button
        disabled={saving}
        className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}

function OverviewRequirementForm({
  initial,
  products,
  requirements,
  saving,
  submitLabel,
  onDirtyChange,
  onSubmit,
}: {
  initial: OverviewRequirementDraft;
  products: string[];
  requirements: Requirement[];
  saving: boolean;
  submitLabel: string;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (draft: OverviewRequirementDraft) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<OverviewRequirementDraft>(initial);
  const [baseline, setBaseline] = useState<OverviewRequirementDraft>(initial);
  const [requirementPickerOpen, setRequirementPickerOpen] = useState(false);
  const [requirementDeleteMode, setRequirementDeleteMode] = useState(false);
  const [requirementQuery, setRequirementQuery] = useState("");

  const selectableRequirements = requirements.filter((requirement) => {
    const query = requirementQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return [
      requirement.id,
      requirement.title,
      requirement.details,
      requirement.status,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  function updateDraft(nextDraft: OverviewRequirementDraft) {
    setDraft(nextDraft);
    onDirtyChange?.(!overviewRequirementDraftsEqual(nextDraft, baseline));
  }

  function addLinkedRequirement(requirementId: string) {
    if (draft.linked_requirements.includes(requirementId)) {
      return;
    }
    updateDraft({
      ...draft,
      linked_requirements: [...draft.linked_requirements, requirementId],
    });
  }

  function removeLinkedRequirement(requirementId: string) {
    updateDraft({
      ...draft,
      linked_requirements: draft.linked_requirements.filter(
        (current) => current !== requirementId,
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
    <form onSubmit={submit} className="space-y-4">
      <Field label="Product">
        <select
          required
          value={draft.product}
          onChange={(event) =>
            updateDraft({ ...draft, product: event.target.value })
          }
          className="form-input"
        >
          <option value="" disabled>
            Select product
          </option>
          {products.map((product) => (
            <option key={product} value={product}>
              {product}
            </option>
          ))}
        </select>
      </Field>
      {products.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">
          Add at least one model or service before creating overview items.
        </div>
      ) : null}
      <TextListEditor
        label="Simple requirements"
        values={draft.simple_requirements}
        placeholder="Add one sentence"
        onChange={(simple_requirements) =>
          updateDraft({ ...draft, simple_requirements })
        }
      />
      <div>
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="block text-xs font-medium text-slate-600">
            Linked requirements
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRequirementPickerOpen(true)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setRequirementDeleteMode((current) => !current)}
              disabled={draft.linked_requirements.length === 0}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              {requirementDeleteMode ? "Cancel" : "Delete"}
            </button>
          </div>
        </div>
        {draft.linked_requirements.length > 0 ? (
          <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
            {draft.linked_requirements.map((requirementId) => (
              <span
                key={requirementId}
                className={`relative inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 ${
                  requirementDeleteMode ? "pr-5" : ""
                }`}
              >
                {formatRequirementLabel(requirementId, requirements)}
                {requirementDeleteMode ? (
                  <button
                    type="button"
                    onClick={() => removeLinkedRequirement(requirementId)}
                    className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[10px] font-semibold leading-none text-white hover:bg-red-700"
                    aria-label={`Remove ${requirementId}`}
                  >
                    x
                  </button>
                ) : null}
              </span>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">
            No linked requirements selected.
          </div>
        )}
      </div>
      <Field label="Remark">
        <textarea
          value={draft.remark}
          onChange={(event) =>
            updateDraft({ ...draft, remark: event.target.value })
          }
          className="form-input min-h-24 resize-y"
          placeholder="Context, deployment notes, or certification detail"
        />
      </Field>
      {requirementPickerOpen ? (
        <Overlay>
          <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add linked requirement</h3>
              <button
                type="button"
                onClick={() => setRequirementPickerOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
              >
                Close
              </button>
            </div>
            <input
              value={requirementQuery}
              onChange={(event) => setRequirementQuery(event.target.value)}
              className="mb-3 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
              placeholder="Search by requirement ID, title, status, or details"
            />
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {selectableRequirements.map((requirement) => {
                const selected = draft.linked_requirements.includes(
                  requirement.id,
                );
                return (
                  <button
                    key={requirement.id}
                    type="button"
                    onClick={() => {
                      addLinkedRequirement(requirement.id);
                      setRequirementPickerOpen(false);
                      setRequirementQuery("");
                    }}
                    disabled={selected}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selected
                        ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          [{requirement.id}] {requirement.title}
                        </div>
                        <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                          {requirement.details || "No details."}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {selected ? (
                          <span className="rounded-md bg-slate-200 px-2 py-1 text-xs font-medium">
                            Selected
                          </span>
                        ) : (
                          <RequirementStatusBadge status={requirement.status} />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              {selectableRequirements.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  No requirements match this search.
                </div>
              ) : null}
            </div>
          </div>
        </Overlay>
      ) : null}
      <button
        disabled={saving || products.length === 0}
        className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}

function TextListEditor({
  label,
  values,
  placeholder,
  onChange,
}: {
  label: string;
  values: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
}) {
  const [value, setValue] = useState("");

  function addValue() {
    const nextValue = value.trim();
    if (!nextValue || values.includes(nextValue)) {
      return;
    }
    onChange([...values, nextValue]);
    setValue("");
  }

  return (
    <div>
      <div className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </div>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addValue();
            }
          }}
          className="form-input"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={addValue}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
        >
          Add
        </button>
      </div>
      {values.length > 0 ? (
        <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          {values.map((item) => (
            <div
              key={item}
              className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <span>{item}</span>
              <button
                type="button"
                onClick={() => onChange(values.filter((current) => current !== item))}
                className="text-xs font-medium text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">
          No {label.toLowerCase()} added.
        </div>
      )}
    </div>
  );
}

function RequirementForm({
  initial,
  tickets,
  saving,
  submitLabel,
  onDirtyChange,
  onSubmit,
}: {
  initial: RequirementDraft;
  tickets: Ticket[];
  saving: boolean;
  submitLabel: string;
  onDirtyChange?: (dirty: boolean) => void;
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

  function addRelatedTicket(ticketId: string) {
    if (draft.related_tickets.includes(ticketId)) {
      return;
    }
    updateDraft({
      ...draft,
      related_tickets: [...draft.related_tickets, ticketId],
    });
  }

  function removeRelatedTicket(ticketId: string) {
    updateDraft({
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
    <form onSubmit={submit} className="space-y-4">
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
            {draft.related_tickets.map((ticketId) => {
              const ticket = tickets.find((current) => current.id === ticketId);
              return (
                <span
                  key={ticketId}
                  className={`relative inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 ${
                    ticketDeleteMode ? "pr-5" : ""
                  }`}
                >
                  [{ticketId}]: {ticket?.title ?? "Ticket not found"}
                  {ticketDeleteMode ? (
                    <button
                      type="button"
                      onClick={() => removeRelatedTicket(ticketId)}
                      className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[10px] font-semibold leading-none text-white hover:bg-red-700"
                      aria-label={`Remove ${ticketId}`}
                    >
                      x
                    </button>
                  ) : null}
                </span>
              );
            })}
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
                      addRelatedTicket(ticket.id);
                      setTicketPickerOpen(false);
                      setTicketQuery("");
                    }}
                    disabled={selected}
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
      <button
        disabled={saving}
        className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}

function RequirementTimelineItemView({
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

function RequirementTimelineForm({
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}

function RelatedTicketRows({
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

function LinkedRequirementChips({
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
    <div className="flex flex-wrap gap-2">
      {requirementIds.map((requirementId) => {
        const requirement = requirements.find(
          (current) => current.id === requirementId,
        );
        if (!requirement) {
          return (
            <span
              key={requirementId}
              className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-400"
            >
              {requirementId}
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
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            title={requirement.title}
          >
            {formatRequirementLabel(requirementId, requirements)}
          </button>
        );
      })}
    </div>
  );
}

function formatRequirementLabel(
  requirementId: string,
  requirements: Requirement[],
) {
  const requirement = requirements.find((current) => current.id === requirementId);
  return requirement ? `[${requirementId}]: ${requirement.title}` : requirementId;
}

function relatedTicketRowStyle(ticket: Ticket | undefined) {
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

function RequirementStatusBadge({ status }: { status: RequirementStatus }) {
  const styles: Record<RequirementStatus, string> = {
    pending: "bg-slate-100 text-slate-700",
    in_progress: "bg-blue-50 text-blue-700",
    testing: "bg-violet-50 text-violet-700",
    finished: "bg-emerald-50 text-emerald-700",
  };
  return (
    <span
      className={`rounded-md px-2 py-1 text-xs font-medium ${styles[status]}`}
    >
      {requirementStatusLabels[status]}
    </span>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const styles: Record<TicketStatus, string> = {
    pending_internal: "bg-orange-50 text-orange-800",
    pending_customer: "bg-amber-50 text-amber-800",
    resolved: "bg-emerald-50 text-emerald-700",
  };
  return (
    <span
      className={`rounded-md px-2 py-1 text-xs font-medium ${styles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const styles: Record<TicketPriority, string> = {
    low: "bg-slate-100 text-slate-600",
    medium: "bg-blue-50 text-blue-700",
    high: "bg-rose-50 text-rose-700",
    urgent: "bg-red-600 text-white",
  };
  return (
    <span
      className={`rounded-md px-2 py-1 text-xs font-medium ${styles[priority]}`}
    >
      {priorityLabels[priority]}
    </span>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/30 p-4">
      {children}
    </div>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-800 shadow-xl">
      {message}
    </div>
  );
}

function projectModeLabel(mode: ProjectMode) {
  const labels: Record<ProjectMode, string> = {
    overview: "Overview",
    tickets: "Tickets",
    requirements: "Requirements",
  };
  return labels[mode];
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
    throw new ApiError(data.error || "Request failed.", response.status, data);
  }
  return data as T;
}

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
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

function ticketDraftsEqual(
  left: TicketDraft,
  right: TicketDraft,
  includeNextAction: boolean,
) {
  return (
    left.title === right.title &&
    left.status === right.status &&
    left.priority === right.priority &&
    left.summary === right.summary &&
    (!includeNextAction || left.next_action === right.next_action)
  );
}

function requirementToDraft(requirement: Requirement): RequirementDraft {
  return {
    title: requirement.title,
    status: requirement.status,
    details: requirement.details,
    related_tickets: requirement.related_tickets,
  };
}

function requirementDraftForApi(draft: RequirementDraft) {
  return {
    title: draft.title,
    status: draft.status,
    details: draft.details,
    related_tickets: draft.related_tickets,
  };
}

function requirementDraftsEqual(
  left: RequirementDraft,
  right: RequirementDraft,
) {
  return (
    left.title === right.title &&
    left.status === right.status &&
    left.details === right.details &&
    left.related_tickets.join("\n") === right.related_tickets.join("\n")
  );
}

function requirementTimelineToDraft(
  item: RequirementTimelineItem,
): RequirementTimelineDraft {
  return {
    time: dateInputValue(item.time),
    remark: item.remark,
  };
}

function requirementTimelineDraftForApi(
  draft: RequirementTimelineDraft,
): RequirementTimelineDraft {
  return {
    ...draft,
    time: draft.time.includes("T") ? draft.time : `${draft.time}T00:00:00`,
  };
}

function overviewToSettingsDraft(overview: Overview): OverviewSettingsDraft {
  return {
    models: overview.models,
    others: overview.others,
    description: overview.description,
  };
}

function overviewSettingsKey(overview: Overview) {
  return JSON.stringify({
    models: overview.models,
    others: overview.others,
    description: overview.description,
  });
}

function overviewRequirementToDraft(
  requirement: OverviewRequirement,
): OverviewRequirementDraft {
  return {
    product: requirement.product,
    simple_requirements: requirement.simple_requirements,
    linked_requirements: requirement.linked_requirements,
    remark: requirement.remark,
  };
}

function overviewRequirementDraftForApi(
  draft: OverviewRequirementDraft,
): OverviewRequirementDraft {
  return {
    product: draft.product,
    simple_requirements: draft.simple_requirements,
    linked_requirements: draft.linked_requirements,
    remark: draft.remark,
  };
}

function overviewRequirementDraftsEqual(
  left: OverviewRequirementDraft,
  right: OverviewRequirementDraft,
) {
  return (
    left.product === right.product &&
    left.simple_requirements.join("\n") ===
      right.simple_requirements.join("\n") &&
    left.linked_requirements.join("\n") ===
      right.linked_requirements.join("\n") &&
    left.remark === right.remark
  );
}

function flattenDashboardTickets(
  data: DashboardData | null,
): DashboardTicket[] {
  return (data?.projects ?? []).flatMap((project) =>
    project.tickets.map((ticket) => ({
      folder: project.folder,
      project: project.project,
      ticket,
    })),
  );
}

function filterDashboardTickets(
  tickets: DashboardTicket[],
  filter: DashboardFilter,
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  return tickets.filter((item) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && item.ticket.status !== "resolved") ||
      (filter === "pending_internal" &&
        item.ticket.status === "pending_internal") ||
      (filter === "pending_customer" &&
        item.ticket.status === "pending_customer") ||
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
    pendingInternal: tickets.filter(
      (item) => item.ticket.status === "pending_internal",
    ).length,
    pendingCustomer: tickets.filter(
      (item) => item.ticket.status === "pending_customer",
    ).length,
    urgent: tickets.filter((item) => item.ticket.priority === "urgent").length,
    resolved: tickets.filter((item) => item.ticket.status === "resolved")
      .length,
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
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
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
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
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
