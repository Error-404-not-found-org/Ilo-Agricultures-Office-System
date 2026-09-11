import { isFarmerBreedingObservationPendingReview } from "./breedingObservation";

export const OPEN_REQUEST_FILTERS = [
  { value: "all", label: "All" },
  { value: "ai", label: "AI" },
  { value: "health", label: "Health" },
  { value: "pregnancy", label: "Pregnancy" },
];

export const MY_WORK_FILTERS = [
  { value: "all", label: "All" },
  { value: "ai", label: "AI" },
  { value: "health", label: "Health" },
  { value: "pregnancy", label: "Pregnancy" },
  { value: "calving", label: "Calving" },
];

const normalizedValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

export const formatCanonicalVisitSchedule = (schedule = {}) => {
  if (!schedule?.date) return "Not scheduled";

  const date = new Date(schedule.date);
  if (Number.isNaN(date.getTime())) return "Not scheduled";

  const dateLabel = date.toLocaleDateString("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const period = normalizedValue(schedule.visitPeriod);
  const periodLabel =
    period === "morning"
      ? "Morning"
      : period === "afternoon"
        ? "Afternoon"
        : null;

  return [dateLabel, periodLabel].filter(Boolean).join(" · ");
};

export const isDateOnlyWorkflowType = (workflowType) =>
  ["pd", "pregnancy", "cd", "calving"].includes(normalizedValue(workflowType));

export const normalizeServiceType = (itemOrValue) => {
  if (itemOrValue && typeof itemOrValue === "object") {
    const workflowType = normalizedValue(itemOrValue.workflowType);
    if (workflowType === "ai") return "ai";
    if (workflowType === "health") return "health";
    if (
      workflowType === "pd" ||
      workflowType === "pregnancylossreview" ||
      workflowType === "pregnancy_loss_review" ||
      itemOrValue.sourceType === "farmer_pregnancy_loss_report" ||
      itemOrValue.raw?.sourceType === "farmer_pregnancy_loss_report"
    )
      return "pregnancy";
    if (workflowType === "calving") return "calving";

    const candidates = [
      itemOrValue.type,
      itemOrValue.taskType,
      itemOrValue.serviceType,
      itemOrValue.requestType,
      itemOrValue.raw?.taskType,
      itemOrValue.raw?.type,
    ];
    for (const candidate of candidates) {
      const normalized = normalizeServiceType(candidate);
      if (normalized !== "unknown") return normalized;
    }
    return "unknown";
  }

  const value = normalizedValue(itemOrValue);
  if (["ai", "insemination", "artificial_insemination"].includes(value)) {
    return "ai";
  }
  if (
    value === "health" ||
    value.includes("health") ||
    ["treatment", "vaccination", "deworming"].includes(value)
  ) {
    return "health";
  }
  if (
    [
      "pd",
      "pregnancy",
      "pregnancy_check",
      "pregnancy_diagnosis",
      "breeding_verification",
      "breedingfollowup",
      "breeding_follow_up",
    ].includes(value)
  ) {
    return "pregnancy";
  }
  if (["cd", "calving", "calving_assistance"].includes(value)) {
    return "calving";
  }
  return "unknown";
};

export const getServicePresentation = (service) =>
  ({
    ai: {
      label: "AI",
      longLabel: "Artificial Insemination",
      workflow: "insemination",
      tone: "emerald",
      badgeClass: "badge-success",
    },
    health: {
      label: "Health",
      longLabel: "Health Assistance",
      workflow: "health",
      tone: "rose",
      badgeClass: "badge-error",
    },
    pregnancy: {
      label: "Pregnancy",
      longLabel: "Pregnancy Verification",
      workflow: "pregnancy_check",
      tone: "violet",
      badgeClass: "badge-secondary",
    },
    calving: {
      label: "Calving",
      longLabel: "Calving Assistance",
      workflow: "calving",
      tone: "orange",
      badgeClass: "badge-warning",
    },
    unknown: {
      label: "Other service",
      longLabel: "Other service",
      workflow: "service",
      tone: "neutral",
      badgeClass: "badge-ghost",
    },
  })[service] || {
    label: "Other service",
    longLabel: "Other service",
    workflow: "service",
    tone: "neutral",
    badgeClass: "badge-ghost",
  };

const philippineDateKey = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})$/)?.[1];
    if (dateOnly) return dateOnly;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).formatToParts(date);
  const part = (type) =>
    parts.find((datePart) => datePart.type === type)?.value || "";
  return [part("year"), part("month"), part("day")].join("-");
};

export const deriveScheduleState = (scheduleDate, now = new Date()) => {
  const scheduleKey = philippineDateKey(scheduleDate);
  const todayKey = philippineDateKey(now);
  if (!scheduleKey || !todayKey) return null;
  if (scheduleKey < todayKey) return "overdue";
  if (scheduleKey === todayKey) return "due_today";
  return "scheduled";
};

const getHandlingMethod = (item) => {
  const value =
    item?.handlingMethod ||
    item?.raw?.handlingMethod ||
    item?.context?.handlingMethod ||
    item?.triage?.handlingMethod ||
    item?.resolution?.handlingMethod;
  return normalizedValue(value);
};

export const normalizeWorkflowStatus = (item = {}, now = new Date()) => {
  const status = normalizedValue(item.status || item.displayStatus);
  if (["completed", "done", "resolved"].includes(status)) return "completed";
  if (["cancelled", "canceled", "rejected", "declined"].includes(status)) {
    return "cancelled";
  }

  if (isFarmerBreedingObservationPendingReview(item)) {
    return "needs_review";
  }

  if (
    item.sourceType === "farmer_pregnancy_loss_report" ||
    item.raw?.sourceType === "farmer_pregnancy_loss_report" ||
    item.allowedAction === "REVIEW_PREGNANCY_LOSS" ||
    item.workflowType === "PregnancyLossReview" ||
    item.context?.reportId ||
    item.farmerObservation?.reportType === "pregnancy_loss"
  ) {
    return "needs_review";
  }

  const isInProgressCanonical = [
    "in_progress",
    "inprogress",
    "in-progress",
  ].includes(status);
  const hasServiceStarted = Boolean(
    item.serviceStartedAt || item.raw?.serviceStartedAt,
  );
  if (isInProgressCanonical || hasServiceStarted) {
    return "in_progress";
  }

  const serviceType = normalizeServiceType(item);
  const handlingMethod = getHandlingMethod(item);
  const scheduledVisitDate = item.schedule?.date || item.scheduledDate;
  const scheduleState = deriveScheduleState(
    scheduledVisitDate || item.dueDate,
    now,
  );
  const isVisitBased =
    serviceType === "ai" ||
    (serviceType === "health" &&
      (handlingMethod === "farm_visit" || Boolean(scheduledVisitDate)));
  const temporalStatus =
    scheduleState === "due_today"
      ? isVisitBased
        ? "scheduled_today"
        : "due_today"
      : scheduleState === "scheduled" && !isVisitBased
        ? "upcoming"
        : scheduleState;

  if (serviceType === "health") {
    if (handlingMethod === "farm_visit") {
      if (temporalStatus) return temporalStatus;
      return "needs_scheduling";
    }

    if (["advice", "office_pickup"].includes(handlingMethod)) {
      return "needs_response";
    }

    // No handling method chosen yet
    if (temporalStatus) return temporalStatus;
    if (
      [
        "scheduled",
        "approved",
        "assigned",
        "triaged",
        "claimed",
        "ready_today",
      ].includes(status)
    ) {
      return "needs_response";
    }
    return "open";
  }

  if (temporalStatus) return temporalStatus;
  if (
    [
      "scheduled",
      "approved",
      "assigned",
      "ready_today",
    ].includes(status)
  ) {
    return "scheduled";
  }
  return "open";
};

export const getWorkflowStatusPresentation = (status) =>
  ({
    open: { label: "Open", tone: "amber", badgeClass: "badge-warning" },
    needs_review: {
      label: "Needs review",
      tone: "blue",
      badgeClass: "badge-info",
    },
    needs_response: {
      label: "Needs response",
      tone: "blue",
      badgeClass: "badge-info badge-soft",
    },
    claimed: {
      label: "Claimed",
      tone: "blue",
      badgeClass: "badge-info badge-soft",
    },
    needs_scheduling: {
      label: "Needs scheduling",
      tone: "amber",
      badgeClass: "badge-warning",
    },
    scheduled: { label: "Scheduled", tone: "blue", badgeClass: "badge-info" },
    scheduled_today: {
      label: "Scheduled Today",
      tone: "amber",
      badgeClass: "badge-warning",
    },
    upcoming: { label: "Upcoming", tone: "blue", badgeClass: "badge-info" },
    due_today: {
      label: "Due Today",
      tone: "amber",
      badgeClass: "badge-warning",
    },
    overdue: { label: "Overdue", tone: "red", badgeClass: "badge-error" },
    in_progress: {
      label: "In Progress",
      tone: "blue",
      badgeClass: "badge-info badge-soft",
    },
    completed: {
      label: "Completed",
      tone: "green",
      badgeClass: "badge-success",
    },
    cancelled: { label: "Cancelled", tone: "slate", badgeClass: "badge-ghost" },
    triaged: {
      label: "Needs response",
      tone: "blue",
      badgeClass: "badge-info badge-soft",
    },
  })[status] || { label: "Open", tone: "amber", badgeClass: "badge-warning" };

export const matchesServiceFilter = (item, filter) =>
  filter === "all" || normalizeServiceType(item) === filter;

export const toRequestApiType = (filter) =>
  filter === "pregnancy" ? "breeding_verification" : filter;
