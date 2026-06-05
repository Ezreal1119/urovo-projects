import { useEffect, useState } from "react";
import { formatDateTimeFull } from "../formatters";

export type NextActionJobInfo = {
  status: "pending" | "running" | "succeeded" | "failed";
  scheduledFor?: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
};

export function isNextActionLocked(job: NextActionJobInfo | undefined) {
  return job?.status === "pending" || job?.status === "running";
}

export function NextActionCountdown({
  job,
}: {
  job?: NextActionJobInfo;
}) {
  const active = isNextActionLocked(job);
  const now = useCountdownNow(active);

  if (!active || !job) {
    return null;
  }

  const text =
    job.status === "running"
      ? "Updating now"
      : `Updates in ${formatRemainingTime(msUntil(job.scheduledFor, now))}`;
  const title =
    job.status === "pending" && job.scheduledFor
      ? `AI Next Action scheduled for ${formatDateTimeFull(job.scheduledFor)}`
      : "AI Next Action is updating";

  return (
    <span
      title={title}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 shadow-sm shadow-emerald-100"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5"
        fill="none"
      >
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M8 4.5V8l2.4 1.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
      {text}
    </span>
  );
}

function useCountdownNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      return;
    }
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [active]);

  return now;
}

function msUntil(value: string | undefined, now: number) {
  if (!value) {
    return 0;
  }
  const scheduledAt = Date.parse(
    /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}+08:00`,
  );
  if (!Number.isFinite(scheduledAt)) {
    return 0;
  }
  return Math.max(0, scheduledAt - now);
}

function formatRemainingTime(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
