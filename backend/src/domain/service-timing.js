export const EARLY_START_GRACE_MS = 5 * 60 * 1000;

export const getEarlyStartTiming = (scheduledDate, now = new Date()) => {
  const scheduledAt = new Date(scheduledDate);
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
