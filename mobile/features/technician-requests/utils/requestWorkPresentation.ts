export type RequestWorkService =
  | "ai"
  | "health"
  | "pregnancy"
  | "calving"
  | "unknown";

export type RequestWorkStatus =
  | "open"
  | "scheduled"
  | "due_today"
  | "overdue"
  | "completed"
  | "cancelled";

export type RequestWorkTone =
  | "emerald"
  | "rose"
  | "violet"
  | "orange"
  | "neutral"
  | "blue"
  | "amber"
  | "red"
  | "green"
  | "slate";

export interface RequestWorkFilterOption {
  value: "all" | Exclude<RequestWorkService, "unknown">;
  label: string;
}

export const OPEN_REQUEST_FILTERS: RequestWorkFilterOption[] = [
  { value: "all", label: "All" },
  { value: "ai", label: "AI" },
  { value: "health", label: "Health" },
  { value: "pregnancy", label: "Pregnancy" },
];

export const MY_WORK_FILTERS: RequestWorkFilterOption[] = [
  { value: "all", label: "All" },
  { value: "ai", label: "AI" },
  { value: "health", label: "Health" },
  { value: "pregnancy", label: "Pregnancy" },
  { value: "calving", label: "Calving" },
];

const normalizedValue = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

export function normalizeServiceType(
  itemOrValue: Record<string, any> | string | null | undefined,
): RequestWorkService {
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
    ["pd", "pregnancy", "pregnancy_check", "pregnancy_diagnosis", "breeding_verification"].includes(
      value,
    )
  ) {
    return "pregnancy";
  }
  if (["cd", "calving", "calving_assistance"].includes(value)) {
    return "calving";
  }
  return "unknown";
}

export function getServicePresentation(service: RequestWorkService) {
  const presentations: Record<
    RequestWorkService,
    { label: string; tone: RequestWorkTone }
  > = {
    ai: { label: "AI", tone: "emerald" },
    health: { label: "Health", tone: "rose" },
    pregnancy: { label: "Pregnancy", tone: "violet" },
    calving: { label: "Calving", tone: "orange" },
    unknown: { label: "Other service", tone: "neutral" },
  };
  return presentations[service];
}

const localDateKey = (value: unknown) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function deriveScheduleState(
  scheduleDate: unknown,
  now: Date = new Date(),
): "scheduled" | "due_today" | "overdue" | null {
  const scheduleKey = localDateKey(scheduleDate);
  const todayKey = localDateKey(now);
  if (!scheduleKey || !todayKey) return null;
  if (scheduleKey < todayKey) return "overdue";
  if (scheduleKey === todayKey) return "due_today";
  return "scheduled";
}

export function normalizeWorkflowStatus(
  item: Record<string, any> = {},
  now: Date = new Date(),
): RequestWorkStatus {
  const status = normalizedValue(item.status || item.displayStatus);
  if (["completed", "done", "resolved"].includes(status)) return "completed";
  if (["cancelled", "canceled", "rejected", "declined"].includes(status)) {
    return "cancelled";
  }

  const scheduleState = deriveScheduleState(
    item.schedule?.date || item.scheduledDate || item.dueDate,
    now,
  );
  if (scheduleState) return scheduleState;

  if (
    ["scheduled", "approved", "assigned", "in_progress", "ready_today"].includes(
      status,
    )
  ) {
    return "scheduled";
  }
  return "open";
}

export function getWorkflowStatusPresentation(status: RequestWorkStatus) {
  const presentations: Record<
    RequestWorkStatus,
    { label: string; tone: RequestWorkTone }
  > = {
    open: { label: "Open", tone: "amber" },
    scheduled: { label: "Scheduled", tone: "blue" },
    due_today: { label: "Due Today", tone: "amber" },
    overdue: { label: "Overdue", tone: "red" },
    completed: { label: "Completed", tone: "green" },
    cancelled: { label: "Cancelled", tone: "slate" },
  };
  return presentations[status];
}

export function matchesServiceFilter(
  item: Record<string, any>,
  filter: RequestWorkFilterOption["value"],
) {
  return filter === "all" || normalizeServiceType(item) === filter;
}
