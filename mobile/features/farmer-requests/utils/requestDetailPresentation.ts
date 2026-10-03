const EMPTY_REQUEST_VALUES = new Set([
  "",
  "-",
  "--",
  "n/a",
  "n.a.",
  "na",
  "none",
  "null",
  "undefined",
  "not available",
  "not applicable",
  "not provided",
  "unknown",
]);

export const getRequestText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return null;

  const text = String(value).trim();
  if (EMPTY_REQUEST_VALUES.has(text.toLowerCase())) return null;

  return text;
};

export const hasRequestValue = (value: unknown) =>
  getRequestText(value) !== null;

export const getRequestList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map(getRequestText)
    .filter((item): item is string => item !== null);
};

export const getFarmerAIVisitGuidance = (
  request: { farmerPreparationNote?: unknown } | null | undefined,
): { label: "Before the Visit"; value: string } | null => {
  const value = getRequestText(request?.farmerPreparationNote);
  return value ? { label: "Before the Visit", value } : null;
};

export const formatRequestDateTime = (
  value: unknown,
  formatter: (date: Date) => string,
): string | null => {
  const date = value instanceof Date
    ? value
    : new Date(getRequestText(value) || "");
  if (Number.isNaN(date.getTime())) return null;

  return formatter(date);
};

export const formatVisitPeriod = (value: unknown): string | null => {
  const period = getRequestText(value)?.toLowerCase();
  if (period === "morning") return "Morning";
  if (period === "afternoon") return "Afternoon";
  return null;
};

export const formatVisitSchedule = (
  scheduledDate: unknown,
  visitPeriod: unknown,
): string | null => {
  const dateLabel = formatRequestDateTime(scheduledDate, (date) =>
    new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Manila",
    }).format(date),
  );
  if (!dateLabel) return null;

  const periodLabel = formatVisitPeriod(visitPeriod);
  return periodLabel ? `${dateLabel} · ${periodLabel}` : dateLabel;
};

const formatPhilippineCalendarKey = (value: unknown): string | null =>
  formatRequestDateTime(value, (date) => {
    const parts = new Intl.DateTimeFormat("en-PH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Manila",
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((item) => item.type === type)?.value || "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  });

export const isVisitTodayOrLater = (
  scheduledDate: unknown,
  now: Date = new Date(),
): boolean => {
  const scheduledDay = formatPhilippineCalendarKey(scheduledDate);
  const today = formatPhilippineCalendarKey(now);
  return Boolean(scheduledDay && today && scheduledDay >= today);
};

const normalizeRequestStatus = (value: unknown) =>
  getRequestText(value)?.toLowerCase() || "unknown";

export const getFarmerAIStatusLabel = (value: unknown): string => {
  const status = normalizeRequestStatus(value);

  if (status === "pending") return "Submitted";
  if (["approved", "assigned", "triaged"].includes(status)) {
    return "Scheduling Pending";
  }
  if (status === "scheduled") return "Scheduled";
  if (["in-progress", "in_progress"].includes(status)) return "In Progress";
  if (["done", "completed", "resolved"].includes(status)) return "Completed";
  if (status === "cancelled") return "Cancelled";
  if (status === "rejected") return "Not Approved";

  return "Status Unavailable";
};

export const getFarmerAIProgressIndex = (value: unknown): number => {
  const status = normalizeRequestStatus(value);

  if (status === "scheduled") return 1;
  if (["in-progress", "in_progress"].includes(status)) return 2;
  if (["done", "completed", "resolved"].includes(status)) return 3;

  // Pending and legacy accepted-but-unscheduled records remain before the
  // canonical Scheduled milestone rather than introducing Approved as a step.
  return 0;
};

export const getFarmerAINextStepMessage = (
  value: unknown,
  visitSchedule: string | null,
): string => {
  const status = normalizeRequestStatus(value);

  if (status === "pending") {
    return "Your request has been submitted. A technician will review it.";
  }
  if (["approved", "assigned", "triaged"].includes(status)) {
    return "A technician has accepted your request. Visit scheduling is still pending.";
  }
  if (status === "scheduled") {
    return visitSchedule
      ? `Your AI visit is scheduled for ${visitSchedule}. Please make sure the animal is accessible for the technician.`
      : "Your AI visit is scheduled. The visit date is not yet available.";
  }
  if (["in-progress", "in_progress"].includes(status)) {
    return "The technician has started the AI service.";
  }
  if (["done", "completed", "resolved"].includes(status)) {
    return "The AI service has been completed. Continue monitoring the animal for the next reproductive milestone.";
  }
  if (status === "cancelled") {
    return "This request has been cancelled.";
  }
  if (status === "rejected") {
    return "This request was not approved. Review the technician's notes before submitting another request.";
  }

  return "The next step for this request is not yet available.";
};

export type FarmerRequestService = "ai" | "health";

export const getFarmerRequestFilterQuery = (
  service: FarmerRequestService,
  filter: string,
): { status?: string; statusGroup?: "pending" | "in_progress" } => {
  if (filter === "completed") {
    return { status: service === "ai" ? "done" : "resolved" };
  }
  if (filter === "in-progress") return { statusGroup: "in_progress" };
  if (service === "health" && filter === "pending") {
    return { statusGroup: "pending" };
  }
  return { status: filter };
};

export const getFarmerHealthStatusLabel = (
  value: unknown,
  handlingMethod?: unknown,
): string => {
  const status = normalizeRequestStatus(value).replaceAll("-", "_");
  const method = normalizeRequestStatus(handlingMethod).replaceAll("-", "_");

  if (status === "pending") return "Awaiting Review";
  if (["approved", "assigned", "triaged"].includes(status)) {
    return "Under Review";
  }
  if (status === "scheduled") return "Scheduled";
  if (status === "in_progress") return "In Progress";
  if (["resolved", "done", "completed"].includes(status)) {
    if (method === "advice") return "Advice Provided";
    if (method === "office_pickup") return "Pickup Arranged";
    if (method === "farm_visit") return "Completed";
    return "Resolved";
  }
  if (status === "cancelled") return "Cancelled";
  if (status === "rejected") return "Not Approved";
  return "Status Unavailable";
};

export const getFarmerRequestListStatusLabel = (value: unknown): string => {
  const status = normalizeRequestStatus(value);

  if (status === "pending") return "Pending";
  if (["approved", "assigned", "triaged"].includes(status)) {
    return "Scheduling Pending";
  }
  if (status === "scheduled") return "Scheduled";
  if (["in-progress", "in_progress"].includes(status)) return "In Progress";
  if (["done", "resolved", "completed"].includes(status)) return "Completed";
  if (status === "pending_cancellation") return "Pending Cancellation";
  if (status === "cancelled") return "Cancelled";
  if (status === "rejected") return "Not Approved";

  return "Status Unavailable";
};
