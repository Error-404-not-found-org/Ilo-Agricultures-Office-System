const PHILIPPINE_TIME_ZONE = "Asia/Manila";

const TERMINAL_STATUSES = new Set([
  "cancelled",
  "canceled",
  "completed",
  "done",
  "failed",
  "rejected",
  "resolved",
]);

const ACTIVE_TASK_STATUSES = new Set(["pending", "in progress", "in-progress"]);
const ACTIVE_VISIT_STATUSES = new Set([
  "approved",
  "assigned",
  "in progress",
  "in-progress",
  "scheduled",
]);
const REQUEST_TASK_TYPES = new Set([
  "ai",
  "health",
  "treatment",
  "vaccination",
  "deworming",
]);

const normalizeValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", " ");

const idOf = (value) => {
  const resolved = value?._id ?? value?.id ?? value;
  return resolved == null ? null : String(resolved);
};

const datePartsInManila = (date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PHILIPPINE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const valueByType = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return (
    valueByType.year + "-" + valueByType.month + "-" + valueByType.day
  );
};

export const getPhilippineDateKey = (value) => {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : datePartsInManila(date);
};

export const getPhilippineTodayKey = (now = new Date()) =>
  getPhilippineDateKey(now);

export const getScheduleEntityKind = (item = {}) => {
  const raw = item.raw || {};
  const type = normalizeValue(item.type || item.workflowType);
  const taskType = normalizeValue(item.taskType || raw.taskType);

  if (type === "task") {
    if (taskType === "pd" || taskType === "pregnancy") return "pregnancy";
    if (taskType === "breedingfollowup" || taskType === "breeding followup") {
      return "breeding_follow_up";
    }
    if (taskType === "cd" || taskType === "calving") return "calving";
    return "task";
  }
  if (type === "insemination" || type === "ai") return "ai";
  if (type === "health") return "health";
  return null;
};

export const getScheduleDateValue = (item = {}) => {
  const raw = item.raw || {};
  const kind = getScheduleEntityKind(item);
  if (kind === "ai" || kind === "health") {
    return item.scheduledDate || raw.scheduledDate || item.schedule?.date || null;
  }
  if (["pregnancy", "breeding_follow_up", "calving", "task"].includes(kind)) {
    return item.dueDate || raw.dueDate || item.schedule?.date || null;
  }
  return null;
};

const isLegacyFarmVisit = (item) => {
  const status = normalizeValue(item.status || item.raw?.status);
  const method = normalizeValue(
    item.handlingMethod || item.raw?.handlingMethod,
  ).replaceAll(" ", "_");
  if (method === "advice" || method === "office_pickup") return false;
  if (method === "farm_visit") return true;
  return !method && ACTIVE_VISIT_STATUSES.has(status);
};

export const isCanonicalScheduleItem = (item = {}) => {
  const kind = getScheduleEntityKind(item);
  const status = normalizeValue(item.status || item.raw?.status);
  if (!kind || TERMINAL_STATUSES.has(status) || !getScheduleDateValue(item)) {
    return false;
  }

  if (kind === "ai") {
    return status !== "pending" && ACTIVE_VISIT_STATUSES.has(status);
  }
  if (kind === "health") return isLegacyFarmVisit(item);
  return ACTIVE_TASK_STATUSES.has(status);
};

const linkedRequestIds = (item = {}) => {
  const raw = item.raw || {};
  const metadata = raw.metadata || item.metadata || {};
  return [
    item.requestId,
    item.sourceId,
    raw.requestId,
    raw.sourceId,
    raw.relatedRecordId,
    metadata.requestId,
    metadata.inseminationId,
    metadata.healthRequestId,
  ]
    .map(idOf)
    .filter(Boolean);
};

const removeDuplicateExecutionTasks = (items) => {
  const requestIds = new Set(
    items
      .filter((item) => ["ai", "health"].includes(getScheduleEntityKind(item)))
      .map((item) => idOf(item.workflowId || item.id || item._id))
      .filter(Boolean),
  );

  return items.filter((item) => {
    if (getScheduleEntityKind(item) !== "task") return true;
    const taskType = normalizeValue(item.taskType || item.raw?.taskType);
    if (!REQUEST_TASK_TYPES.has(taskType)) return true;
    return !linkedRequestIds(item).some((id) => requestIds.has(id));
  });
};

export const getScheduleTimingState = (item, now = new Date()) => {
  const dateKey = getPhilippineDateKey(getScheduleDateValue(item));
  const todayKey = getPhilippineTodayKey(now);
  if (!dateKey || !todayKey) return "unknown";
  if (dateKey < todayKey) return "overdue";
  if (dateKey === todayKey) return "due";
  return "upcoming";
};

export const getScheduleWorkLabel = (item = {}) => {
  switch (getScheduleEntityKind(item)) {
    case "ai":
      return "Scheduled AI Visit";
    case "health":
      return "Scheduled Health Farm Visit";
    case "pregnancy":
      return "Pregnancy Check Due";
    case "breeding_follow_up":
      return "Breeding Follow-up Due";
    case "calving":
      return "Calving Due";
    default: {
      const taskType = item.taskType || item.raw?.taskType;
      return taskType
        ? String(taskType).replaceAll("_", " ") + " Due"
        : "Task Due";
    }
  }
};

export const getSchedulePeriodLabel = (item = {}) => {
  if (!["ai", "health"].includes(getScheduleEntityKind(item))) return null;
  const period = normalizeValue(item.visitPeriod || item.raw?.visitPeriod);
  if (period === "morning") return "Morning";
  if (period === "afternoon") return "Afternoon";
  return "Visit period not recorded";
};

export const getScheduleNavigationTarget = (item = {}) => {
  const kind = getScheduleEntityKind(item);
  if (["pregnancy", "breeding_follow_up", "calving", "task"].includes(kind)) {
    const taskId = idOf(item.taskId || item.id || item._id || item.raw?._id);
    return taskId
        ? {
          kind: "task",
          path: "/technician/requests",
          search:
            "?section=myWork&taskId=" + encodeURIComponent(taskId),
          label: "View Task",
        }
      : null;
  }

  if (kind === "ai" || kind === "health") {
    const requestId = idOf(
      item.workflowId || item.requestId || item.id || item._id || item.raw?._id,
    );
    return requestId
      ? {
          kind: "request",
          path: "/technician/requests",
          search:
            "?section=myWork&requestId=" + encodeURIComponent(requestId),
          label: "View Work",
        }
      : null;
  }
  return null;
};

export const formatScheduleDate = (value, options = {}) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not recorded";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: PHILIPPINE_TIME_ZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
    ...options,
  }).format(date);
};

export const buildScheduleItems = (items = [], now = new Date()) =>
  removeDuplicateExecutionTasks(items)
    .filter(isCanonicalScheduleItem)
    .map((item) => {
      const date = getScheduleDateValue(item);
      return {
        ...item,
        scheduleKind: getScheduleEntityKind(item),
        scheduleDate: date,
        scheduleDateKey: getPhilippineDateKey(date),
        scheduleLabel: getScheduleWorkLabel(item),
        periodLabel: getSchedulePeriodLabel(item),
        timingState: getScheduleTimingState(item, now),
        navigationTarget: getScheduleNavigationTarget(item),
      };
    })
    .sort(
      (a, b) =>
        new Date(a.scheduleDate).getTime() - new Date(b.scheduleDate).getTime(),
    );
