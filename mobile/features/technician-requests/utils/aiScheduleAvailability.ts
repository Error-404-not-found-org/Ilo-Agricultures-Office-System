import type { VisitPeriod } from "../types/technicianRequests.types";
import {
  getCurrentVisitPeriod,
  getVisitSchedulePeriodAvailability,
  getVisitScheduleTiming,
  philippineDateKey,
} from "./visitScheduleAvailability";

export type AIScheduleTiming = "past" | "current" | "future" | "unknown";

const MANILA_TIME_ZONE = "Asia/Manila";

export interface AIScheduleDaypartOption {
  dateKey: string;
  dayLabel: "Today" | "Tomorrow";
  period: VisitPeriod;
  disabled: boolean;
  supportingText?: string;
}

const addCalendarDays = (dateKey: string, days: number) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return "";
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
};

export const getCurrentAIVisitPeriod = (now = new Date()): VisitPeriod =>
  getCurrentVisitPeriod(now);

export const getAISchedulePeriodAvailability = (
  scheduledDate: unknown,
  visitPeriod: VisitPeriod,
  now = new Date(),
) => getVisitSchedulePeriodAvailability(scheduledDate, visitPeriod, now);

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
      ...getAISchedulePeriodAvailability(todayKey, "afternoon", now),
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
): AIScheduleTiming => getVisitScheduleTiming(scheduledDate, visitPeriod, now);

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
