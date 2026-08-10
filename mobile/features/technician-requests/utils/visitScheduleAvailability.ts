import type { VisitPeriod } from "../types/technicianRequests.types";

export type VisitScheduleTiming = "past" | "current" | "future" | "unknown";

const MANILA_TIME_ZONE = "Asia/Manila";
const VISIT_AFTERNOON_CUTOFF_HOUR = 18;

export const philippineDateKey = (value: unknown) => {
  if (!value) return null;
  if (typeof value === "string") {
    const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})$/)?.[1];
    if (dateOnly) return dateOnly;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: MANILA_TIME_ZONE,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

const manilaHour = (now: Date) => {
  const hour = new Intl.DateTimeFormat("en-PH", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: MANILA_TIME_ZONE,
  })
    .formatToParts(now)
    .find((part) => part.type === "hour")?.value;
  return Number(hour || 0);
};

export const getCurrentVisitPeriod = (now = new Date()): VisitPeriod =>
  manilaHour(now) < 12 ? "morning" : "afternoon";

export const getVisitScheduleTiming = (
  scheduledDate: unknown,
  visitPeriod: VisitPeriod | null | undefined,
  now = new Date(),
): VisitScheduleTiming => {
  const scheduleKey = philippineDateKey(scheduledDate);
  const todayKey = philippineDateKey(now);
  if (!scheduleKey || !todayKey || !visitPeriod) return "unknown";
  if (scheduleKey < todayKey) return "past";
  if (scheduleKey > todayKey) return "future";

  const currentHour = manilaHour(now);
  if (visitPeriod === "morning") {
    return currentHour < 12 ? "current" : "past";
  }
  if (currentHour < 12) return "future";
  return currentHour < VISIT_AFTERNOON_CUTOFF_HOUR ? "current" : "past";
};

export const getVisitSchedulePeriodAvailability = (
  scheduledDate: unknown,
  visitPeriod: VisitPeriod,
  now = new Date(),
) => {
  const timing = getVisitScheduleTiming(scheduledDate, visitPeriod, now);
  const disabled = timing === "past";
  const requiresConfirmation =
    timing === "current" && visitPeriod === "afternoon";

  return {
    disabled,
    timing,
    requiresConfirmation,
    ...(disabled ? { supportingText: "Time has passed" } : {}),
    ...(requiresConfirmation
      ? { supportingText: "Current period · confirmation required" }
      : {}),
  };
};
