import { VISIT_SCHEDULE_TIMEZONE_OFFSET_MINUTES } from "./visit-scheduling.js";

export const EARLY_START_GRACE_MS = 5 * 60 * 1000;

const getDaypartStart = (scheduledDate, visitPeriod) => {
  const storedDate = new Date(scheduledDate);
  if (
    Number.isNaN(storedDate.getTime()) ||
    !["morning", "afternoon"].includes(visitPeriod)
  ) {
    return storedDate;
  }

  const manilaDate = new Date(
    storedDate.getTime() + VISIT_SCHEDULE_TIMEZONE_OFFSET_MINUTES * 60 * 1000,
  );
  const localHour = visitPeriod === "afternoon" ? 12 : 0;
  return new Date(
    Date.UTC(
      manilaDate.getUTCFullYear(),
      manilaDate.getUTCMonth(),
      manilaDate.getUTCDate(),
      localHour - VISIT_SCHEDULE_TIMEZONE_OFFSET_MINUTES / 60,
    ),
  );
};

export const getEarlyStartTiming = (
  scheduledDate,
  now = new Date(),
  visitPeriod,
) => {
  const scheduledAt = getDaypartStart(scheduledDate, visitPeriod);
  const startedAt = new Date(now);
  const timeUntilVisit = scheduledAt.getTime() - startedAt.getTime();

  if (
    Number.isNaN(scheduledAt.getTime()) ||
    Number.isNaN(startedAt.getTime()) ||
    timeUntilVisit <= EARLY_START_GRACE_MS
  ) {
    return {
      isEarly: false,
      earlyStartMinutes: 0,
      scheduledAt,
      startedAt,
    };
  }

  return {
    isEarly: true,
    earlyStartMinutes: Math.ceil(timeUntilVisit / (60 * 1000)),
    scheduledAt,
    startedAt,
  };
};
