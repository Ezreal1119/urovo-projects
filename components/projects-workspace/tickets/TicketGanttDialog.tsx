import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Ticket, TicketStatus } from "@/lib/types";
import { priorityLabels, statusLabels } from "../labels";
import { todayDate } from "../formatters";
import { Overlay } from "../ui";

const DAY_MS = 24 * 60 * 60 * 1000;
const LABEL_WIDTH = 280;
const MIN_BAR_WIDTH = 8;
const FALLBACK_DAY = Date.UTC(1970, 0, 1);

type GanttRow = {
  ticket: Ticket;
  startDay: number;
  endDay: number;
  endSource: "latest_event" | "updated_at" | "today";
};

type InvalidTicket = {
  ticket: Ticket;
  reason: string;
};

type Tick = {
  day: number;
  label: string;
};

type TitleTooltip = {
  text: string;
  left: number;
  top: number;
};

export function TicketGanttDialog({
  tickets,
  onClose,
  onFocusTicket,
}: {
  tickets: Ticket[];
  onClose: () => void;
  onFocusTicket: (ticket: Ticket) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollMetrics, setScrollMetrics] = useState({ left: 0, max: 0 });
  const [titleTooltip, setTitleTooltip] = useState<TitleTooltip | null>(null);
  const today = parseDateOnly(todayDate()) ?? FALLBACK_DAY;
  const { rows, invalidTickets } = useMemo(
    () => buildGanttRows(tickets, today),
    [tickets, today],
  );
  const minDay = Math.min(
    today,
    ...rows.map((row) => row.startDay),
    ...rows.map((row) => row.endDay),
  );
  const maxDay = Math.max(
    today,
    ...rows.map((row) => row.startDay),
    ...rows.map((row) => row.endDay),
  );
  const totalDays = Math.max(1, daysBetween(minDay, maxDay) + 1);
  const dayWidth = widthForTimeline(totalDays);
  const chartWidth = Math.max(760, totalDays * dayWidth);
  const ticks = buildTicks(minDay, maxDay, totalDays);
  const todayOffset = dayOffset(minDay, today) * dayWidth;
  const activeWindowStart = activeStartDay(rows);
  const updateScrollMetrics = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) {
      return;
    }
    setScrollMetrics({
      left: Math.round(scroller.scrollLeft),
      max: Math.max(0, Math.round(scroller.scrollWidth - scroller.clientWidth)),
    });
  }, []);

  useEffect(() => {
    if (rows.length === 0) {
      return;
    }
    if (activeWindowStart !== null) {
      scrollToDay(scrollRef.current, minDay, activeWindowStart, dayWidth, 24);
      return;
    }
    scrollToTodayPosition(scrollRef.current, todayOffset);
  }, [activeWindowStart, dayWidth, minDay, rows.length, todayOffset]);

  useEffect(() => {
    updateScrollMetrics();
    window.addEventListener("resize", updateScrollMetrics);
    return () => window.removeEventListener("resize", updateScrollMetrics);
  }, [chartWidth, rows.length, updateScrollMetrics]);

  function scrollToStart() {
    scrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  }

  function scrollToToday() {
    scrollToTodayPosition(scrollRef.current, todayOffset);
  }

  function scrollToActiveWindow() {
    if (activeWindowStart === null) {
      scrollToStart();
      return;
    }
    scrollToDay(scrollRef.current, minDay, activeWindowStart, dayWidth, 24);
  }

  function setTimelineScroll(value: string) {
    const scroller = scrollRef.current;
    if (!scroller) {
      return;
    }
    const left = Number(value);
    scroller.scrollLeft = left;
    setScrollMetrics({ left, max: scrollMetrics.max });
  }

  function nudgeTimeline(direction: -1 | 1) {
    const scroller = scrollRef.current;
    if (!scroller) {
      return;
    }
    scroller.scrollBy({
      left: direction * Math.max(240, scroller.clientWidth * 0.45),
      behavior: "smooth",
    });
  }

  function showTitleTooltip(ticket: Ticket, rect: DOMRect) {
    const maxWidth = 520;
    setTitleTooltip({
      text: `${ticket.id} ${ticket.title}`,
      left: Math.max(12, Math.min(rect.left + 12, window.innerWidth - maxWidth - 12)),
      top: Math.max(12, Math.min(rect.bottom + 6, window.innerHeight - 92)),
    });
  }

  return (
    <Overlay>
      <div className="flex h-[92vh] w-[96vw] max-w-[1800px] flex-col rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-950">
              Ticket Gantt
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {tickets.length} tickets, ordered by earliest activity date
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {rows.length > 0 ? (
              <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={scrollToActiveWindow}
                  className="rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-950 hover:shadow-sm"
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={scrollToToday}
                  className="rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-950 hover:shadow-sm"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={scrollToStart}
                  className="rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-950 hover:shadow-sm"
                >
                  Start
                </button>
              </div>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
            >
              Close
            </button>
          </div>
        </div>

        {tickets.length === 0 ? (
          <div className="m-5 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No tickets are available for this project.
          </div>
        ) : rows.length === 0 ? (
          <div className="m-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No tickets have enough valid date data to render on the chart.
          </div>
        ) : (
          <>
            <div className="grid gap-3 border-b border-slate-100 px-5 py-3 text-xs text-slate-500 sm:grid-cols-3">
              <div>
                <span className="font-medium text-slate-700">Start:</span>{" "}
                earliest activity
              </div>
              <div>
                <span className="font-medium text-slate-700">Resolved end:</span>{" "}
                latest raw event
              </div>
              <div>
                <span className="font-medium text-slate-700">Active end:</span>{" "}
                today
              </div>
            </div>
            <div
              ref={scrollRef}
              onScroll={() => {
                updateScrollMetrics();
                setTitleTooltip(null);
              }}
              className="min-h-0 flex-1 overflow-auto"
            >
              <div
                className="relative"
                style={{ minWidth: LABEL_WIDTH + chartWidth }}
              >
                <div
                  className="sticky top-0 z-30 grid border-b border-slate-200 bg-white"
                  style={{
                    gridTemplateColumns: `${LABEL_WIDTH}px ${chartWidth}px`,
                  }}
                >
                  <div className="sticky left-0 z-40 border-r border-slate-200 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Ticket
                  </div>
                  <div className="relative h-14 bg-slate-50">
                    {ticks.map((tick) => (
                      <div
                        key={tick.day}
                        className="absolute top-0 h-full border-l border-slate-200"
                        style={{ left: dayOffset(minDay, tick.day) * dayWidth }}
                      >
                        <span className="absolute left-2 top-2 whitespace-nowrap text-xs font-medium text-slate-500">
                          {tick.label}
                        </span>
                      </div>
                    ))}
                    <div
                      className="absolute top-0 h-full border-l-2 border-cyan-500"
                      style={{ left: todayOffset }}
                    >
                      <span className="absolute left-2 bottom-2 whitespace-nowrap rounded-md bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 ring-1 ring-cyan-100">
                        Today
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  {rows.map((row) => (
                    <GanttTicketRow
                      key={row.ticket.uuid ?? row.ticket.id}
                      row={row}
                      minDay={minDay}
                      dayWidth={dayWidth}
                      chartWidth={chartWidth}
                      todayOffset={todayOffset}
                      onFocusTicket={onFocusTicket}
                      onShowTitle={showTitleTooltip}
                      onHideTitle={() => setTitleTooltip(null)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-slate-200 bg-white px-5 py-3">
              <button
                type="button"
                onClick={() => nudgeTimeline(-1)}
                disabled={scrollMetrics.max === 0}
                aria-label="Scroll timeline left"
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-300 bg-white text-lg font-semibold text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ‹
              </button>
              <input
                type="range"
                min={0}
                max={Math.max(1, scrollMetrics.max)}
                value={Math.min(scrollMetrics.left, scrollMetrics.max)}
                onChange={(event) => setTimelineScroll(event.target.value)}
                disabled={scrollMetrics.max === 0}
                aria-label="Timeline horizontal position"
                className="h-7 flex-1 appearance-none bg-transparent accent-slate-950 disabled:opacity-40 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-16 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-slate-300 [&::-moz-range-thumb]:bg-slate-950 [&::-moz-range-thumb]:shadow-sm [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-slate-200 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-slate-200 [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-16 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-slate-300 [&::-webkit-slider-thumb]:bg-slate-950 [&::-webkit-slider-thumb]:shadow-sm"
              />
              <button
                type="button"
                onClick={() => nudgeTimeline(1)}
                disabled={scrollMetrics.max === 0}
                aria-label="Scroll timeline right"
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-300 bg-white text-lg font-semibold text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ›
              </button>
            </div>
          </>
        )}

        {invalidTickets.length > 0 ? (
          <div className="border-t border-amber-100 bg-amber-50 px-5 py-3 text-xs text-amber-800">
            {invalidTickets.length} ticket
            {invalidTickets.length === 1 ? "" : "s"} could not be plotted:{" "}
            {invalidTickets
              .slice(0, 3)
              .map((item) => `${item.ticket.id} (${item.reason})`)
              .join(", ")}
            {invalidTickets.length > 3 ? ", ..." : ""}
          </div>
        ) : null}
      </div>
      {titleTooltip ? (
        <div
          className="pointer-events-none fixed z-50 max-w-xl rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-slate-900 shadow-2xl"
          style={{ left: titleTooltip.left, top: titleTooltip.top }}
        >
          {titleTooltip.text}
        </div>
      ) : null}
    </Overlay>
  );
}

function GanttTicketRow({
  row,
  minDay,
  dayWidth,
  chartWidth,
  todayOffset,
  onFocusTicket,
  onShowTitle,
  onHideTitle,
}: {
  row: GanttRow;
  minDay: number;
  dayWidth: number;
  chartWidth: number;
  todayOffset: number;
  onFocusTicket: (ticket: Ticket) => void;
  onShowTitle: (ticket: Ticket, rect: DOMRect) => void;
  onHideTitle: () => void;
}) {
  const left = dayOffset(minDay, row.startDay) * dayWidth;
  const width = Math.max(
    MIN_BAR_WIDTH,
    (dayOffset(row.startDay, row.endDay) + 1) * dayWidth,
  );
  const barClass = statusBarClass(row.ticket.status);
  const dateRangeText = `${formatUtcDay(row.startDay)} - ${formatUtcDay(row.endDay)}`;
  const showBarLabel = width >= 130;
  const endText =
    row.endSource === "latest_event"
      ? "Latest event"
      : row.endSource === "updated_at"
        ? "Updated"
        : "Today";

  return (
    <div
      className="grid min-h-16 border-b border-slate-100"
      style={{ gridTemplateColumns: `${LABEL_WIDTH}px ${chartWidth}px` }}
    >
      <div
        className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3"
        title={`${row.ticket.id} ${row.ticket.title}`}
        onMouseEnter={(event) =>
          onShowTitle(row.ticket, event.currentTarget.getBoundingClientRect())
        }
        onMouseLeave={onHideTitle}
        onFocus={(event) =>
          onShowTitle(row.ticket, event.currentTarget.getBoundingClientRect())
        }
        onBlur={onHideTitle}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded-md bg-slate-950 px-2 py-0.5 text-xs font-semibold text-white">
            {row.ticket.id}
          </span>
          <span className="truncate text-sm font-semibold text-slate-900">
            {row.ticket.title}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
          <span
            className={`rounded-md px-2 py-0.5 ${statusChipClass(row.ticket.status)}`}
          >
            {statusLabels[row.ticket.status]}
          </span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">
            {priorityLabels[row.ticket.priority]}
          </span>
        </div>
      </div>
      <div className="relative bg-white">
        <div
          className="absolute top-0 h-full border-l border-cyan-200"
          style={{ left: todayOffset }}
        />
        <button
          type="button"
          onClick={() => onFocusTicket(row.ticket)}
          className={`absolute top-5 h-6 rounded-md text-left shadow-sm transition hover:-translate-y-0.5 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-1 ${barClass}`}
          style={{ left, width }}
          title={`${row.ticket.id} ${row.ticket.title}: ${dateRangeText}`}
          aria-label={`Show only ${row.ticket.id}`}
        >
          {showBarLabel ? (
            <span className="block truncate px-2 py-1 text-xs font-semibold text-white">
              {dateRangeText}
            </span>
          ) : null}
        </button>
        <div
          className="absolute top-12 text-[11px] text-slate-500"
          style={{ left }}
        >
          {endText}: {dateRangeText}
        </div>
      </div>
    </div>
  );
}

function buildGanttRows(tickets: Ticket[], today: number) {
  const invalidTickets: InvalidTicket[] = [];
  const rows = tickets.reduce<GanttRow[]>((items, ticket) => {
    const eventDays = validEventDates(ticket);
    const createdDay = parseDateOnly(ticket.created_at);
    const startDay = earliestDate([createdDay, ...eventDays]);
    if (startDay === null) {
      invalidTickets.push({ ticket, reason: "missing activity date" });
      return items;
    }

    const latestEventDay = latestDate(eventDays);
    const fallbackUpdatedDay = parseDateOnly(ticket.updated_at);
    const endDay =
      ticket.status === "resolved"
        ? latestEventDay ?? fallbackUpdatedDay
        : today;
    const endSource =
      ticket.status === "resolved"
        ? latestEventDay !== null
          ? "latest_event"
          : "updated_at"
        : "today";

    if (endDay === null) {
      invalidTickets.push({ ticket, reason: "missing end date" });
      return items;
    }

    items.push({
      ticket,
      startDay,
      endDay: Math.max(startDay, endDay),
      endSource,
    });
    return items;
  }, []);

  rows.sort((left, right) => {
    const activityStart = left.startDay - right.startDay;
    if (activityStart !== 0) {
      return activityStart;
    }
    const id = left.ticket.id.localeCompare(right.ticket.id);
    if (id !== 0) {
      return id;
    }
    return left.ticket.title.localeCompare(right.ticket.title);
  });

  return { rows, invalidTickets };
}

function activeStartDay(rows: GanttRow[]) {
  return earliestDate(
    rows
      .filter((row) => row.ticket.status !== "resolved")
      .map((row) => row.startDay),
  );
}

function scrollToDay(
  scroller: HTMLDivElement | null,
  minDay: number,
  day: number,
  dayWidth: number,
  padding: number,
) {
  if (!scroller) {
    return;
  }
  const targetLeft = LABEL_WIDTH + dayOffset(minDay, day) * dayWidth - padding;
  scroller.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
}

function scrollToTodayPosition(
  scroller: HTMLDivElement | null,
  todayOffset: number,
) {
  if (!scroller) {
    return;
  }
  const targetLeft = LABEL_WIDTH + todayOffset - scroller.clientWidth * 0.72;
  scroller.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
}

function validEventDates(ticket: Ticket) {
  return ticket.events
    .map((event) => parseDateOnly(event.time))
    .filter((day): day is number => day !== null);
}

function earliestDate(days: Array<number | null>) {
  return days.reduce<number | null>((earliest, day) => {
    if (day === null) {
      return earliest;
    }
    return earliest === null ? day : Math.min(earliest, day);
  }, null);
}

function latestDate(days: number[]) {
  return days.reduce<number | null>(
    (latest, day) => (latest === null ? day : Math.max(latest, day)),
    null,
  );
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = Date.UTC(year, month - 1, day);
  const parsed = new Date(date);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function daysBetween(startDay: number, endDay: number) {
  return Math.round((endDay - startDay) / DAY_MS);
}

function dayOffset(startDay: number, day: number) {
  return daysBetween(startDay, day);
}

function widthForTimeline(totalDays: number) {
  if (totalDays > 1095) {
    return 2;
  }
  if (totalDays > 540) {
    return 4;
  }
  if (totalDays > 180) {
    return 8;
  }
  if (totalDays > 90) {
    return 12;
  }
  return 24;
}

function buildTicks(minDay: number, maxDay: number, totalDays: number): Tick[] {
  const ticks: Tick[] = [];
  const step = totalDays <= 45 ? 7 : totalDays <= 180 ? 14 : 1;

  if (totalDays <= 180) {
    for (let day = minDay; day <= maxDay; day += step * DAY_MS) {
      ticks.push({ day, label: formatUtcDay(day) });
    }
    if (ticks.at(-1)?.day !== maxDay) {
      ticks.push({ day: maxDay, label: formatUtcDay(maxDay) });
    }
    return ticks;
  }

  let cursor = firstMonthStart(minDay);
  const monthStep = totalDays > 540 ? 3 : 1;
  if (cursor < minDay) {
    cursor = addUtcMonths(cursor, monthStep);
  }
  ticks.push({ day: minDay, label: formatUtcDay(minDay) });
  while (cursor < maxDay) {
    ticks.push({ day: cursor, label: formatMonthTick(cursor) });
    cursor = addUtcMonths(cursor, monthStep);
  }
  ticks.push({ day: maxDay, label: formatUtcDay(maxDay) });
  return dedupeTicks(ticks);
}

function firstMonthStart(day: number) {
  const date = new Date(day);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function addUtcMonths(day: number, months: number) {
  const date = new Date(day);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1);
}

function dedupeTicks(ticks: Tick[]) {
  const seen = new Set<number>();
  return ticks.filter((tick) => {
    if (seen.has(tick.day)) {
      return false;
    }
    seen.add(tick.day);
    return true;
  });
}

function formatUtcDay(day: number) {
  return new Date(day).toISOString().slice(0, 10);
}

function formatMonthTick(day: number) {
  const [year, month] = formatUtcDay(day).split("-");
  return `${year}-${month}`;
}

function statusBarClass(status: TicketStatus) {
  const classes: Record<TicketStatus, string> = {
    pending_internal: "bg-orange-500",
    pending_customer: "bg-amber-500",
    resolved: "bg-emerald-600",
  };
  return classes[status];
}

function statusChipClass(status: TicketStatus) {
  const classes: Record<TicketStatus, string> = {
    pending_internal: "bg-orange-50 text-orange-800 ring-1 ring-orange-100",
    pending_customer: "bg-amber-50 text-amber-800 ring-1 ring-amber-100",
    resolved: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
  };
  return classes[status];
}
