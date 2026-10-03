import {
  formatAnimalReference,
  getFullAnimalReference,
} from "../../farmer-dashboard/utils/farmerDashboard.transforms.ts";
import { philippineDateKey } from "../../technician-requests/utils/visitScheduleAvailability.ts";

export type AgendaItem = Record<string, any> & {
  id: unknown;
  type: string;
  raw?: Record<string, any>;
};

const idOf = (value: any): string | null => {
  const resolved = value?._id ?? value;
  return resolved == null ? null : String(resolved);
};

export const getCalendarVisitDate = (item: AgendaItem) => {
  const rawValue = getCalendarSemanticDate(item);
  const dateKey = philippineDateKey(rawValue);
  if (!dateKey) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getCalendarVisitPeriodLabel = (item: AgendaItem) => {
  const period = String(item.visitPeriod || item.raw?.visitPeriod || item.metadata?.visitPeriod || item.raw?.metadata?.visitPeriod || "")
    .trim()
    .toLowerCase();
  if (period === "morning") return "Morning";
  if (period === "afternoon") return "Afternoon";
  return item.type === "task" ? item.time || "Time not set" : "Visit period not set";
};

export const isCalendarCancellationRequested = (item: AgendaItem) =>
  item.displayStatus === "Cancellation requested" ||
  item.cancellationStatus === "requested" ||
  item.raw?.cancellationStatus === "requested";

const normalizedValue = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

export const getCalendarWorkKind = (
  item: AgendaItem,
): "visit" | "task" | null => {
  if (item.type === "task") return "task";
  if (item.type === "insemination" || item.type === "ai") return "visit";
  if (item.type !== "health") return null;

  const handlingMethod = normalizedValue(
    item.handlingMethod || item.raw?.handlingMethod,
  );
  if (handlingMethod === "advice" || handlingMethod === "office_pickup") {
    return null;
  }
  if (handlingMethod === "farm_visit") return "visit";

  const status = normalizedValue(item.status || item.raw?.status);
  return !handlingMethod &&
    ["approved", "assigned", "in_progress", "scheduled"].includes(status)
    ? "visit"
    : null;
};

const getCalendarDateKind = (item: AgendaItem) => {
  if (item.dateKind) return item.dateKind;
  const raw = item.raw || {};
  const metadata = item.metadata || raw.metadata || {};
  const taskType = normalizedValue(item.taskType || raw.taskType);
  const sourceType = item.sourceType || raw.sourceType;
  if (item.type === "insemination" || item.type === "ai" || item.type === "health") return "scheduled_visit";
  if (sourceType === "farmer_pregnancy_loss_report" ||
      (sourceType === "farmer_requested_verification" && metadata.reportType === "return_to_heat")) return "farmer_report";
  if (metadata.visitPeriod) return "scheduled_visit";
  if (taskType === "pd" || taskType === "pregnancy") return "readiness";
  if (taskType === "cd" || taskType === "calving") return "expected_event";
  return "deadline";
};

const getCalendarSemanticDate = (item: AgendaItem) => {
  switch (getCalendarDateKind(item)) {
    case "scheduled_visit": return item.scheduledAt || null;
    case "readiness": return item.readyFrom || null;
    case "expected_event": return item.expectedAt || null;
    case "farmer_report": return item.reportedAt || null;
    case "deadline": return item.dueAt || null;
    default: return null;
  }
};

export const getCalendarWorkCounts = (items: AgendaItem[] = []) => {
  const scheduledVisits = items.filter(
    (item) => getCalendarWorkKind(item) === "visit",
  ).length;
  const datedWork = items.filter(
    (item) => getCalendarWorkKind(item) === "task",
  ).length;
  return {
    totalWorkItems: scheduledVisits + datedWork,
    scheduledVisits,
    datedWork,
  };
};

const formatSemanticDate = (value: unknown) => {
  const key = philippineDateKey(value);
  if (!key) return "Date not recorded";
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(year, month - 1, day, 12));
};

export const getCalendarPresentation = (item: AgendaItem, now = new Date()) => {
  const raw = item.raw || {};
  const metadata = item.metadata || raw.metadata || {};
  const taskType = normalizedValue(item.taskType || raw.taskType);
  const sourceType = item.sourceType || raw.sourceType;
  const isAi = item.type === "insemination" || item.type === "ai";
  const isHealth = item.type === "health";
  const isReport = sourceType === "farmer_pregnancy_loss_report" || (sourceType === "farmer_requested_verification" && metadata.reportType === "return_to_heat");
  const dateKind = getCalendarDateKind(item);
  const value = getCalendarSemanticDate(item);
  const key = philippineDateKey(value);
  const today = philippineDateKey(now);
  const relation = !key || !today ? "unknown" : key < today ? "past" : key === today ? "today" : "future";
  const dateText = formatSemanticDate(value);
  const title = sourceType === "farmer_pregnancy_loss_report" ? "Pregnancy Loss Review" : isAi ? "Scheduled AI Visit" : isHealth ? "Scheduled Health Visit" : taskType === "pd" || taskType === "pregnancy" ? "Pregnancy Check" : taskType === "cd" || taskType === "calving" ? "Expected Calving" : taskType === "breedingfollowup" ? "Breeding Follow-up" : dateKind === "scheduled_visit" ? "Scheduled Visit" : item.taskType || item.serviceType || "Task";
  if (!value) return { title, statusLabel: "Timing unavailable", timingLabel: null, dateLabel: "Timing", dateKind, sectionKind: "timing" };
  if (dateKind === "scheduled_visit") { const period = getCalendarVisitPeriodLabel(item); return { title, statusLabel: relation === "past" ? "Needs attention" : "Scheduled", timingLabel: `Scheduled ${dateText}${period && !period.includes("not set") && !period.includes("not recorded") ? ` · ${period}` : ""}`, dateLabel: "Scheduled visit", dateKind, sectionKind: "scheduled_visit" }; }
  if (dateKind === "readiness") return relation === "future" ? { title, statusLabel: "Upcoming", timingLabel: `Check from ${dateText}`, dateLabel: "Ready from", dateKind, sectionKind: "ready_follow_up" } : { title, statusLabel: "Ready for check", timingLabel: relation === "past" ? `Since ${dateText}` : null, dateLabel: "Ready from", dateKind, sectionKind: "ready_follow_up" };
  if (dateKind === "expected_event") return { title, statusLabel: relation === "past" ? "Past expected date" : relation === "today" ? "Expected today" : "Expected", timingLabel: relation === "past" ? `Past expected date · ${dateText}` : relation === "today" ? "Expected today" : `Expected ${dateText}`, dateLabel: "Expected calving date", dateKind, sectionKind: "expected_event" };
  if (dateKind === "farmer_report") return { title, statusLabel: "Needs review", timingLabel: relation === "today" ? "Reported today" : `Reported ${dateText}`, dateLabel: "Reported", dateKind, sectionKind: "needs_review" };
  const statusLabel = relation === "past" ? "Overdue" : relation === "today" ? "Due today" : "Due";
  return { title, statusLabel, timingLabel: relation === "future" ? `Due ${dateText}` : statusLabel, dateLabel: "Due date", dateKind: "deadline", sectionKind: "deadline" };
};

export const getCalendarActionLabel = (item: AgendaItem) =>
  getCalendarWorkKind(item) === "task" ? "View task" : "View visit";

export const getCalendarAccessibleActionLabel = (
  item: AgendaItem,
  now = new Date(),
) => {
  const presentation = getCalendarPresentation(item, now);
  return `View ${presentation.title}, ${presentation.statusLabel.toLowerCase()}`;
};

export const isCalendarAttentionItem = (item: AgendaItem, now = new Date()) => {
  const presentation = getCalendarPresentation(item, now);
  return presentation.sectionKind === "needs_review" ||
    (presentation.dateKind === "deadline" && presentation.statusLabel === "Overdue") ||
    (presentation.dateKind === "scheduled_visit" && presentation.statusLabel === "Needs attention");
};

const requestIdsForTask = (item: AgendaItem) => {
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
    .filter((value): value is string => Boolean(value));
};

export const deduplicateCalendarWorkItems = (items: AgendaItem[] = []) => {
  const requestById = new Map<string, AgendaItem>();
  items.forEach((item) => {
    if (item.type !== "task") requestById.set(String(item.id), item);
  });

  const requestIdsWithTasks = new Set<string>();
  const canonicalItems = items.map((item) => {
    if (item.type !== "task") return item;
    const linkedRequestId = requestIdsForTask(item).find((id) =>
      requestById.has(id),
    );
    if (!linkedRequestId) return item;
    requestIdsWithTasks.add(linkedRequestId);
    const linkedRequest = requestById.get(linkedRequestId)!;
    return {
      ...linkedRequest,
      ...item,
      type: "task",
      linkedRequest,
      linkedRequestId,
      serviceType: linkedRequest.serviceType || item.serviceType,
      farmerName: item.farmerName || linkedRequest.farmerName,
      animalTag: item.animalTag || linkedRequest.animalTag,
      farmLocationLabel:
        item.farmLocationLabel || linkedRequest.farmLocationLabel,
      requestStatus: linkedRequest.displayStatus || linkedRequest.status,
    };
  });

  return canonicalItems.filter(
    (item) => item.type === "task" || !requestIdsWithTasks.has(String(item.id)),
  );
};

// Kept as a compatibility alias for existing callers outside Schedule.
export const deduplicateCalendarVisits = deduplicateCalendarWorkItems;

export const getCalendarVisitTarget = (item: AgendaItem) => {
  if (item.type === "task") {
    return {
      pathname: "/(technician)/task-details" as const,
      params: { id: String(item.id) },
    };
  }
  const requestType =
    item.type === "health" ? "health" : "ai";
  return {
    pathname: "/(technician)/request-details" as const,
    params: { id: String(item.id), type: requestType },
  };
};

export const getCalendarAnimalIdentity = (item: AgendaItem) => {
  const animal =
    item.raw?.animalId || item.raw?.animalIds?.[0] || item.animalId || {
      earTag: item.animalTag,
      animalId: item.animalTag,
    };
  return {
    compact: formatAnimalReference(animal),
    full: getFullAnimalReference(animal),
  };
};

