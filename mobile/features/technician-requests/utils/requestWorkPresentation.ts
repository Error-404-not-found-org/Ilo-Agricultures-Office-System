import type {
  TechnicianWorkItem,
  TechnicianWorkState,
  TechnicianWorkType,
  VisitPeriod,
  WorkQueueItem,
} from "../types/technicianRequests.types";

export type RequestWorkService =
  | "ai"
  | "health"
  | "pregnancy"
  | "calving"
  | "breeding_follow_up"
  | "unknown";

export type RequestWorkStatus =
  | "open"
  | "scheduled"
  | "due_today"
  | "overdue"
  | "completed"
  | "cancelled";

import type { BadgeTone } from "@/components/ui/AppBadge";

export type RequestWorkTone = BadgeTone;

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
      itemOrValue.workType,
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
    ].includes(value)
  ) {
    return "pregnancy";
  }
  if (["cd", "calving", "calving_assistance"].includes(value)) {
    return "calving";
  }
  if (
    ["breedingfollowup", "breeding_follow_up", "breeding_followup"].includes(
      value,
    )
  ) {
    return "breeding_follow_up";
  }
  return "unknown";
}

export function getServicePresentation(service: RequestWorkService) {
  const presentations: Record<
    RequestWorkService,
    { label: string; tone: RequestWorkTone }
  > = {
    ai: { label: "Insemination", tone: "emerald" },
    health: { label: "Health", tone: "rose" },
    pregnancy: { label: "Pregnancy", tone: "violet" },
    calving: { label: "Calving", tone: "orange" },
    breeding_follow_up: { label: "Breeding Follow-up", tone: "blue" },
    unknown: { label: "Other service", tone: "neutral" },
  };
  return presentations[service];
}

export const philippineDateKey = (value: unknown) => {
  if (!value) return null;
  if (typeof value === "string") {
    const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})$/)?.[1];
    if (dateOnly) return dateOnly;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export function deriveScheduleState(
  scheduleDate: unknown,
  now: Date = new Date(),
): "scheduled" | "due_today" | "overdue" | null {
  const scheduleKey = philippineDateKey(scheduleDate);
  const todayKey = philippineDateKey(now);
  if (!scheduleKey || !todayKey) return null;
  if (scheduleKey < todayKey) return "overdue";
  if (scheduleKey === todayKey) return "due_today";
  return "scheduled";
}

const normalizedStatus = (value: unknown) => normalizedValue(value);

const terminalStatuses = new Set(["completed", "complete", "done", "resolved"]);
const cancelledStatuses = new Set([
  "cancelled",
  "canceled",
  "rejected",
  "declined",
]);

const visitPeriod = (value: unknown): VisitPeriod | null => {
  const normalized = normalizedValue(value);
  return normalized === "morning" || normalized === "afternoon"
    ? normalized
    : null;
};

const text = (value: unknown): string | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  return normalized &&
    !["n/a", "unknown", "null", "undefined"].includes(normalized.toLowerCase())
    ? normalized
    : null;
};

const formatWorkDate = (value: unknown): string | null => {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(date);
};

const workTypeOf = (item: WorkQueueItem): TechnicianWorkType => {
  const service = normalizeServiceType(item);
  if (service === "ai") return "ai";
  if (service === "health") return "health";
  if (service === "pregnancy") return "pregnancy_check";
  if (service === "calving") return "calving";
  if (service === "breeding_follow_up") return "breeding_follow_up";
  return "task";
};

const titleFor = (workType: TechnicianWorkType, attemptNumber: number | null) =>
  ({
    ai:
      attemptNumber && attemptNumber > 1
        ? "Re-insemination"
        : "Artificial Insemination",
    health: "Health Assistance",
    pregnancy_check: "Pregnancy Check",
    calving: "Expected Calving",
    breeding_follow_up: "Breeding Follow-up",
    task: "Field Task",
  })[workType];

const statusLabelFor = (state: TechnicianWorkState) =>
  ({
    needs_scheduling: "Needs scheduling",
    scheduled: "Scheduled",
    needs_confirmation: "Needs confirmation",
    monitoring: "Monitoring",
    in_progress: "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
  })[state];

export function normalizeTechnicianWorkItem(
  item: WorkQueueItem,
  now: Date = new Date(),
): TechnicianWorkItem {
  const workType = workTypeOf(item);
  const status = normalizedStatus(item.status || item.displayStatus);
  const period = visitPeriod(
    item.schedule?.visitPeriod ?? item.visitPeriod ?? item.raw?.visitPeriod,
  );
  const queueDate = text(item.schedule?.date || item.scheduledDate);
  const rawDueDate = text(item.dueDate || item.raw?.dueDate || queueDate);
  const hasExplicitTaskVisit = Boolean(queueDate && period);
  const scheduledDate =
    workType === "ai" || workType === "health" || hasExplicitTaskVisit
      ? queueDate
      : null;
  const dueDate =
    workType === "pregnancy_check" ||
    workType === "task" ||
    workType === "breeding_follow_up"
      ? rawDueDate
      : null;
  const expectedDate = workType === "calving" ? rawDueDate : null;
  const completedAt = text(item.completedAt);
  const serviceStartedAt = text(
    item.serviceStartedAt || item.raw?.serviceStartedAt,
  );
  const rawAttemptNumber = Number(
    item.attemptNumber ?? item.raw?.attemptNumber,
  );
  const attemptNumber =
    Number.isInteger(rawAttemptNumber) && rawAttemptNumber > 0
      ? rawAttemptNumber
      : null;
  const previousAttemptId = text(
    item.previousAttemptId ||
      item.raw?.previousAttemptId?._id ||
      item.raw?.previousAttemptId,
  );
  const previousAttemptOutcome = text(
    item.previousAttemptOutcome || item.raw?.previousAttemptId?.outcome,
  );
  const previousAttemptVerified = item.previousAttemptVerified === true;
  const farmerReportType = normalizedValue(
    item.raw?.metadata?.reportType || item.raw?.farmerOutcomeReport,
  );
  const isFarmerReturnToHeatReview =
    workType === "pregnancy_check" && farmerReportType === "return_to_heat";

  let state: TechnicianWorkState;
  if (cancelledStatuses.has(status)) state = "cancelled";
  else if (completedAt || terminalStatuses.has(status)) state = "completed";
  else if (["in_progress", "inprogress"].includes(status) || serviceStartedAt) {
    state = "in_progress";
  } else if (workType === "ai" || workType === "health") {
    state = scheduledDate ? "scheduled" : "needs_scheduling";
  } else if (workType === "pregnancy_check") {
    state = hasExplicitTaskVisit ? "scheduled" : "needs_confirmation";
  } else if (workType === "calving") {
    state = hasExplicitTaskVisit ? "scheduled" : "monitoring";
  } else {
    state = scheduledDate ? "scheduled" : "monitoring";
  }

  const timingKind = scheduledDate
    ? "scheduled_visit"
    : workType === "pregnancy_check"
      ? "confirmation_due"
      : workType === "calving"
        ? "expected_event"
        : workType === "task" && dueDate
          ? "task_due"
          : "unscheduled";
  const timingDate = scheduledDate || dueDate || expectedDate;
  const timingKey = philippineDateKey(timingDate);
  const todayKey = philippineDateKey(now);
  const unfinished = !["completed", "cancelled"].includes(state);
  const isReadyToday = Boolean(
    unfinished && timingKey && timingKey === todayKey,
  );
  const needsAttention = Boolean(
    unfinished && timingKey && todayKey && timingKey < todayKey,
  );
  const overdue = needsAttention && timingKind !== "expected_event";
  const dateLabel = formatWorkDate(timingDate);
  const timingLabel = !dateLabel
    ? null
    : timingKind === "scheduled_visit"
      ? `${dateLabel}${period ? ` · ${period === "morning" ? "Morning" : "Afternoon"}` : ""}`
      : timingKind === "confirmation_due"
        ? `Pregnancy confirmation due · ${dateLabel}`
        : timingKind === "expected_event"
          ? `${needsAttention ? "Past expected date" : "Expected"} · ${dateLabel}`
          : `Due · ${dateLabel}`;

  const readiness = item.pregnancyReadiness || item.raw?.pregnancyReadiness;
  const actionLabel =
    state === "completed"
      ? "View Record"
      : state === "in_progress"
        ? "Continue Service"
        : state === "needs_scheduling"
          ? "Set Visit"
          : workType === "health" && state === "scheduled"
            ? "Record Health Assistance"
            : workType === "pregnancy_check"
              ? readiness?.isEligible === false
                ? "Review"
                : "Record Pregnancy Check"
              : workType === "breeding_follow_up"
                ? farmerReportType
                  ? "Review Update"
                  : "Contact Farmer"
                : workType === "calving"
                  ? ["START_SERVICE", "RECORD_SERVICE"].includes(
                      String(item.allowedAction),
                    )
                    ? "Record Calving"
                    : "View Animal"
                  : item.actionLabel || "View Details";

  const farmer = typeof item.farmer === "object" ? item.farmer : null;
  const animal = typeof item.animal === "object" ? item.animal : null;

  return {
    id: String(item.id || item._id || ""),
    workflowId: text(item.workflowId),
    taskId: text(item.taskId),
    workType,
    timingKind,
    state,
    status,
    title: titleFor(workType, attemptNumber),
    statusLabel:
      workType === "breeding_follow_up" &&
      !["completed", "cancelled"].includes(state)
        ? farmerReportType === "return_to_heat"
          ? "Needs attention"
          : farmerReportType
            ? "Update received"
            : dueDate
              ? (() => {
                  const due = new Date(dueDate);
                  const today = new Date();
                  // Compare dates only (ignore time)
                  const dueDateOnly = new Date(
                    due.getFullYear(),
                    due.getMonth(),
                    due.getDate(),
                  );
                  const todayOnly = new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate(),
                  );

                  if (dueDateOnly < todayOnly) {
                    return "Overdue"; // Past due date
                  } else if (dueDateOnly.getTime() === todayOnly.getTime()) {
                    return "Follow-up due"; // TODAY is the due date
                  } else {
                    return `Due ${formatWorkDate(dueDate)}`; // Future due date
                  }
                })()
              : "Follow-up due"
        : statusLabelFor(state),
    actionLabel,
    scheduledDate,
    visitPeriod: period,
    dueDate,
    expectedDate,
    completedAt,
    serviceStartedAt,
    farmerName: text(farmer?.name || item.farmerName),
    farmerImageUrl: item.farmer?.imageUrl || item.farmerImageUrl || null,
    animalName: text(animal?.name),
    animalTag: text(animal?.earTag || item.animalTag),
    location: text(farmer?.location || item.location || item.farmLocationLabel),
    timingLabel,
    isReadyToday,
    needsAttention,
    overdue,
    allowedAction: item.allowedAction,
    readinessMessage: text(readiness?.reason),
    requestKind:
      workType === "ai"
        ? attemptNumber && attemptNumber > 1
          ? "re_insemination"
          : "initial_ai"
        : workType === "health"
          ? "health"
          : workType === "pregnancy_check"
            ? "pregnancy_confirmation"
            : workType === "breeding_follow_up"
              ? "breeding_observation_review"
              : workType === "calving"
                ? "calving_monitoring"
                : "task",
    attemptNumber,
    previousAttemptId,
    previousAttemptOutcome,
    previousAttemptVerified,
  };
}

export const normalizeTechnicianWorkItems = (
  items: WorkQueueItem[] = [],
  now: Date = new Date(),
) => items.map((item) => normalizeTechnicianWorkItem(item, now));

export function summarizeTechnicianWork(
  items: TechnicianWorkItem[],
  now: Date = new Date(),
) {
  const todayKey = philippineDateKey(now);
  return items.reduce(
    (summary, item) => {
      if (item.state === "cancelled") return summary;
      if (item.state === "completed") {
        if (philippineDateKey(item.completedAt) === todayKey)
          summary.completedToday += 1;
        return summary;
      }
      if (item.isReadyToday) summary.dueToday += 1;
      if (item.needsAttention) summary.needsAttention += 1;
      return summary;
    },
    { dueToday: 0, needsAttention: 0, completedToday: 0 },
  );
}

export function getTechnicianWorkStatePresentation(state: TechnicianWorkState) {
  const tone: Record<TechnicianWorkState, RequestWorkTone> = {
    needs_scheduling: "amber",
    scheduled: "blue",
    needs_confirmation: "violet",
    monitoring: "orange",
    in_progress: "blue",
    completed: "green",
    cancelled: "slate",
  };
  return { label: statusLabelFor(state), tone: tone[state] };
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
