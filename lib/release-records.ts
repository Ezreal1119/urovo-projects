import { randomUUID } from "crypto";
import { readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { listProjects, projectDir, readOverview, readProject } from "./projects";
import { beijingNowIsoString } from "./time";
import type {
  ReleaseFirmware,
  ReleaseRecord,
  ReleaseRecordFile,
  ReleaseRecordInput,
  ReleaseNoteRow,
} from "./types";

const RELEASE_RECORD_FILE = "release-records.json";
const RELEASE_RECORD_VERSION = 1;

export async function readReleaseRecords(key: string): Promise<ReleaseRecord[]> {
  await readProject(key);
  const file = await readReleaseRecordFile(key);
  return file.records.map(normalizeReleaseRecord).sort(sortReleaseRecords);
}

export async function readReleaseRecordsForModel(
  key: string,
  model: string,
): Promise<ReleaseRecord[]> {
  const cleanModel = cleanText(model);
  if (!cleanModel) {
    throw new Error("Model is required.");
  }
  await assertModelExists(key, cleanModel);
  return (await readReleaseRecords(key)).filter((record) => record.model === cleanModel);
}

export async function createReleaseRecord(
  key: string,
  input: ReleaseRecordInput,
): Promise<ReleaseRecord> {
  const model = cleanText(input.model);
  if (!model) {
    throw new Error("Model is required.");
  }
  await assertModelExists(key, model);
  const records = await readReleaseRecords(key);
  const now = beijingNowIsoString();
  const record = normalizeReleaseRecord({
    id: randomUUID(),
    model,
    firmware: input.firmware,
    change_log: input.change_log,
    release_date: input.release_date,
    order_count: input.order_count,
    order_time: input.order_time,
    created_at: now,
    updated_at: now,
  });
  await writeReleaseRecords(key, [...records, record]);
  return record;
}

export async function updateReleaseRecord(
  key: string,
  recordId: string,
  input: ReleaseRecordInput,
): Promise<ReleaseRecord> {
  const records = await readReleaseRecords(key);
  const index = records.findIndex((record) => record.id === recordId);
  if (index === -1) {
    throw new ReleaseRecordNotFoundError();
  }

  const existing = records[index];
  const nextModel = input.model === undefined ? existing.model : cleanText(input.model);
  if (!nextModel) {
    throw new Error("Model is required.");
  }
  if (nextModel !== existing.model) {
    await assertModelExists(key, nextModel);
  }

  const record = normalizeReleaseRecord({
    ...existing,
    ...input,
    model: nextModel,
    firmware:
      input.firmware === undefined
        ? existing.firmware
        : normalizeFirmware(input.firmware),
    updated_at: beijingNowIsoString(),
  });
  await writeReleaseRecords(key, records.toSpliced(index, 1, record));
  return record;
}

export async function deleteReleaseRecord(key: string, recordId: string) {
  const records = await readReleaseRecords(key);
  const nextRecords = records.filter((record) => record.id !== recordId);
  if (nextRecords.length === records.length) {
    throw new ReleaseRecordNotFoundError();
  }
  await writeReleaseRecords(key, nextRecords);
}

export async function releaseModelsInUse(key: string, models: string[]) {
  const wanted = new Set(models.map(cleanText).filter(Boolean));
  if (wanted.size === 0) {
    return [];
  }
  const records = await readReleaseRecords(key);
  return Array.from(new Set(records.map((record) => record.model))).filter((model) =>
    wanted.has(model),
  );
}

export async function readReleaseNotes(): Promise<ReleaseNoteRow[]> {
  const projects = await listProjects();
  const rows = (
    await Promise.all(
      projects.map(async (item) => {
        const records = await readReleaseRecords(item.folder);
        const country = item.project.country || item.folder.split("/")[0] || "";
        return records
          .filter((record) => record.release_date === null)
          .map((record) => ({
            folder: item.folder,
            country,
            customer: item.project.customer,
            model: record.model,
            change_log: record.change_log,
          }));
      }),
    )
  ).flat();

  return rows.sort(sortReleaseNotes);
}

function sortReleaseNotes(left: ReleaseNoteRow, right: ReleaseNoteRow) {
  return (
    left.country.localeCompare(right.country) ||
    left.customer.localeCompare(right.customer) ||
    left.model.localeCompare(right.model)
  );
}

export function sortReleaseRecords(left: ReleaseRecord, right: ReleaseRecord) {
  if (left.release_date === null && right.release_date !== null) {
    return -1;
  }
  if (left.release_date !== null && right.release_date === null) {
    return 1;
  }
  const leftRelease = left.release_date || "";
  const rightRelease = right.release_date || "";
  if (leftRelease !== rightRelease) {
    return rightRelease.localeCompare(leftRelease);
  }
  if (left.order_time !== right.order_time) {
    return right.order_time.localeCompare(left.order_time);
  }
  return right.updated_at.localeCompare(left.updated_at);
}

async function readReleaseRecordFile(key: string): Promise<ReleaseRecordFile> {
  try {
    const raw = await readFile(releaseRecordPath(key), "utf8");
    const parsed = JSON.parse(raw) as Partial<ReleaseRecordFile>;
    return {
      version: RELEASE_RECORD_VERSION,
      records: Array.isArray(parsed.records) ? parsed.records : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: RELEASE_RECORD_VERSION, records: [] };
    }
    throw error;
  }
}

async function writeReleaseRecords(key: string, records: ReleaseRecord[]) {
  await readProject(key);
  const filePath = releaseRecordPath(key);
  const tempFile = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(
    tempFile,
    `${JSON.stringify(
      {
        version: RELEASE_RECORD_VERSION,
        records: records.map(normalizeReleaseRecord).sort(sortReleaseRecords),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await rename(tempFile, filePath);
}

async function assertModelExists(key: string, model: string) {
  const overview = await readOverview(key);
  if (!overview.models.includes(model)) {
    throw new Error("Release records can only use models from the overview model list.");
  }
}

function releaseRecordPath(key: string) {
  return path.join(projectDir(key), RELEASE_RECORD_FILE);
}

function normalizeReleaseRecord(record: Partial<ReleaseRecord>): ReleaseRecord {
  const now = beijingNowIsoString();
  return {
    id: cleanText(record.id) || randomUUID(),
    model: cleanText(record.model),
    firmware: normalizeFirmware(record.firmware),
    change_log: cleanText(record.change_log),
    release_date: normalizeReleaseDate(record.release_date),
    order_count: normalizeOrderCount(record.order_count),
    order_time: normalizeOrderTime(record.order_time),
    created_at: cleanText(record.created_at) || now,
    updated_at: cleanText(record.updated_at) || now,
  };
}

function normalizeFirmware(firmware: unknown): ReleaseFirmware {
  const current =
    firmware && typeof firmware === "object"
      ? (firmware as Partial<ReleaseFirmware>)
      : {};
  return {
    os: cleanText(current.os),
    ufs: cleanText(current.ufs),
    se: cleanText(current.se),
  };
}

function normalizeReleaseDate(value: unknown) {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const cleanValue = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(cleanValue) ? cleanValue : null;
}

function normalizeOrderCount(value: unknown) {
  if (value === null || value === "" || value === undefined) {
    return null;
  }
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0
    ? numericValue
    : null;
}

function normalizeOrderTime(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }
  const cleanValue = value.trim();
  return /^\d{4}-\d{2}$/.test(cleanValue) ? cleanValue : "";
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export class ReleaseRecordNotFoundError extends Error {
  constructor() {
    super("Release record not found.");
    this.name = "ReleaseRecordNotFoundError";
  }
}
