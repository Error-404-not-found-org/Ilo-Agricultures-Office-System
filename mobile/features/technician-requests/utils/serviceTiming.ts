export const EARLY_START_GRACE_MS = 5 * 60 * 1000;

export function getEarlyStartMinutes(
  scheduledDate: string | Date | null | undefined,
  now = Date.now(),
) {
  if (!scheduledDate) return 0;

  const scheduledTime = new Date(scheduledDate).getTime();
  if (!Number.isFinite(scheduledTime)) return 0;

  const timeUntilVisit = scheduledTime - now;
  if (timeUntilVisit <= EARLY_START_GRACE_MS) return 0;

  return Math.ceil(timeUntilVisit / (60 * 1000));
}
