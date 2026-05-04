import { randomUUID } from "crypto";
import { readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { getProjectsRoot, readProject } from "./projects";
import { beijingNowLogTime, beijingTodayDate } from "./time";
import {
  ChangeLogAction,
  ChangeLogEntityType,
  ChangeLogEntry,
  ChangeLogFile,
} from "./types";

const CHANGE_LOG_VERSION = 1;
const CHANGE_LOG_FILE = "CHANGE_LOG.json";
const CHANGE_LOG_RETENTION_MONTHS = 2;

export type ChangeLogInput = {
  entityType: ChangeLogEntityType;
  entityId: string;
  entityDisplayId?: string;
  action: ChangeLogAction;
  content?: string;
};

export async function appendChangeLogs(projectKey: string, inputs: ChangeLogInput[]) {
  const usefulInputs = inputs.filter((input) => input.entityId);
  if (usefulInputs.length === 0) {
    return;
  }

  const [project, changeLog] = await Promise.all([
    readProject(projectKey),
    readChangeLog(),
  ]);
  const today = beijingTodayDate().replaceAll("-", "");
  const time = beijingNowLogTime();
  let nextSequence = nextDailySequence(changeLog.logs, today);
  const country = project.country || projectKey.split("/")[0] || "";

  const logs: ChangeLogEntry[] = usefulInputs.map((input) => ({
    id: `LOG-${today}-${String(nextSequence++).padStart(3, "0")}`,
    time,
    project_id: project.project_id,
    country,
    project_name: project.project_name,
    entity_type: input.entityType,
    entity_id: input.entityId,
    entity_display_id: input.entityDisplayId || input.entityId,
    action: input.action,
    content: input.content || "",
  }));

  await writeChangeLog({
    version: CHANGE_LOG_VERSION,
    logs: [...pruneOldLogs(changeLog.logs, CHANGE_LOG_RETENTION_MONTHS, time), ...logs],
  });
}

export function visibleEntityId(entity: { id: string; uuid?: string }) {
  return {
    entityId: entity.uuid || entity.id,
    entityDisplayId: entity.id,
  };
}

async function readChangeLog(): Promise<ChangeLogFile> {
  try {
    const raw = await readFile(changeLogPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<ChangeLogFile>;
    return {
      version: CHANGE_LOG_VERSION,
      logs: Array.isArray(parsed.logs) ? parsed.logs.map(normalizeLog) : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: CHANGE_LOG_VERSION, logs: [] };
    }
    throw error;
  }
}

async function writeChangeLog(changeLog: ChangeLogFile) {
  const filePath = changeLogPath();
  const tempFile = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(changeLog, null, 2)}\n`, "utf8");
  await rename(tempFile, filePath);
}

function changeLogPath() {
  return path.join(getProjectsRoot(), CHANGE_LOG_FILE);
}

function nextDailySequence(logs: ChangeLogEntry[], today: string) {
  const prefix = `LOG-${today}-`;
  return (
    logs.reduce((max, log) => {
      if (!log.id.startsWith(prefix)) {
        return max;
      }
      const sequence = Number(log.id.slice(prefix.length));
      return Number.isInteger(sequence) ? Math.max(max, sequence) : max;
    }, 0) + 1
  );
}

function pruneOldLogs(logs: ChangeLogEntry[], months: number, nowLogTime: string) {
  const now = parseLogTime(nowLogTime);
  if (!now) {
    return logs;
  }
  const cutoff = subtractCalendarMonths(now, months);
  return logs.filter((log) => {
    const logTime = parseLogTime(log.time);
    return !logTime || logTime >= cutoff;
  });
}

function subtractCalendarMonths(date: Date, months: number) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() - months);
  return nextDate;
}

function parseLogTime(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/,
  );
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
}

function normalizeLog(log: Partial<ChangeLogEntry>): ChangeLogEntry {
  return {
    id: cleanText(log.id),
    time: cleanText(log.time),
    project_id: cleanText(log.project_id),
    country: cleanText(log.country),
    project_name: cleanText(log.project_name),
    entity_type: pickEntityType(log.entity_type),
    entity_id: cleanText(log.entity_id),
    entity_display_id: cleanText(log.entity_display_id || log.entity_id),
    action: cleanText(log.action) as ChangeLogAction,
    content: cleanText(log.content),
  };
}

function pickEntityType(value: unknown): ChangeLogEntityType {
  return value === "demand" ||
    value === "ticket" ||
    value === "requirement" ||
    value === "project"
    ? value
    : "project";
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
