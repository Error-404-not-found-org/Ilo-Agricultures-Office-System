export type AIVisitWorkTiming =
  | "upcoming"
  | "actionable"
  | "overdue"
  | "unknown";

const manilaDateKey = (value: unknown) => {
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

export const getAIVisitWorkTiming = (
  scheduledDate: unknown,
  now = new Date(),
): AIVisitWorkTiming => {
  const scheduleKey = manilaDateKey(scheduledDate);
  const todayKey = manilaDateKey(now);
  if (!scheduleKey || !todayKey) return "unknown";
  if (scheduleKey > todayKey) return "upcoming";
  if (scheduleKey < todayKey) return "overdue";
  return "actionable";
};
