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

export const getManilaHour = (now = new Date()) => {
  const hour = new Intl.DateTimeFormat("en-PH", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: PHILIPPINE_TIME_ZONE,
  })
    .formatToParts(now)
    .find((part) => part.type === "hour")?.value;
  return Number(hour || 0);
};

export const isFutureSchedule = (
  scheduledDate,
  visitPeriod,
  now = new Date(),
) => {
  const scheduleKey = getPhilippineDateKey(scheduledDate);
  const todayKey = getPhilippineTodayKey(now);
  if (!scheduleKey || !todayKey) return false;
  if (scheduleKey > todayKey) return true;
  if (scheduleKey < todayKey) return false;

  const normalizedPeriod = String(visitPeriod || "")
    .toLowerCase()
    .trim();
  if (normalizedPeriod === "afternoon" && getManilaHour(now) < 12) {
    return true;
  }
  return false;
};

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
  const dateKind = getScheduleDateKind(item);
  if (dateKind === "scheduled_visit") return item.scheduledAt || null;
  if (dateKind === "readiness") return item.readyFrom || null;
  if (dateKind === "expected_event") return item.expectedAt || null;
  if (dateKind === "farmer_report") return item.reportedAt || null;
  if (dateKind === "deadline") return item.dueAt || null;
  return null;
};

export const getScheduleDateKind = (item = {}) => {
  if (item.dateKind) return item.dateKind;
  const kind = getScheduleEntityKind(item);
  const sourceType = item.sourceType || item.raw?.sourceType;
  const metadata = item.metadata || item.raw?.metadata || {};
  if (kind === "ai" || kind === "health") return "scheduled_visit";
  if (sourceType === "farmer_pregnancy_loss_report" ||
      (sourceType === "farmer_requested_verification" && metadata.reportType === "return_to_heat")) {
    return "farmer_report";
  }
  if (metadata.visitPeriod) return "scheduled_visit";
  if (kind === "pregnancy") return "readiness";
  if (kind === "calving") return "expected_event";
  if (kind === "breeding_follow_up" && sourceType === "automatic_breeding_followup") return "deadline";
  if (kind === "task" && (metadata.visitPeriod || ["client_profile", "task_scheduler"].includes(sourceType))) return "scheduled_visit";
  return "deadline";
};

const semanticDateValue = (item = {}) => getScheduleDateValue(item);

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
  if (!kind || TERMINAL_STATUSES.has(status)) {
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
  const status = normalizeValue(item?.status || item?.raw?.status);
  const isInProgress =
    (status === "in progress" ||
      status === "in-progress" ||
      Boolean(item?.serviceStartedAt || item?.raw?.serviceStartedAt)) &&
    !TERMINAL_STATUSES.has(status);

  if (isInProgress) {
    return "due";
  }

  const dateKey = getPhilippineDateKey(getScheduleDateValue(item));
  const todayKey = getPhilippineTodayKey(now);
  if (!dateKey || !todayKey) return "unknown";
  if (dateKey < todayKey) return "overdue";
  if (dateKey === todayKey) return "due";
  return "upcoming";
};

export const getScheduleWorkLabel = (item = {}) => {
  if (
    getScheduleEntityKind(item) === "breeding_follow_up" &&
    (item.sourceType === "farmer_pregnancy_loss_report" ||
      item.raw?.sourceType === "farmer_pregnancy_loss_report")
  ) {
    return "Pregnancy Loss Review";
  }
  const status = normalizeValue(item?.status || item?.raw?.status);
  const isInProgress =
    (status === "in progress" ||
      status === "in-progress" ||
      Boolean(item?.serviceStartedAt || item?.raw?.serviceStartedAt)) &&
    !TERMINAL_STATUSES.has(status);

  switch (getScheduleEntityKind(item)) {
    case "ai":
      return isInProgress ? "Artificial Insemination" : "Scheduled AI Visit";
    case "health":
      return "Scheduled Health Visit";
    case "pregnancy":
      return "Pregnancy Check";
    case "breeding_follow_up":
      return "Breeding Follow-up";
    case "calving":
      return "Expected Calving";
    default: {
      if (getScheduleDateKind(item) === "scheduled_visit") return "Scheduled Visit";
      const taskType = item.taskType || item.raw?.taskType;
      return taskType
        ? String(taskType).replaceAll("_", " ")
        : "Task";
    }
  }
};

const shortDate = (value) => formatScheduleDate(value, { month: "short" });

export const getScheduleSemanticPresentation = (item = {}, now = new Date()) => {
  const dateKind = getScheduleDateKind(item);
  const date = semanticDateValue(item);
  const dateKey = getPhilippineDateKey(date);
  const todayKey = getPhilippineTodayKey(now);
  const relation = !dateKey || !todayKey ? "unknown" : dateKey < todayKey ? "past" : dateKey === todayKey ? "today" : "future";
  const periodLabel = getSchedulePeriodLabel(item);
  const dateText = date ? shortDate(date) : "Date not recorded";

  if (!date) {
    return { dateKind, statusLabel: "Timing unavailable", timingLabel: null, dateLabel: "Timing", sectionKind: "timing" };
  }

  if (dateKind === "scheduled_visit") {
    return { dateKind, statusLabel: relation === "past" ? "Needs attention" : "Scheduled", timingLabel: `Scheduled ${dateText}${periodLabel ? ` · ${periodLabel}` : ""}`, dateLabel: "Scheduled visit", sectionKind: "scheduled_visit" };
  }
  if (dateKind === "readiness") {
    return relation === "future"
      ? { dateKind, statusLabel: "Upcoming", timingLabel: `Check from ${dateText}`, dateLabel: "Ready from", sectionKind: "ready_follow_up" }
      : { dateKind, statusLabel: "Ready for check", timingLabel: relation === "past" ? `Since ${dateText}` : null, dateLabel: "Ready from", sectionKind: "ready_follow_up" };
  }
  if (dateKind === "expected_event") {
    const timingLabel = relation === "today" ? "Expected today" : relation === "past" ? `Past expected date · ${dateText}` : `Expected ${dateText}`;
    return { dateKind, statusLabel: relation === "past" ? "Past expected date" : relation === "today" ? "Expected today" : "Expected", timingLabel, dateLabel: "Expected calving date", sectionKind: "expected_event" };
  }
  if (dateKind === "farmer_report") {
    return { dateKind, statusLabel: "Needs review", timingLabel: relation === "today" ? "Reported today" : `Reported ${dateText}`, dateLabel: "Reported", sectionKind: "needs_review" };
  }
  const statusLabel = relation === "past" ? "Overdue" : relation === "today" ? "Due today" : "Due";
  return { dateKind: "deadline", statusLabel, timingLabel: relation === "future" ? `Due ${dateText}` : statusLabel, dateLabel: "Due date", sectionKind: "deadline" };
};

export const getSchedulePeriodLabel = (item = {}) => {
  if (getScheduleDateKind(item) !== "scheduled_visit") return null;
  const period = normalizeValue(
    item.visitPeriod || item.raw?.visitPeriod || item.metadata?.visitPeriod || item.raw?.metadata?.visitPeriod,
  );
  if (period === "morning") return "Morning";
  if (period === "afternoon") return "Afternoon";
  return "Visit period not recorded";
};

export const getScheduleNavigationTarget = (item = {}, timingState) => {
  const kind = getScheduleEntityKind(item);
  const resolvedTiming = timingState || item.timingState;
  const isUpcoming = resolvedTiming === "upcoming";

  if (["pregnancy", "breeding_follow_up", "calving", "task"].includes(kind)) {
    const taskId = idOf(item.taskId || item.id || item._id || item.raw?._id);
    if (!taskId) return null;
    return isUpcoming
      ? {
          kind: "task",
          action: "preview",
          isUpcoming: true,
          label: "View Task",
          path: "/technician/schedule",
          search: "?previewTaskId=" + encodeURIComponent(taskId),
        }
      : {
          kind: "task",
          action: "execute",
          isUpcoming: false,
          path: "/technician/requests",
          search:
            "?section=myWork&taskId=" + encodeURIComponent(taskId),
          label: "View Task",
        };
  }

  if (kind === "ai" || kind === "health") {
    const requestId = idOf(
      item.workflowId || item.requestId || item.id || item._id || item.raw?._id,
    );
    if (!requestId) return null;
    return isUpcoming
      ? {
          kind: "request",
          action: "preview",
          isUpcoming: true,
          label: "View Work",
          path: "/technician/schedule",
          search: "?previewRequestId=" + encodeURIComponent(requestId),
        }
      : {
          kind: "request",
          action: "execute",
          isUpcoming: false,
          path: "/technician/requests",
          search:
            "?section=myWork&requestId=" + encodeURIComponent(requestId),
          label: "View Work",
        };
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

export const formatPlannedSchedule = (item = {}) => {
  const raw = item.raw || {};
  const dateValue =
    item.scheduledDate ||
    raw.scheduledDate ||
    item.schedule?.date ||
    getScheduleDateValue(item);
  if (!dateValue) return null;
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  const dateStr = formatScheduleDate(date, { month: "short" });
  const rawPeriod = normalizeValue(
    item.visitPeriod || item.raw?.visitPeriod || item.schedule?.visitPeriod,
  );
  const periodLabel =
    rawPeriod === "morning"
      ? "Morning"
      : rawPeriod === "afternoon"
        ? "Afternoon"
        : null;

  return periodLabel ? `${dateStr} · ${periodLabel}` : dateStr;
};

const cleanAddressPart = (value) => {
  const str = String(value || "").trim();
  if (
    !str ||
    ["n/a", "na", "none", "null", "undefined", "unknown location"].includes(
      str.toLowerCase(),
    )
  ) {
    return "";
  }
  return str;
};

const isPlusCodeOrCoordinates = (value) => {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (/^[A-Z0-9]{2,8}\+[A-Z0-9]{2,}/i.test(trimmed)) return true;
  if (/^-?\d+\.\d+,\s*-?\d+\.\d+/.test(trimmed)) return true;
  if (/^farm pin saved$/i.test(trimmed)) return true;
  return false;
};

export const formatDashboardFarmerLocation = (item = {}) => {
  const safeItem = item || {};
  const raw = safeItem.raw || {};
  const farmer = raw.farmerId || safeItem.farmerId || {};
  const address =
    (typeof farmer.address === "object" && farmer.address) ||
    (typeof raw.address === "object" && raw.address) ||
    (typeof safeItem.address === "object" && safeItem.address) ||
    (Array.isArray(farmer.address) && farmer.address[0]) ||
    (Array.isArray(raw.address) && raw.address[0]) ||
    null;

  if (address) {
    const barangay = cleanAddressPart(address.barangay);
    const municipality = cleanAddressPart(
      address.municipality || address.city,
    );
    if (barangay && municipality) {
      return `${barangay}, ${municipality}`;
    }
    if (barangay) return barangay;
    if (municipality) return municipality;
  }

  const topBarangay = cleanAddressPart(
    safeItem.barangay || raw.barangay || farmer.barangay,
  );
  const topMunicipality = cleanAddressPart(
    safeItem.municipality ||
      safeItem.city ||
      raw.municipality ||
      raw.city ||
      farmer.municipality ||
      farmer.city,
  );
  if (topBarangay && topMunicipality) {
    return `${topBarangay}, ${topMunicipality}`;
  }
  if (topBarangay) return topBarangay;
  if (topMunicipality) return topMunicipality;

  const locationText = cleanAddressPart(
    safeItem.location ||
      safeItem.locationLabel ||
      (typeof farmer.address === "string" ? farmer.address : "") ||
      (typeof raw.address === "string" ? raw.address : "") ||
      (typeof safeItem.address === "string" ? safeItem.address : ""),
  );

  if (locationText && !isPlusCodeOrCoordinates(locationText)) {
    const compactParts = locationText
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .filter(
        (part) =>
          !/^(philippines|western visayas|region vi|iloilo province|province of iloilo|iloilo)$/i.test(
            part,
          ),
      );

    if (compactParts.length >= 2) {
      return compactParts.slice(0, 2).join(", ");
    }
    if (compactParts.length === 1) {
      return compactParts[0];
    }
  }

  return "Location not provided";
};


export const buildScheduleItems = (items = [], now = new Date()) =>
  removeDuplicateExecutionTasks(items)
    .filter(isCanonicalScheduleItem)
    .map((item) => {
      const date = semanticDateValue(item);
      const timingState = getScheduleTimingState(item, now);
      const semantic = getScheduleSemanticPresentation(item, now);
      return {
        ...item,
        ...semantic,
        scheduleKind: getScheduleEntityKind(item),
        scheduleDate: date,
        scheduleDateKey: getPhilippineDateKey(date),
        scheduleLabel: getScheduleWorkLabel(item),
        periodLabel: getSchedulePeriodLabel(item),
        timingState,
        navigationTarget: getScheduleNavigationTarget(item, timingState),
      };
    })
    .sort(
      (a, b) =>
        (a.scheduleDate ? new Date(a.scheduleDate).getTime() : Number.MAX_SAFE_INTEGER) -
        (b.scheduleDate ? new Date(b.scheduleDate).getTime() : Number.MAX_SAFE_INTEGER),
    );
