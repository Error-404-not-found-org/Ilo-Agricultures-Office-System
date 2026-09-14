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
  const rawValue =
    item.type === "task"
      ? item.displayDate || item.dueDate || item.raw?.dueDate
      : item.scheduledDate || item.raw?.scheduledDate;
  const dateKey = philippineDateKey(rawValue);
  if (!dateKey) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getCalendarVisitPeriodLabel = (item: AgendaItem) => {
  const period = String(item.visitPeriod || item.raw?.visitPeriod || "")
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

export const getCalendarWorkCounts = (items: AgendaItem[] = []) => {
  const scheduledVisits = items.filter(
    (item) => getCalendarWorkKind(item) === "visit",
  ).length;
  const dueWork = items.filter(
    (item) => getCalendarWorkKind(item) === "task",
  ).length;
  return {
    totalWorkItems: scheduledVisits + dueWork,
    scheduledVisits,
    dueWork,
  };
};

export const getCalendarActionLabel = (item: AgendaItem) =>
  getCalendarWorkKind(item) === "task" ? "View task" : "View visit";

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

