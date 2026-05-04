"use client";

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
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
type DashboardMode = "tickets" | "requirements";

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

type DashboardRequirement = {
  folder: string;
  project: ProjectInfo;
  requirement: Requirement;
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

type ProjectJsonDraft = {
  project_name: string;
  country: string;
  customer: string;
  sales: string;
  created_at: string;
};

type ProjectAsset = {
  publicId: string;
  resourceType: "image" | "video" | "raw";
  type: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  createdAt: string;
  secureUrl: string;
  downloadUrl: string;
  previewUrl?: string;
  originalFilename: string;
};

type ProjectReference = {
  id: string;
  path: string;
  name: string;
  size?: number;
  modified_at?: string;
  added_at: string;
  exists: boolean;
  url: string;
};

type ReferenceBrowseEntry = {
  name: string;
  path: string;
  kind: "directory" | "file";
  size?: number;
  modified_at?: string;
};

type ReportGenerateDraft = {
  startDate: string;
  endDate: string;
};

type ReportGenerateResponse =
  | {
      status: "no_data";
      ticketCount: 0;
      requirementCount: 0;
    }
  | {
      status: "sent";
      report: string;
      ticketCount: number;
      requirementCount: number;
    };

const TICKETS_PER_PAGE = 10;
const RECENT_PROJECTS_KEY = "urovo-projects:recent-projects";
const MAX_ASSET_BYTES = 100 * 1024 * 1024;

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

const emptyProjectJsonDraft: ProjectJsonDraft = {
  project_name: "",
  country: "",
  customer: "",
  sales: "",
  created_at: todayDate(),
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
                [{requirement.id}]:{" "}
                {requirement.title || "Untitled requirement"}
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
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
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
      <div className="mb-1 text-xs font-medium text-slate-600">Description</div>
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
  emptyText = "No ticket data for this chart.",
}: {
  items: {
    label: string;
    value: number;
    color: string;
    active: boolean;
    onClick: () => void;
  }[];
  onTotalClick: () => void;
  emptyText?: string;
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
          {emptyText}
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

function DashboardRequirementRow({
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

function ProjectJsonGeneratorDialog({
  onClose,
  onGenerate,
}: {
  onClose: () => void;
  onGenerate: (draft: ProjectJsonDraft) => void;
}) {
  const [draft, setDraft] = useState<ProjectJsonDraft>(emptyProjectJsonDraft);
  const dirty = !projectJsonDraftsEqual(draft, emptyProjectJsonDraft);
  const canGenerate = Boolean(
    draft.project_name.trim() &&
    draft.country.trim() &&
    draft.customer.trim() &&
    draft.sales.trim() &&
    draft.created_at,
  );

  function closeDialog() {
    if (dirty && !confirm("Discard this project JSON draft?")) {
      return;
    }
    onClose();
  }

  function updateDraft(nextDraft: ProjectJsonDraft) {
    setDraft(nextDraft);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canGenerate) {
      return;
    }
    onGenerate(draft);
  }

  return (
    <Overlay>
      <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Generate Project JSON</h2>
          <button
            type="button"
            onClick={closeDialog}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project Name">
              <input
                value={draft.project_name}
                onChange={(event) =>
                  updateDraft({ ...draft, project_name: event.target.value })
                }
                className="form-input"
                required
              />
            </Field>
            <Field label="Country">
              <input
                value={draft.country}
                onChange={(event) =>
                  updateDraft({ ...draft, country: event.target.value })
                }
                className="form-input"
                required
              />
            </Field>
            <Field label="Customer">
              <input
                value={draft.customer}
                onChange={(event) =>
                  updateDraft({ ...draft, customer: event.target.value })
                }
                className="form-input"
                required
              />
            </Field>
            <Field label="Sales">
              <input
                value={draft.sales}
                onChange={(event) =>
                  updateDraft({ ...draft, sales: event.target.value })
                }
                className="form-input"
                required
              />
            </Field>
          </div>
          <Field label="Created at">
            <input
              type="date"
              value={draft.created_at}
              onChange={(event) =>
                updateDraft({ ...draft, created_at: event.target.value })
              }
              className="form-input max-w-52"
              required
            />
          </Field>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button
              disabled={!canGenerate}
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generate
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}

function ProjectJsonResultDialog({
  json,
  onClose,
}: {
  json: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyBlocked, setCopyBlocked] = useState(false);

  async function copyJson() {
    setCopyBlocked(false);
    const didCopy = await copyTextToClipboard(json);
    if (!didCopy) {
      setCopyBlocked(true);
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Overlay>
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">project.json</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>

        <div
          className={`overflow-hidden rounded-lg border transition ${
            copied
              ? "border-emerald-300 ring-2 ring-emerald-100"
              : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              JSON
            </span>
            <button
              type="button"
              onClick={() => void copyJson()}
              className={`grid h-8 w-8 place-items-center rounded-md border text-sm shadow-sm transition ${
                copied
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950"
              }`}
              aria-label={copied ? "Project JSON copied" : "Copy project JSON"}
            >
              {copied ? "✓" : "⧉"}
            </button>
          </div>
          <pre className="max-h-[50vh] overflow-auto bg-slate-950 p-4 text-sm leading-6 text-slate-50">
            <code>{json}</code>
          </pre>
        </div>

        <div
          className={`mt-3 min-h-5 text-sm font-medium transition ${
            copied
              ? "text-emerald-700"
              : copyBlocked
                ? "text-amber-700"
                : "text-slate-400"
          }`}
          aria-live="polite"
        >
          {copied
            ? "Copied to clipboard."
            : copyBlocked
              ? "Clipboard access blocked."
              : " "}
        </div>
      </div>
    </Overlay>
  );
}

function ProjectSummaryDialog({
  summary,
  onClose,
}: {
  summary: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyBlocked, setCopyBlocked] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [downloadBlocked, setDownloadBlocked] = useState(false);

  async function copySummary() {
    setCopyBlocked(false);
    setDownloaded(false);
    setDownloadBlocked(false);
    const didCopy = await copyTextToClipboard(summary);
    if (!didCopy) {
      setCopyBlocked(true);
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function downloadSummaryPng() {
    setCopied(false);
    setCopyBlocked(false);
    setDownloadBlocked(false);
    const didDownload = downloadSummaryMarkdownAsPng(
      summary,
      "project-summary.png",
    );
    if (!didDownload) {
      setDownloadBlocked(true);
      return;
    }
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 1800);
  }

  return (
    <Overlay>
      <div className="w-full max-w-3xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Project Summary</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>

        <div
          className={`overflow-hidden rounded-lg border transition ${
            copied
              ? "border-emerald-300 ring-2 ring-emerald-100"
              : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Summary
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void copySummary()}
                className={`grid h-8 w-8 place-items-center rounded-md border text-sm shadow-sm transition ${
                  copied
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950"
                }`}
                aria-label={
                  copied ? "Project summary copied" : "Copy project summary"
                }
                title="Copy Markdown"
              >
                {copied ? "✓" : "⧉"}
              </button>
              <button
                type="button"
                onClick={() => void downloadSummaryPng()}
                className={`grid h-8 w-8 place-items-center rounded-md border text-sm shadow-sm transition ${
                  downloaded
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950"
                }`}
                aria-label={
                  downloaded
                    ? "Project summary image downloaded"
                    : "Download project summary image"
                }
                title="Download PNG"
              >
                {downloaded ? "✓" : "⇩"}
              </button>
            </div>
          </div>
          <pre className="max-h-[60vh] whitespace-pre-wrap overflow-auto bg-slate-950 p-4 text-sm leading-6 text-slate-50">
            <code>{summary}</code>
          </pre>
        </div>

        <div
          className={`mt-3 min-h-5 text-sm font-medium transition ${
            copied || downloaded
              ? "text-emerald-700"
              : copyBlocked || downloadBlocked
                ? "text-amber-700"
                : "text-slate-400"
          }`}
          aria-live="polite"
        >
          {copied
            ? "Copied to clipboard."
            : downloaded
              ? "PNG downloaded."
            : copyBlocked
              ? "Clipboard access blocked."
              : downloadBlocked
                ? "PNG download failed."
              : " "}
        </div>
      </div>
    </Overlay>
  );
}

function GenerateReportDialog({
  onClose,
  onGenerate,
}: {
  onClose: () => void;
  onGenerate: (draft: ReportGenerateDraft) => Promise<ReportGenerateResponse>;
}) {
  const today = todayDate();
  const [draft, setDraft] = useState<ReportGenerateDraft>({
    startDate: today,
    endDate: today,
  });
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<ReportGenerateResponse | null>(null);
  const [submitError, setSubmitError] = useState("");
  const dateOrderError =
    draft.startDate && draft.endDate && draft.startDate > draft.endDate
      ? "Start date must be before or equal to end date."
      : "";
  const canGenerate =
    Boolean(draft.startDate && draft.endDate) && !dateOrderError && !generating;

  function updateDraft(nextDraft: ReportGenerateDraft) {
    setDraft(nextDraft);
    setResult(null);
    setSubmitError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canGenerate) {
      return;
    }
    setGenerating(true);
    setSubmitError("");
    setResult(null);
    try {
      setResult(await onGenerate(draft));
    } catch (requestError) {
      setSubmitError((requestError as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Overlay>
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Generate Report</h2>
            <p className="mt-1 text-sm text-slate-500">
              Select an inclusive date range for dashboard activity.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Date ranges of 5 days or longer use a general progress summary
              format.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starting date">
              <input
                type="date"
                value={draft.startDate}
                onChange={(event) =>
                  updateDraft({ ...draft, startDate: event.target.value })
                }
                className="form-input"
                required
              />
            </Field>
            <Field label="Ending date">
              <input
                type="date"
                value={draft.endDate}
                onChange={(event) =>
                  updateDraft({ ...draft, endDate: event.target.value })
                }
                className="form-input"
                required
              />
            </Field>
          </div>

          <div className="min-h-6 text-sm font-medium" aria-live="polite">
            {dateOrderError ? (
              <span className="text-red-700">{dateOrderError}</span>
            ) : submitError ? (
              <span className="text-red-700">{submitError}</span>
            ) : result?.status === "no_data" ? (
              <span className="text-amber-700">
                No qualifying ticket or requirement activity was found. No email
                was sent.
              </span>
            ) : result?.status === "sent" ? (
              <span className="text-emerald-700">
                Report sent. Included {result.ticketCount} tickets and{" "}
                {result.requirementCount} requirements.
              </span>
            ) : (
              <span className="text-slate-400"> </span>
            )}
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={!canGenerate}
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate"}
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}

function TicketDrawer({
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

function RequirementDrawer({
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

function TimelineEventDialog({
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

function RequirementTimelineDialog({
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

function ReferenceManager({
  browseApiPath,
  referenceApiPath,
  initialCount,
}: {
  browseApiPath: string;
  referenceApiPath: string;
  initialCount: number;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [showReferences, setShowReferences] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [referenceCountOverride, setReferenceCountOverride] = useState<number | null>(null);
  const referenceCount = referenceCountOverride ?? initialCount;

  const refreshReferences = useCallback((nextCount?: number) => {
    if (nextCount !== undefined) {
      setReferenceCountOverride(nextCount);
    }
    setRefreshKey((current) => current + 1);
  }, []);

  const updateReferenceCount = useCallback((nextCount?: number) => {
    if (nextCount !== undefined) {
      setReferenceCountOverride(nextCount);
    }
  }, []);

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">References</h3>
            <span className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
              {referenceCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Link existing files from this project&apos;s docs folder.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setShowReferences(true)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            View
          </button>
        </div>
      </div>

      {showPicker ? (
        <ReferencePickerDialog
          browseApiPath={browseApiPath}
          referenceApiPath={referenceApiPath}
          onClose={() => setShowPicker(false)}
          onChanged={refreshReferences}
        />
      ) : null}

      {showReferences ? (
        <ReferenceListDialog
          key={refreshKey}
          referenceApiPath={referenceApiPath}
          onClose={() => setShowReferences(false)}
          onChanged={updateReferenceCount}
        />
      ) : null}
    </section>
  );
}

function ReferencePickerDialog({
  browseApiPath,
  referenceApiPath,
  onClose,
  onChanged,
}: {
  browseApiPath: string;
  referenceApiPath: string;
  onClose: () => void;
  onChanged: (nextCount?: number) => void;
}) {
  const [currentPath, setCurrentPath] = useState("docs");
  const [entries, setEntries] = useState<ReferenceBrowseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingDocs, setMissingDocs] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [addingPath, setAddingPath] = useState("");

  useEffect(() => {
    let active = true;

    async function loadEntries() {
      setLoading(true);
      setError("");
      try {
        const data = await api<{
          currentPath: string;
          entries: ReferenceBrowseEntry[];
          missingDocs: boolean;
        }>(`${browseApiPath}?path=${encodeURIComponent(currentPath)}`);
        if (active) {
          setCurrentPath(data.currentPath);
          setEntries(data.entries);
          setMissingDocs(data.missingDocs);
        }
      } catch (loadError) {
        if (active) {
          setError((loadError as Error).message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadEntries();
    return () => {
      active = false;
    };
  }, [browseApiPath, currentPath]);

  async function addReference(entry: ReferenceBrowseEntry) {
    setAddingPath(entry.path);
    setError("");
    setSuccess("");
    try {
      const data = await api<{ references: ProjectReference[] }>(referenceApiPath, {
        method: "POST",
        body: JSON.stringify({ path: entry.path }),
      });
      setSuccess(`${entry.name} added.`);
      onChanged(data.references.length);
    } catch (addError) {
      setError((addError as Error).message);
    } finally {
      setAddingPath("");
    }
  }

  return (
    <Overlay>
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold">Add Reference</h2>
            <p className="mt-1 text-sm text-slate-500">{currentPath}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>

        <div className="overflow-auto p-5">
          {error ? (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {success}
            </div>
          ) : null}

          {loading ? (
            <EmptyState text="Loading docs folder..." />
          ) : missingDocs ? (
            <EmptyState text="No docs folder was found for this project." />
          ) : (
            <div className="space-y-2">
              {currentPath !== "docs" ? (
                <button
                  type="button"
                  onClick={() => setCurrentPath(parentReferencePath(currentPath))}
                  className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-white"
                  aria-label="Go to parent folder"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-base font-semibold leading-none text-slate-500">
                    ↑
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-950">
                      Parent folder
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {parentReferencePath(currentPath)}
                    </span>
                  </span>
                </button>
              ) : null}
              {entries.length === 0 ? (
                <EmptyState text="No files found in this docs folder." />
              ) : null}
              {entries.map((entry) => (
                <div
                  key={entry.path}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  {entry.kind === "directory" ? (
                    <button
                      type="button"
                      onClick={() => setCurrentPath(entry.path)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-sm font-semibold text-slate-950">
                        Folder: {entry.name}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>{entry.path}</span>
                      </div>
                    </button>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-950">
                        {entry.name}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>{entry.path}</span>
                        <span>{formatBytes(entry.size ?? 0)}</span>
                      </div>
                    </div>
                  )}
                  {entry.kind === "file" ? (
                    <button
                      type="button"
                      onClick={() => void addReference(entry)}
                      disabled={addingPath === entry.path}
                      className="shrink-0 rounded-md bg-slate-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {addingPath === entry.path ? "Adding..." : "Add"}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

function ReferenceListDialog({
  referenceApiPath,
  onClose,
  onChanged,
}: {
  referenceApiPath: string;
  onClose: () => void;
  onChanged: (nextCount?: number) => void;
}) {
  const [references, setReferences] = useState<ProjectReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadReferences() {
      setLoading(true);
      setError("");
      try {
        const data = await api<{ references: ProjectReference[] }>(referenceApiPath);
        if (active) {
          setReferences(data.references);
          onChanged(data.references.length);
        }
      } catch (loadError) {
        if (active) {
          setError((loadError as Error).message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadReferences();
    return () => {
      active = false;
    };
  }, [onChanged, referenceApiPath]);

  async function removeReference(reference: ProjectReference) {
    setRemovingId(reference.id);
    setError("");
    try {
      const data = await api<{ references: ProjectReference[] }>(referenceApiPath, {
        method: "DELETE",
        body: JSON.stringify({ id: reference.id }),
      });
      setReferences(data.references);
      onChanged(data.references.length);
    } catch (removeError) {
      setError((removeError as Error).message);
    } finally {
      setRemovingId("");
    }
  }

  return (
    <Overlay>
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold">References</h2>
            <p className="mt-1 text-sm text-slate-500">
              {loading
                ? "Loading..."
                : `${references.length} reference${references.length === 1 ? "" : "s"}`}
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

        <div className="overflow-auto p-5">
          {error ? (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {loading ? (
            <EmptyState text="Loading references..." />
          ) : references.length === 0 ? (
            <EmptyState text="No local document references yet." />
          ) : (
            <div className="space-y-2">
              {references.map((reference) => (
                <div
                  key={reference.id}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-semibold text-slate-950">
                          {reference.name}
                        </div>
                        {!reference.exists ? (
                          <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                            Missing
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>{reference.path}</span>
                        {reference.size ? <span>{formatBytes(reference.size)}</span> : null}
                        {reference.modified_at ? (
                          <span>{formatDateTimeFull(reference.modified_at)}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <a
                        href={reference.url}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex h-8 items-center justify-center rounded-md border border-slate-200 px-2.5 text-xs font-medium ${
                          reference.exists
                            ? "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                            : "pointer-events-none text-slate-300"
                        }`}
                      >
                        Open
                      </a>
                      <button
                        type="button"
                        onClick={() => void removeReference(reference)}
                        disabled={removingId === reference.id}
                        className="inline-flex h-8 items-center justify-center rounded-md border border-red-200 px-2.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        {removingId === reference.id ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

function AssetManager({ assetApiPath }: { assetApiPath: string }) {
  const [showUpload, setShowUpload] = useState(false);
  const [showAssets, setShowAssets] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Assets</h3>
          <p className="mt-1 text-xs text-slate-500">
            Images, videos, or supporting files stored in Cloudinary.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          >
            Upload
          </button>
          <button
            type="button"
            onClick={() => setShowAssets(true)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            View
          </button>
        </div>
      </div>

      {showUpload ? (
        <AssetUploadDialog
          assetApiPath={assetApiPath}
          onClose={() => setShowUpload(false)}
          onUploaded={() => setRefreshKey((current) => current + 1)}
        />
      ) : null}

      {showAssets ? (
        <AssetGalleryDialog
          key={refreshKey}
          assetApiPath={assetApiPath}
          onClose={() => setShowAssets(false)}
        />
      ) : null}
    </section>
  );
}

function AssetUploadDialog({
  assetApiPath,
  onClose,
  onUploaded,
}: {
  assetApiPath: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [statuses, setStatuses] = useState<
    {
      name: string;
      state: "queued" | "uploading" | "uploaded" | "error";
      message?: string;
    }[]
  >([]);
  const [uploading, setUploading] = useState(false);

  function queueFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0 || uploading) {
      return;
    }
    void uploadFiles(files);
  }

  async function uploadFiles(files: File[]) {
    setUploading(true);
    setStatuses(files.map((file) => ({ name: file.name, state: "queued" })));

    for (const file of files) {
      if (file.size > MAX_ASSET_BYTES) {
        setStatuses((current) =>
          updateAssetStatus(
            current,
            file.name,
            "error",
            "File is larger than 100 MB.",
          ),
        );
        continue;
      }

      setStatuses((current) =>
        updateAssetStatus(current, file.name, "uploading"),
      );
      const formData = new FormData();
      formData.append("files", file);

      try {
        await api<{ assets: ProjectAsset[] }>(assetApiPath, {
          method: "POST",
          body: formData,
        });
        setStatuses((current) =>
          updateAssetStatus(current, file.name, "uploaded"),
        );
        onUploaded();
      } catch (error) {
        setStatuses((current) =>
          updateAssetStatus(
            current,
            file.name,
            "error",
            (error as Error).message,
          ),
        );
      }
    }

    setUploading(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <Overlay>
      <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Upload Asset</h2>
            <p className="mt-1 text-sm text-slate-500">
              Up to 100 MB per file.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950 disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <div
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            queueFiles(event.dataTransfer.files);
          }}
          className={`grid min-h-40 place-items-center rounded-lg border border-dashed p-6 text-center transition ${
            dragging
              ? "border-slate-500 bg-slate-100"
              : "border-slate-300 bg-slate-50"
          }`}
        >
          <div>
            <div className="text-sm font-semibold text-slate-950">
              Drop assets here
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Images, videos, or other support files.
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="mt-4 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-950 disabled:opacity-60"
            >
              Select Files
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files) {
                  queueFiles(event.target.files);
                }
              }}
            />
          </div>
        </div>

        {statuses.length > 0 ? (
          <div className="mt-4 space-y-2">
            {statuses.map((status) => (
              <div
                key={status.name}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate text-slate-700">
                  {status.name}
                </span>
                <span
                  className={`shrink-0 text-xs font-semibold ${
                    status.state === "uploaded"
                      ? "text-emerald-700"
                      : status.state === "error"
                        ? "text-red-700"
                        : "text-slate-500"
                  }`}
                  title={status.message}
                >
                  {assetStatusLabel(status)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Overlay>
  );
}

function AssetGalleryDialog({
  assetApiPath,
  onClose,
}: {
  assetApiPath: string;
  onClose: () => void;
}) {
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingPublicId, setDeletingPublicId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAssets() {
      setLoading(true);
      setError("");
      try {
        const data = await api<{ assets: ProjectAsset[] }>(assetApiPath);
        if (active) {
          setAssets(data.assets);
        }
      } catch (loadError) {
        if (active) {
          setError((loadError as Error).message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAssets();
    return () => {
      active = false;
    };
  }, [assetApiPath]);

  async function deleteAsset(asset: ProjectAsset) {
    if (!confirm(`Delete ${asset.originalFilename} from Cloudinary?`)) {
      return;
    }

    setDeletingPublicId(asset.publicId);
    setError("");
    try {
      await api<{ ok: true }>(assetApiPath, {
        method: "DELETE",
        body: JSON.stringify({
          publicId: asset.publicId,
          resourceType: asset.resourceType,
        }),
      });
      setAssets((current) =>
        current.filter((currentAsset) => currentAsset.publicId !== asset.publicId),
      );
    } catch (deleteError) {
      setError((deleteError as Error).message);
    } finally {
      setDeletingPublicId("");
    }
  }

  return (
    <Overlay>
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold">Assets</h2>
            <p className="mt-1 text-sm text-slate-500">
              {loading
                ? "Loading..."
                : `${assets.length} asset${assets.length === 1 ? "" : "s"}`}
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

        <div className="overflow-auto p-5">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              Loading assets...
            </div>
          ) : null}

          {!loading && !error && assets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              No assets uploaded yet.
            </div>
          ) : null}

          {!loading && assets.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {assets.map((asset) => (
                <AssetCard
                  key={asset.publicId}
                  asset={asset}
                  deleting={deletingPublicId === asset.publicId}
                  onDelete={() => void deleteAsset(asset)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Overlay>
  );
}

function AssetCard({
  asset,
  deleting,
  onDelete,
}: {
  asset: ProjectAsset;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {asset.resourceType === "image" && asset.previewUrl ? (
        <a
          href={asset.secureUrl}
          target="_blank"
          rel="noreferrer"
          className="block bg-slate-100"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary account host is configured by env at runtime. */}
          <img
            src={asset.previewUrl}
            alt={asset.originalFilename}
            className="h-44 w-full object-cover"
          />
        </a>
      ) : asset.resourceType === "video" ? (
        <div className="bg-slate-950">
          <video
            src={asset.secureUrl}
            controls
            className="h-44 w-full bg-slate-950 object-contain"
          />
        </div>
      ) : (
        <div className="grid h-44 place-items-center bg-slate-100 px-4 text-center">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
              {asset.format || "file"}
            </div>
            <div className="mt-2 line-clamp-2 text-sm font-medium text-slate-700">
              {asset.originalFilename}
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-32 flex-col gap-3 p-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-950">
            {asset.originalFilename}
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="shrink-0">{asset.resourceType}</span>
            <span className="shrink-0">{formatBytes(asset.bytes)}</span>
            {asset.createdAt ? (
              <span className="min-w-0 truncate">
                {formatDateTimeFull(asset.createdAt)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <a
            href={asset.secureUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 min-w-0 items-center justify-center rounded-md border border-slate-200 px-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950"
          >
            Open
          </a>
          <a
            href={asset.downloadUrl || asset.secureUrl}
            download={asset.originalFilename}
            className="inline-flex h-9 min-w-0 items-center justify-center rounded-md bg-slate-950 px-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            Download
          </a>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex h-9 min-w-0 items-center justify-center rounded-md border border-red-200 px-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
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
  const formId = "overview-demand-detail-form";

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
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="submit"
              form={formId}
              disabled={saving || products.length === 0}
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
          <OverviewRequirementForm
            key={requirement.id}
            formId={formId}
            initial={overviewRequirementToDraft(requirement)}
            products={products}
            requirements={requirements}
            saving={saving}
            submitLabel="Save"
            showSubmitButton={false}
            onDirtyChange={onDirtyChange}
            onLinkedRequirementsChange={saveRequirement}
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

function OverviewRequirementForm({
  initial,
  products,
  requirements,
  saving,
  submitLabel,
  formId,
  showSubmitButton = true,
  onDirtyChange,
  onLinkedRequirementsChange,
  onSubmit,
}: {
  initial: OverviewRequirementDraft;
  products: string[];
  requirements: Requirement[];
  saving: boolean;
  submitLabel: string;
  formId?: string;
  showSubmitButton?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onLinkedRequirementsChange?: (draft: OverviewRequirementDraft) => Promise<void>;
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

  async function saveLinkedRequirements(nextDraft: OverviewRequirementDraft) {
    updateDraft(nextDraft);
    if (!onLinkedRequirementsChange) {
      return;
    }
    await onLinkedRequirementsChange(nextDraft);
    setBaseline(nextDraft);
    onDirtyChange?.(false);
  }

  async function addLinkedRequirement(requirementId: string) {
    if (draft.linked_requirements.includes(requirementId)) {
      return;
    }
    await saveLinkedRequirements({
      ...draft,
      linked_requirements: [...draft.linked_requirements, requirementId],
    });
  }

  async function removeLinkedRequirement(requirementId: string) {
    await saveLinkedRequirements({
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
    <form id={formId} onSubmit={submit} className="space-y-4">
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
              disabled={saving}
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
                {requirementId}
                {requirementDeleteMode ? (
                  <button
                    type="button"
                    onClick={() => void removeLinkedRequirement(requirementId)}
                    disabled={saving}
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
                      void addLinkedRequirement(requirement.id);
                      setRequirementPickerOpen(false);
                      setRequirementQuery("");
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
      {showSubmitButton ? (
        <button
          disabled={saving || products.length === 0}
          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? "Saving..." : submitLabel}
        </button>
      ) : null}
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
  const [deleteMode, setDeleteMode] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");

  function addValue() {
    const nextValue = value.trim();
    if (!nextValue || values.includes(nextValue)) {
      return;
    }
    onChange([...values, nextValue]);
    setValue("");
  }

  function startEdit(index: number) {
    if (deleteMode) {
      return;
    }
    setEditingIndex(index);
    setEditingValue(values[index] ?? "");
  }

  function saveEdit(index: number) {
    const nextValue = editingValue.trim();
    setEditingIndex(null);
    setEditingValue("");

    if (!nextValue) {
      return;
    }

    const duplicate = values.some(
      (current, currentIndex) => currentIndex !== index && current === nextValue,
    );
    if (duplicate || values[index] === nextValue) {
      return;
    }

    onChange(values.map((current, currentIndex) => (currentIndex === index ? nextValue : current)));
  }

  function cancelEdit() {
    setEditingIndex(null);
    setEditingValue("");
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="block text-xs font-medium text-slate-600">
          {label}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addValue}
            disabled={!value.trim()}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setDeleteMode((current) => !current);
              cancelEdit();
            }}
            disabled={values.length === 0}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {deleteMode ? "Cancel" : "Delete"}
          </button>
        </div>
      </div>
      <div>
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
      </div>
      {values.length > 0 ? (
        <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          {values.map((item, index) => {
            const editing = editingIndex === index;
            return (
              <div
                key={`${item}-${index}`}
                className={`relative rounded-md border border-slate-200 bg-white text-sm text-slate-700 ${
                  deleteMode ? "pr-5" : ""
                }`}
              >
                {editing ? (
                  <textarea
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    onBlur={() => saveEdit(index)}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelEdit();
                      }
                    }}
                    className="min-h-20 w-full resize-y rounded-md border-0 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-300"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(index)}
                    disabled={deleteMode}
                    className={`w-full whitespace-pre-wrap rounded-md px-3 py-2 text-left leading-6 ${
                      deleteMode
                        ? "cursor-default"
                        : "hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    }`}
                  >
                    {item}
                  </button>
                )}
                {deleteMode ? (
                  <button
                    type="button"
                    onClick={() =>
                      onChange(values.filter((_, currentIndex) => currentIndex !== index))
                    }
                    className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[10px] font-semibold leading-none text-white hover:bg-red-700"
                    aria-label={`Remove ${item}`}
                  >
                    x
                  </button>
                ) : null}
              </div>
            );
          })}
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
    <div className="space-y-2">
      {requirementIds.map((requirementId) => {
        const requirement = requirements.find(
          (current) => current.id === requirementId,
        );
        if (!requirement) {
          return (
            <span
              key={requirementId}
              className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-400"
            >
              [{requirementId}]: Requirement not found
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
            className={`w-full rounded-lg border px-3 py-2 text-left transition ${linkedRequirementRowStyle(
              requirement,
            )}`}
            title={requirement.title}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="line-clamp-2 text-sm font-semibold">
                {formatRequirementLabel(requirementId, requirements)}
              </div>
              <RequirementStatusBadge status={requirement.status} />
            </div>
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
  const requirement = requirements.find(
    (current) => current.id === requirementId,
  );
  return requirement
    ? `[${requirementId}]: ${requirement.title}`
    : requirementId;
}

function linkedRequirementRowStyle(requirement: Requirement | undefined) {
  if (!requirement) {
    return "border-slate-200 bg-slate-50 text-slate-400";
  }
  if (requirement.status === "pending") {
    return "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 hover:bg-slate-100";
  }
  if (requirement.status === "in_progress") {
    return "border-blue-200 bg-blue-50 text-blue-900 hover:border-blue-300 hover:bg-blue-100";
  }
  if (requirement.status === "testing") {
    return "border-violet-200 bg-violet-50 text-violet-900 hover:border-violet-300 hover:bg-violet-100";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100";
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
  const headers =
    init?.body instanceof FormData
      ? init?.headers
      : {
          "Content-Type": "application/json",
          ...init?.headers,
        };
  const response = await fetch(url, {
    ...init,
    headers,
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

function updateAssetStatus(
  statuses: {
    name: string;
    state: "queued" | "uploading" | "uploaded" | "error";
    message?: string;
  }[],
  name: string,
  state: "queued" | "uploading" | "uploaded" | "error",
  message?: string,
) {
  return statuses.map((status) =>
    status.name === name ? { ...status, state, message } : status,
  );
}

function assetStatusLabel(status: {
  state: "queued" | "uploading" | "uploaded" | "error";
  message?: string;
}) {
  if (status.state === "error") {
    return status.message || "Error";
  }
  if (status.state === "uploaded") {
    return "Uploaded";
  }
  if (status.state === "uploading") {
    return "Uploading...";
  }
  return "Queued";
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function parentReferencePath(currentPath: string) {
  if (currentPath === "docs") {
    return "docs";
  }
  const parts = currentPath.split("/").filter(Boolean);
  parts.pop();
  return parts.length === 0 ? "docs" : parts.join("/");
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

function projectJsonDraftsEqual(
  left: ProjectJsonDraft,
  right: ProjectJsonDraft,
) {
  return (
    left.project_name === right.project_name &&
    left.country === right.country &&
    left.customer === right.customer &&
    left.sales === right.sales &&
    left.created_at === right.created_at
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

function flattenDashboardRequirements(
  data: DashboardData | null,
): DashboardRequirement[] {
  return (data?.projects ?? []).flatMap((project) =>
    project.requirements.map((requirement) => ({
      folder: project.folder,
      project: project.project,
      requirement,
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

function filterDashboardRequirements(
  requirements: DashboardRequirement[],
  filter: DashboardFilter,
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  return requirements.filter((item) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "active" &&
        ["in_progress", "testing"].includes(item.requirement.status)) ||
      (filter === "pending_internal" &&
        item.requirement.status === "pending") ||
      (filter === "pending_customer" &&
        item.requirement.status === "in_progress") ||
      (filter === "urgent" && item.requirement.status === "testing") ||
      (filter === "resolved" && item.requirement.status === "finished");

    if (!matchesFilter) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [
      item.project.project_name,
      item.folder,
      item.requirement.id,
      item.requirement.title,
      item.requirement.details,
      item.requirement.status,
      requirementStatusLabels[item.requirement.status],
      ...item.requirement.related_tickets,
      ...item.requirement.timeline.map(
        (entry) => `${entry.time} ${entry.remark}`,
      ),
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

function dashboardRequirementMetrics(requirements: DashboardRequirement[]) {
  return {
    total: requirements.length,
    active: requirements.filter((item) =>
      ["in_progress", "testing"].includes(item.requirement.status),
    ).length,
    pending: requirements.filter(
      (item) => item.requirement.status === "pending",
    ).length,
    inProgress: requirements.filter(
      (item) => item.requirement.status === "in_progress",
    ).length,
    testing: requirements.filter(
      (item) => item.requirement.status === "testing",
    ).length,
    finished: requirements.filter(
      (item) => item.requirement.status === "finished",
    ).length,
  };
}

function dashboardModeLabel(mode: DashboardMode) {
  const labels: Record<DashboardMode, string> = {
    tickets: "Tickets",
    requirements: "Requirements",
  };
  return labels[mode];
}

function dashboardFilterLabel(
  filter: DashboardFilter,
  mode: DashboardMode = "tickets",
) {
  if (mode === "requirements") {
    const labels: Record<DashboardFilter, string> = {
      all: "All",
      active: "Active",
      pending_internal: "Pending",
      pending_customer: "In progress",
      urgent: "Testing",
      priority_low: "Low priority",
      priority_medium: "Medium priority",
      priority_high: "High priority",
      resolved: "Finished",
    };
    return labels[filter];
  }
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

function buildProjectSummary(
  project: ProjectInfo,
  overview: Overview,
  requirements: Requirement[],
  tickets: Ticket[],
) {
  const sections: string[] = [];
  const projectLines = [`# Project: ${project.project_name}`];
  const relateds = [...overview.models, ...overview.others];

  if (relateds.length > 0) {
    projectLines.push("", `- **Relateds**: ${relateds.join(", ")}`);
  }
  if (overview.description) {
    if (relateds.length === 0) {
      projectLines.push("");
    }
    projectLines.push(`- **Description**: ${overview.description}`);
  }
  sections.push(projectLines.join("\n"));

  if (overview.requirements.length > 0) {
    const requirementMap = new Map(
      requirements.map((requirement) => [requirement.id, requirement]),
    );
    const demandLines = ["## Demands"];

    for (const demand of overview.requirements) {
      demandLines.push("", `### ${demand.product}:`, "");
      for (const simpleRequirement of demand.simple_requirements) {
        demandLines.push(`- ${simpleRequirement}`);
      }
      for (const requirementId of demand.linked_requirements) {
        const linkedRequirement = requirementMap.get(requirementId);
        if (!linkedRequirement) {
          continue;
        }
        demandLines.push(
          `- ${stripBracketMetadata(linkedRequirement.title)}`,
          `  - **Status**: "${requirementStatusLabels[linkedRequirement.status]}"`,
        );
      }
      if (demand.remark) {
        demandLines.push(`- Remark: ${demand.remark}`);
      }
    }

    sections.push(demandLines.join("\n"));
  }

  const activeTickets = tickets
    .filter((ticket) => ticket.status !== "resolved")
    .map((ticket, index) => ({ ticket, index }))
    .sort((left, right) => {
      const priorityDifference =
        ticketSummaryPriorityRank[right.ticket.priority] -
        ticketSummaryPriorityRank[left.ticket.priority];
      return priorityDifference || left.index - right.index;
    })
    .map(({ ticket }) => ticket);
  if (activeTickets.length > 0) {
    const ticketLines = ["## Tickets"];

    activeTickets.forEach((ticket, index) => {
      if (index > 0) {
        ticketLines.push("", "---");
      }
      ticketLines.push(
        "",
        `### ${index + 1}. ${stripBracketMetadata(ticket.title)}:`,
        `  - **Status**: "${statusLabels[ticket.status]}"`,
        `  - **Priority**: "${priorityLabels[ticket.priority]}"`,
      );
      const latestEvent = latestTicketEvent(ticket.events);
      if (latestEvent) {
        ticketLines.push(
          "",
          "```",
          `Latest progress (${eventRoleLabels[latestEvent.role]}) - Time: ${formatDateOnly(
            latestEvent.time,
          )}`,
          "",
          "<-----Content Below----->",
          "",
          latestEvent.content,
          "```",
        );
      }
    });

    sections.push(ticketLines.join("\n"));
  }

  return `${sections.join("\n\n---\n\n")}\n`;
}

function stripBracketMetadata(title: string) {
  const stripped = title.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();
  return stripped || "Untitled";
}

const ticketSummaryPriorityRank: Record<TicketPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};

function latestTicketEvent(events: TimelineEvent[]) {
  return events.reduce<TimelineEvent | null>((latest, event) => {
    if (!latest || event.time.localeCompare(latest.time) > 0) {
      return event;
    }
    return latest;
  }, null);
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

function createUuid() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

async function copyTextToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyTextWithTextarea(text);
  }
}

function downloadSummaryMarkdownAsPng(markdown: string, filename: string) {
  try {
    const layout = layoutSummaryMarkdown(markdown);
    if (layout.height <= 0) {
      return false;
    }
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = layout.width * scale;
    canvas.height = layout.height * scale;
    const context = canvas.getContext("2d");
    if (!context) {
      return false;
    }
    context.scale(scale, scale);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, layout.width, layout.height);
    drawSummaryMarkdownLayout(context, layout);

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch {
    return false;
  }
}

type SummaryDrawSegment = {
  text: string;
  bold: boolean;
};

type SummaryDrawLine = {
  type: "text" | "code" | "rule";
  x: number;
  y: number;
  maxWidth: number;
  font: string;
  color: string;
  segments?: SummaryDrawSegment[];
};

type SummaryCodeBlock = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SummaryCanvasLayout = {
  width: number;
  height: number;
  padding: number;
  lines: SummaryDrawLine[];
  codeBlocks: SummaryCodeBlock[];
};

function layoutSummaryMarkdown(markdown: string): SummaryCanvasLayout {
  const width = 960;
  const padding = 48;
  const contentWidth = width - padding * 2;
  const lines = markdown.trimEnd().split("\n");
  const drawLines: SummaryDrawLine[] = [];
  const codeBlocks: SummaryCodeBlock[] = [];
  let y = padding;

  function addWrappedMarkdownLine(
    text: string,
    x: number,
    maxWidth: number,
    font: string,
    color: string,
    lineHeight: number,
  ) {
    const wrappedLines = wrapMarkdownInlineSegments(text, maxWidth, font);
    for (const segments of wrappedLines) {
      drawLines.push({
        type: "text",
        x,
        y,
        maxWidth,
        font,
        color,
        segments,
      });
      y += lineHeight;
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line === "```") {
      const codeLines = [];
      index += 1;
      while (index < lines.length && lines[index] !== "```") {
        codeLines.push(lines[index]);
        index += 1;
      }
      y += 10;
      const blockX = padding;
      const blockY = y;
      const blockPadding = 20;
      const lineHeight = 25;
      const codeFont =
        '15px "SFMono-Regular", Consolas, "Liberation Mono", monospace';
      y += blockPadding;
      for (const codeLine of codeLines) {
        const wrappedCodeLines = wrapPlainText(
          codeLine || " ",
          contentWidth - blockPadding * 2,
          codeFont,
        );
        for (const wrappedCodeLine of wrappedCodeLines) {
          drawLines.push({
            type: "code",
            x: blockX + blockPadding,
            y,
            maxWidth: contentWidth - blockPadding * 2,
            font: codeFont,
            color: "#f8fafc",
            segments: [{ text: wrappedCodeLine, bold: false }],
          });
          y += lineHeight;
        }
      }
      y += blockPadding - 4;
      codeBlocks.push({
        x: blockX,
        y: blockY,
        width: contentWidth,
        height: y - blockY,
      });
      y += 14;
      continue;
    }

    if (!line.trim()) {
      y += 10;
      continue;
    }

    if (line === "---") {
      y += 18;
      drawLines.push({
        type: "rule",
        x: padding,
        y,
        maxWidth: contentWidth,
        font: "",
        color: "#cbd5e1",
      });
      y += 28;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const font =
        level === 1
          ? '750 34px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          : level === 2
            ? '750 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            : '750 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const lineHeight = level === 1 ? 44 : level === 2 ? 36 : 30;
      addWrappedMarkdownLine(heading[2], padding, contentWidth, font, "#020617", lineHeight);
      y += level === 1 ? 10 : 6;
      continue;
    }

    const bullet = line.match(/^(\s*)-\s+(.+)$/);
    if (bullet) {
      const nested = bullet[1].length > 0;
      const bulletX = nested ? padding + 28 : padding;
      const textX = bulletX + 22;
      const lineHeight = 29;
      drawLines.push({
        type: "text",
        x: bulletX,
        y,
        maxWidth: 10,
        font: '18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: "#64748b",
        segments: [{ text: "•", bold: false }],
      });
      addWrappedMarkdownLine(
        bullet[2],
        textX,
        width - padding - textX,
        '18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        "#1e293b",
        lineHeight,
      );
      continue;
    }

    addWrappedMarkdownLine(
      line,
      padding,
      contentWidth,
      '18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      "#1e293b",
      29,
    );
  }

  return {
    width,
    height: Math.ceil(y + padding),
    padding,
    lines: drawLines,
    codeBlocks,
  };
}

function drawSummaryMarkdownLayout(
  context: CanvasRenderingContext2D,
  layout: SummaryCanvasLayout,
) {
  for (const block of layout.codeBlocks) {
    context.fillStyle = "#0f172a";
    drawRoundedRect(context, block.x, block.y, block.width, block.height, 8);
    context.fill();
  }

  for (const line of layout.lines) {
    if (line.type === "rule") {
      context.strokeStyle = line.color;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(line.x, line.y);
      context.lineTo(line.x + line.maxWidth, line.y);
      context.stroke();
      continue;
    }

    context.textBaseline = "top";
    context.fillStyle = line.color;
    context.font = line.font;
    let x = line.x;
    for (const segment of line.segments ?? []) {
      context.font = segment.bold
        ? line.font.replace(/^(\d)/, "700 $1")
        : line.font;
      context.fillText(segment.text, x, line.y);
      x += context.measureText(segment.text).width;
    }
  }
}

function wrapMarkdownInlineSegments(
  text: string,
  maxWidth: number,
  font: string,
) {
  const segments = parseMarkdownInlineSegments(text);
  const rows: SummaryDrawSegment[][] = [];
  let currentRow: SummaryDrawSegment[] = [];
  let currentWidth = 0;

  for (const segment of segments) {
    const tokens = segment.text.split(/(\s+)/).filter(Boolean);
    for (const token of tokens) {
      const tokenWidth = measureCanvasText(token, font, segment.bold);
      if (currentRow.length > 0 && currentWidth + tokenWidth > maxWidth) {
        rows.push(trimDrawSegments(currentRow));
        currentRow = [];
        currentWidth = 0;
      }
      currentRow.push({ text: token, bold: segment.bold });
      currentWidth += tokenWidth;
    }
  }

  if (currentRow.length > 0) {
    rows.push(trimDrawSegments(currentRow));
  }

  return rows.length > 0 ? rows : [[{ text, bold: false }]];
}

function parseMarkdownInlineSegments(text: string): SummaryDrawSegment[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return { text: part.slice(2, -2), bold: true };
    }
    return { text: part, bold: false };
  });
}

function wrapPlainText(text: string, maxWidth: number, font: string) {
  const rows: string[] = [];
  for (const sourceLine of text.split("\n")) {
    const tokens = sourceLine.split(/(\s+)/).filter(Boolean);
    let row = "";
    for (const token of tokens) {
      const next = `${row}${token}`;
      if (row && measureCanvasText(next, font, false) > maxWidth) {
        rows.push(row.trimEnd());
        row = token.trimStart();
      } else {
        row = next;
      }
    }
    rows.push(row || " ");
  }
  return rows;
}

function trimDrawSegments(segments: SummaryDrawSegment[]) {
  const next = [...segments];
  while (next[0]?.text.trim() === "") {
    next.shift();
  }
  while (next.at(-1)?.text.trim() === "") {
    next.pop();
  }
  return next;
}

function measureCanvasText(text: string, font: string, bold: boolean) {
  const canvas = measureCanvasText.canvas ?? document.createElement("canvas");
  measureCanvasText.canvas = canvas;
  const context = canvas.getContext("2d");
  if (!context) {
    return text.length * 10;
  }
  context.font = bold ? font.replace(/^(\d)/, "700 $1") : font;
  return context.measureText(text).width;
}
measureCanvasText.canvas = null as HTMLCanvasElement | null;

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function copyTextWithTextarea(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
