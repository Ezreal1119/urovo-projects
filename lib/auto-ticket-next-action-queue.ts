import { beijingIsoStringForDate, beijingNowIsoString } from "./time";
import { generateTicketNextAction } from "./ticket-next-action";
import type { Ticket } from "./types";

const AUTO_NEXT_ACTION_DELAY_MS = 120_000;
const TERMINAL_JOB_TTL_MS = 300_000;

export type AutoTicketNextActionJobStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed";

export type AutoTicketNextActionJobSnapshot = {
  projectKey: string;
  ticketId: string;
  status: AutoTicketNextActionJobStatus;
  scheduledFor?: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  ticket?: Ticket;
};

type AutoTicketNextActionJob = AutoTicketNextActionJobSnapshot & {
  key: string;
  timeout?: ReturnType<typeof setTimeout>;
  cleanupTimeout?: ReturnType<typeof setTimeout>;
  rerunScheduledFor?: string;
  rerunAtMs?: number;
  ticket?: Ticket;
};

const jobs = new Map<string, AutoTicketNextActionJob>();

export function scheduleAutoTicketNextAction(
  projectKey: string,
  ticketId: string,
): AutoTicketNextActionJobSnapshot {
  const key = jobKey(projectKey, ticketId);
  const scheduledAtMs = Date.now() + AUTO_NEXT_ACTION_DELAY_MS;
  const scheduledFor = beijingIsoStringForDate(new Date(scheduledAtMs));
  const existing = jobs.get(key);

  if (existing?.status === "running") {
    existing.rerunAtMs = scheduledAtMs;
    existing.rerunScheduledFor = scheduledFor;
    existing.scheduledFor = scheduledFor;
    return snapshot(existing);
  }

  if (existing?.timeout) {
    clearTimeout(existing.timeout);
  }
  if (existing?.cleanupTimeout) {
    clearTimeout(existing.cleanupTimeout);
  }

  const job: AutoTicketNextActionJob = {
    key,
    projectKey,
    ticketId,
    status: "pending",
    scheduledFor,
  };
  job.timeout = setTimeout(() => {
    void runJob(key);
  }, AUTO_NEXT_ACTION_DELAY_MS);
  jobs.set(key, job);
  return snapshot(job);
}

export function readAutoTicketNextActionJobs(
  projectKey: string,
  options: { consumeTerminal?: boolean } = {},
) {
  const snapshots = Array.from(jobs.values())
    .filter((job) => job.projectKey === projectKey)
    .map(snapshot)
    .sort(sortSnapshots);

  if (options.consumeTerminal) {
    for (const item of snapshots) {
      if (item.status === "succeeded" || item.status === "failed") {
        cancelJob(jobKey(item.projectKey, item.ticketId));
      }
    }
  }

  return snapshots;
}

export function cancelAutoTicketNextAction(projectKey: string, ticketId: string) {
  return cancelPendingJob(jobKey(projectKey, ticketId));
}

async function runJob(key: string) {
  const job = jobs.get(key);
  if (!job) {
    return;
  }

  job.status = "running";
  job.startedAt = beijingNowIsoString();
  job.error = undefined;
  job.finishedAt = undefined;
  job.timeout = undefined;

  try {
    const result = await generateTicketNextAction(job.projectKey, job.ticketId);
    job.ticket = result.ticket;
    job.status = "succeeded";
  } catch (error) {
    job.status = "failed";
    job.error =
      error instanceof Error ? error.message : "Unknown AI Next Action error.";
  } finally {
    job.finishedAt = beijingNowIsoString();
  }

  if (job.rerunAtMs && job.rerunScheduledFor) {
    scheduleRerun(job);
    return;
  }

  job.cleanupTimeout = setTimeout(() => {
    cancelJob(key);
  }, TERMINAL_JOB_TTL_MS);
}

function scheduleRerun(job: AutoTicketNextActionJob) {
  const delay = Math.max(0, (job.rerunAtMs ?? Date.now()) - Date.now());
  job.status = "pending";
  job.scheduledFor = job.rerunScheduledFor;
  job.startedAt = undefined;
  job.finishedAt = undefined;
  job.error = undefined;
  job.ticket = undefined;
  job.rerunAtMs = undefined;
  job.rerunScheduledFor = undefined;
  job.timeout = setTimeout(() => {
    void runJob(job.key);
  }, delay);
}

function cancelJob(key: string) {
  const job = jobs.get(key);
  if (!job) {
    return false;
  }
  if (job.timeout) {
    clearTimeout(job.timeout);
  }
  if (job.cleanupTimeout) {
    clearTimeout(job.cleanupTimeout);
  }
  jobs.delete(key);
  return true;
}

function cancelPendingJob(key: string) {
  const job = jobs.get(key);
  if (!job) {
    return false;
  }
  if (job.status === "running") {
    job.rerunAtMs = undefined;
    job.rerunScheduledFor = undefined;
    return false;
  }
  return cancelJob(key);
}

function snapshot(
  job: AutoTicketNextActionJob,
): AutoTicketNextActionJobSnapshot {
  return {
    projectKey: job.projectKey,
    ticketId: job.ticketId,
    status: job.status,
    scheduledFor: job.scheduledFor,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    error: job.error,
    ticket: job.ticket,
  };
}

function sortSnapshots(
  a: AutoTicketNextActionJobSnapshot,
  b: AutoTicketNextActionJobSnapshot,
) {
  const time =
    (a.scheduledFor ?? a.startedAt ?? a.finishedAt ?? "").localeCompare(
      b.scheduledFor ?? b.startedAt ?? b.finishedAt ?? "",
    );
  if (time !== 0) {
    return time;
  }
  return a.ticketId.localeCompare(b.ticketId);
}

function jobKey(projectKey: string, ticketId: string) {
  return `${projectKey}:${ticketId}`;
}
