import {
  formatAnimalReference,
  getFullAnimalReference,
} from "../../farmer-dashboard/utils/farmerDashboard.transforms";
import { philippineDateKey } from "../../technician-requests/utils/visitScheduleAvailability";

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

export const deduplicateCalendarVisits = (items: AgendaItem[] = []) => {
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

