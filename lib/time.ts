export const APP_TIME_ZONE = "Asia/Shanghai";

const beijingDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function beijingNowIsoString() {
  return datePartsToIso(beijingDateTimeFormatter.formatToParts(new Date()));
}

export function beijingTodayDate() {
  return beijingNowIsoString().split("T")[0];
}

function datePartsToIso(parts: Intl.DateTimeFormatPart[]) {
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
}
