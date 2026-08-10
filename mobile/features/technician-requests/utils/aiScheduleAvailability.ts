import type { VisitPeriod } from "../types/technicianRequests.types";

export type AIScheduleTiming = "past" | "current" | "future" | "unknown";

export interface AIScheduleDaypartOption {
  dateKey: string;
  dayLabel: "Today" | "Tomorrow";
  period: VisitPeriod;
  disabled: boolean;
  supportingText?: string;
}

const MANILA_TIME_ZONE = "Asia/Manila";

const philippineDateKey = (value: unknown) => {
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

const addCalendarDays = (dateKey: string, days: number) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return "";
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
};

export const getCurrentAIVisitPeriod = (now = new Date()): VisitPeriod =>
  manilaHour(now) < 12 ? "morning" : "afternoon";

export const getAISchedulePeriodAvailability = (
  scheduledDate: unknown,
  visitPeriod: VisitPeriod,
  now = new Date(),
) => {
  const scheduleKey = philippineDateKey(scheduledDate);
  const todayKey = philippineDateKey(now);
  const disabled =
    Boolean(scheduleKey && todayKey && scheduleKey < todayKey) ||
    (scheduleKey === todayKey &&
      visitPeriod === "morning" &&
      getCurrentAIVisitPeriod(now) === "afternoon");

  return {
    disabled,
    ...(disabled ? { supportingText: "Time has passed" } : {}),
  };
};

export const getAIScheduleDaypartOptions = (
  now = new Date(),
): AIScheduleDaypartOption[] => {
  const todayKey = philippineDateKey(now);
  if (!todayKey) return [];
  const tomorrowKey = addCalendarDays(todayKey, 1);
  const todayMorning = getAISchedulePeriodAvailability(
    todayKey,
    "morning",
    now,
  );

  return [
    {
      dateKey: todayKey,
      dayLabel: "Today",
      period: "morning",
      ...todayMorning,
    },
    {
      dateKey: todayKey,
      dayLabel: "Today",
      period: "afternoon",
      disabled: false,
    },
    {
      dateKey: tomorrowKey,
      dayLabel: "Tomorrow",
      period: "morning",
      disabled: false,
    },
    {
      dateKey: tomorrowKey,
      dayLabel: "Tomorrow",
      period: "afternoon",
      disabled: false,
    },
  ];
};

export const getAIScheduleTiming = (
  scheduledDate: unknown,
  visitPeriod: VisitPeriod | null | undefined,
  now = new Date(),
): AIScheduleTiming => {
  const scheduleKey = philippineDateKey(scheduledDate);
  const todayKey = philippineDateKey(now);
  if (!scheduleKey || !todayKey || !visitPeriod) return "unknown";
  if (scheduleKey < todayKey) return "past";
  if (scheduleKey > todayKey) return "future";

  const currentPeriod = getCurrentAIVisitPeriod(now);
  if (visitPeriod === currentPeriod) return "current";
  return visitPeriod === "morning" ? "past" : "future";
};

export const getRelativeAIScheduleDayLabel = (
  scheduledDate: unknown,
  now = new Date(),
) => {
  const scheduleKey = philippineDateKey(scheduledDate);
  const todayKey = philippineDateKey(now);
  if (!scheduleKey || !todayKey) return null;
  if (scheduleKey === todayKey) return "today";
  if (scheduleKey === addCalendarDays(todayKey, -1)) return "yesterday";
  if (scheduleKey === addCalendarDays(todayKey, 1)) return "tomorrow";

  const displayDate = new Date(`${scheduleKey}T12:00:00+08:00`);
  if (Number.isNaN(displayDate.getTime())) return null;
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: MANILA_TIME_ZONE,
  })
    .format(displayDate)
    .toLowerCase();
};
