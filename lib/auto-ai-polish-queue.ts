import { beijingIsoStringForDate, beijingNowIsoString } from "./time";
import { polishSingleTicketEventSummaries } from "./ticket-event-summaries";

const AUTO_AI_POLISH_DELAY_MS = 120_000;
const TERMINAL_JOB_TTL_MS = 300_000;

export type AutoAiPolishJobStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed";

export type AutoAiPolishJobSnapshot = {
  projectKey: string;
  ticketId: string;
  status: AutoAiPolishJobStatus;
  scheduledFor?: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
};

type AutoAiPolishJob = AutoAiPolishJobSnapshot & {
  key: string;
  timeout?: ReturnType<typeof setTimeout>;
  cleanupTimeout?: ReturnType<typeof setTimeout>;
  rerunScheduledFor?: string;
  rerunAtMs?: number;
};

const jobs = new Map<string, AutoAiPolishJob>();

export function scheduleAutoTicketAiPolish(
  projectKey: string,
  ticketId: string,
): AutoAiPolishJobSnapshot {
  const key = jobKey(projectKey, ticketId);
  const scheduledAtMs = Date.now() + AUTO_AI_POLISH_DELAY_MS;
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

  const job: AutoAiPolishJob = {
    key,
    projectKey,
    ticketId,
    status: "pending",
    scheduledFor,
  };
  job.timeout = setTimeout(() => {
    void runJob(key);
  }, AUTO_AI_POLISH_DELAY_MS);
  jobs.set(key, job);
  return snapshot(job);
}

export function cancelAutoTicketAiPolish(projectKey: string, ticketId: string) {
  return cancelPendingJob(jobKey(projectKey, ticketId));
}

export function cancelProjectAutoTicketAiPolish(projectKey: string) {
  for (const job of jobs.values()) {
    if (job.projectKey === projectKey) {
      cancelPendingJob(job.key);
    }
  }
}

export function readAutoTicketAiPolishJobs(
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
    await polishSingleTicketEventSummaries(job.projectKey, job.ticketId, {
      mode: "auto-single-ticket",
    });
    job.status = "succeeded";
  } catch (error) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : "Unknown AI Polish error.";
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

function scheduleRerun(job: AutoAiPolishJob) {
  const delay = Math.max(0, (job.rerunAtMs ?? Date.now()) - Date.now());
  job.status = "pending";
  job.scheduledFor = job.rerunScheduledFor;
  job.startedAt = undefined;
  job.finishedAt = undefined;
  job.error = undefined;
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

function snapshot(job: AutoAiPolishJob): AutoAiPolishJobSnapshot {
  return {
    projectKey: job.projectKey,
    ticketId: job.ticketId,
    status: job.status,
    scheduledFor: job.scheduledFor,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    error: job.error,
  };
}

function sortSnapshots(a: AutoAiPolishJobSnapshot, b: AutoAiPolishJobSnapshot) {
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
