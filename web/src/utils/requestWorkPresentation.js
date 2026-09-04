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
    if (workflowType === "pd") return "pregnancy";
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

const localDateKey = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const deriveScheduleState = (scheduleDate, now = new Date()) => {
  const scheduleKey = localDateKey(scheduleDate);
  const todayKey = localDateKey(now);
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

  const serviceType = normalizeServiceType(item);
  const scheduleState = deriveScheduleState(
    item.schedule?.date || item.scheduledDate || item.dueDate,
    now,
  );

  if (serviceType === "health") {
    const handlingMethod = getHandlingMethod(item);

    if (handlingMethod === "farm_visit") {
      if (scheduleState) return scheduleState;
      return "needs_scheduling";
    }

    if (["advice", "office_pickup"].includes(handlingMethod)) {
      return "needs_response";
    }

    // No handling method chosen yet
    if (scheduleState) return scheduleState;
    if (
      [
        "scheduled",
        "approved",
        "assigned",
        "triaged",
        "claimed",
        "in_progress",
        "ready_today",
      ].includes(status)
    ) {
      return "needs_response";
    }
    return "open";
  }

  if (scheduleState) return scheduleState;
  if (
    [
      "scheduled",
      "approved",
      "assigned",
      "in_progress",
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
    due_today: {
      label: "Due Today",
      tone: "amber",
      badgeClass: "badge-warning",
    },
    overdue: { label: "Overdue", tone: "red", badgeClass: "badge-error" },
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
