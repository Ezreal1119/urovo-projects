"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
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
  system: "System",
};

export default function ProjectsWorkspace() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [globalQuery, setGlobalQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [editingNextActionId, setEditingNextActionId] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");

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
    if (!query) {
      return tickets;
    }
    return tickets.filter((ticket) =>
      [ticket.id, ticket.title, ticket.summary, ticket.next_action, ticket.status, ticket.priority]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [tickets, globalQuery]);

  const metrics = useMemo(() => {
    return {
      total: tickets.length,
      active: tickets.filter((ticket) => ticket.status !== "resolved").length,
      elevated: tickets.filter((ticket) => ["high", "urgent"].includes(ticket.priority)).length,
      pendingCustomer: tickets.filter((ticket) => ticket.status === "pending_customer").length,
    };
  }, [tickets]);

  async function loadProject(folder: string) {
    setSelectedFolder(folder);
    setSelectedTicketId("");
    setError("");
    try {
      const data = await api<{ project: ProjectInfo; tickets: Ticket[] }>(`${projectApiPath(folder)}/tickets`);
      setSelectedProject(data.project);
      setTickets(data.tickets);
    } catch (requestError) {
      setError((requestError as Error).message);
      setSelectedProject(null);
      setTickets([]);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialProjects() {
      setLoading(true);
      setError("");
      try {
        const data = await api<{ projects: ProjectListItem[] }>("/api/projects");
        if (cancelled) {
          return;
        }
        setProjects(data.projects);
        if (data.projects.length > 0) {
          const firstFolder = data.projects[0].folder;
          setSelectedFolder(firstFolder);
          const projectData = await api<{ project: ProjectInfo; tickets: Ticket[] }>(
            `${projectApiPath(firstFolder)}/tickets`,
          );
          if (!cancelled) {
            setSelectedProject(projectData.project);
            setTickets(projectData.tickets);
          }
        }
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
      setSelectedTicketId(data.ticket.id);
      setShowNewTicket(false);
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
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8fb] text-slate-950">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/90 px-5 backdrop-blur">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Image
            src="/patrick.png"
            alt="Urovo Projects"
            width={36}
            height={36}
            className="h-9 w-9 rounded-lg object-cover"
            priority
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-950">Urovo Projects</div>
          </div>
        </div>
        <label className="relative hidden w-full max-w-md md:block">
          <span className="sr-only">Search tickets</span>
          <input
            value={globalQuery}
            onChange={(event) => setGlobalQuery(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
            placeholder="Search tickets"
          />
        </label>
        <button
          onClick={() => setShowNewTicket(true)}
          disabled={!selectedFolder}
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

          {selectedProject ? (
            <>
              <ProjectHeader project={selectedProject} />
              <section className="mt-5 grid gap-3 md:grid-cols-4">
                <Metric label="Total tickets" value={metrics.total} />
                <Metric label="Active tickets" value={metrics.active} />
                <Metric label="High / urgent" value={metrics.elevated} />
                <Metric label="Pending customer" value={metrics.pendingCustomer} />
              </section>

              <section className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">Ticket Dashboard</h2>
                  <span className="text-xs text-slate-500">{filteredTickets.length} shown</span>
                </div>
                <div className="space-y-3">
                  {filteredTickets.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      active={ticket.id === selectedTicketId}
                      onClick={() => setSelectedTicketId(ticket.id)}
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
          onClose={() => setSelectedTicketId("")}
          onSave={(draft) => void updateTicket(selectedTicket.id, draft)}
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
          onCreate={(draft) => void createTicket(draft)}
        />
      ) : null}

      {toast ? <Toast message={toast} /> : null}
    </div>
  );
}

function ProjectHeader({ project }: { project: ProjectInfo }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{project.project_name}</h1>
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
              {project.status || "active"}
            </span>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">{project.description || "No description."}</p>
        </div>
        <dl className="grid min-w-64 grid-cols-2 gap-3 text-sm">
          <Info label="Country" value={project.country || "-"} />
          <Info label="Customer" value={project.customer || "-"} />
          <Info label="Project ID" value={project.project_id || "-"} />
          <Info label="Updated" value={formatDate(project.updated_at)} />
        </dl>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{label}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 truncate font-medium text-slate-900">{value}</dd>
    </div>
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
          <h3 className="line-clamp-2 text-base text-slate-950">
            <strong className="font-semibold">[{ticket.id}]</strong>
            <span className="font-semibold">: {ticket.title}</span>
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
  onCreate: (draft: TicketDraft) => void;
}) {
  return (
    <Overlay>
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Ticket</h2>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
          >
            Close
          </button>
        </div>
        <TicketForm initial={emptyTicketDraft} saving={saving} submitLabel="Create ticket" onSubmit={onCreate} />
      </div>
    </Overlay>
  );
}

function TicketDrawer({
  ticket,
  saving,
  onClose,
  onSave,
  onDelete,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
}: {
  ticket: Ticket;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: TicketDraft) => void;
  onDelete: () => void;
  onAddEvent: (draft: EventDraft) => void;
  onUpdateEvent: (index: number, draft: EventDraft) => void;
  onDeleteEvent: (index: number) => void;
}) {
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
            onSubmit={onSave}
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
  onSubmit,
}: {
  initial: TicketDraft;
  saving: boolean;
  submitLabel: string;
  showNextAction?: boolean;
  onSubmit: (draft: TicketDraft) => void;
}) {
  const [draft, setDraft] = useState<TicketDraft>(initial);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(draft);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Title">
        <input
          required
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          className="form-input"
          placeholder="Describe the issue"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Status">
          <select
            value={draft.status}
            onChange={(event) => setDraft({ ...draft, status: event.target.value as TicketStatus })}
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
            onChange={(event) => setDraft({ ...draft, priority: event.target.value as TicketPriority })}
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
          onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
          className="form-input min-h-28 resize-y"
          placeholder="Current issue context and investigation notes"
        />
      </Field>
      {showNextAction ? (
        <Field label="Next action">
          <textarea
            value={draft.next_action}
            onChange={(event) => setDraft({ ...draft, next_action: event.target.value })}
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
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
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
      <div className="mt-2 text-[11px] text-slate-400">Event index {index}</div>
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
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
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
  const normalized = value.replace("T", " ");
  if (normalized.length === 10) {
    return `${normalized} 00:00:00`;
  }
  return normalized.slice(0, 19);
}

function dateInputValue(value: string) {
  return value.includes("T") ? value.split("T")[0] : value;
}

function todayDate() {
  return new Date().toISOString().split("T")[0];
}
