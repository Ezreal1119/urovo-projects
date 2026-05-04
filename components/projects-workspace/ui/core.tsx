import type { ReactNode } from "react";
import type { RequirementStatus, TicketPriority, TicketStatus } from "@/lib/types";
import { priorityLabels, requirementStatusLabels, statusLabels } from "../labels";

export function ChartPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

export function PieChart({
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

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
      {text}
    </div>
  );
}

export function Pagination({
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

export function Metric({
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

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
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

export function RequirementStatusBadge({ status }: { status: RequirementStatus }) {
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

export function StatusBadge({ status }: { status: TicketStatus }) {
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

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
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

export function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/30 p-4">
      {children}
    </div>
  );
}

export function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-800 shadow-xl">
      {message}
    </div>
  );
}
