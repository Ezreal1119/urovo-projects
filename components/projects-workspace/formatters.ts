import { APP_TIME_ZONE, beijingTodayDate } from "@/lib/time";

export function formatDate(value: string) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
}

export function formatDateOnly(value: string) {
  if (!value) {
    return "-";
  }
  return dateInputValue(value);
}

export function formatDateTimeFull(value: string) {
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

export function formatBeijingDateTime(value: string) {
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

export function hasExplicitTimeZone(value: string) {
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
}

export function dateInputValue(value: string) {
  return value.includes("T") ? value.split("T")[0] : value;
}

export function todayDate() {
  return beijingTodayDate();
}

export function createUuid() {
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

export function formatBytes(bytes: number) {
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

export function parentReferencePath(currentPath: string) {
  if (currentPath === "docs") {
    return "docs";
  }
  const parts = currentPath.split("/").filter(Boolean);
  parts.pop();
  return parts.length === 0 ? "docs" : parts.join("/");
}
