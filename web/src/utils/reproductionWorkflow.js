import {
  PREGNANCY_WORKFLOW_STAGE,
  getTaskReadiness,
  getWorkflowStage,
  getWorkflowStageLabel,
} from "../constants/technicianWorkflow";
import { getTaskPrimaryActionLabel } from "./taskNavigation";

const titleCase = (value) =>
  String(value || "")
    .trim()
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");

const TERMINAL_TASK_STATUSES = new Set([
  "completed",
  "done",
  "cancelled",
  "rejected",
  "resolved",
]);

export const getWorkflowSourceLabel = (item = {}) => {
  const raw = item.raw || item;
  const metadata = raw.metadata || item.metadata || {};
  const sourceType = String(
    item.sourceType || raw.sourceType || metadata.sourceType || "",
  ).toLowerCase();
  const stage = getWorkflowStage(raw);

  if (sourceType === "farmer_requested_verification") {
    return "Farmer observation";
  }
  if (sourceType === "automatic_pd_followup") {
    if (stage === PREGNANCY_WORKFLOW_STAGE.CONTINUATION) {
      return "Official diagnosis follow-up";
    }
    if (stage === PREGNANCY_WORKFLOW_STAGE.FOLLOW_UP) {
      return "Diagnostic follow-up";
    }
    return "Scheduled pregnancy follow-up";
  }
  if (sourceType === "manual") return "Technician-created task";
  if (sourceType === "task_scheduler") return "Scheduled task";
  if (sourceType === "client_profile") return "Animal profile";
  if (raw.requestId || metadata.requestId) return "Service request";
  return raw.taskType ? "Assigned task" : "Farmer service request";
};

export const getTaskWorkflowSummary = (task = {}) => {
  const raw = task.raw || task;
  const status = normalizeStatus(raw.status || task.status);
  const stage = getWorkflowStage(raw);
  const readiness = getTaskReadiness(raw);
  const isTerminal = TERMINAL_TASK_STATUSES.has(status);
  const isAvailable = !raw.technicianId;

  let nextActionLabel = getTaskPrimaryActionLabel(raw);
  if (isTerminal) {
    nextActionLabel = "No further action for this task";
  } else if (isAvailable) {
    nextActionLabel = "Claim task";
  } else if (!readiness.ready) {
    nextActionLabel = "Wait until diagnosis is available";
  } else if (raw.taskType === "PD") {
    if (stage === PREGNANCY_WORKFLOW_STAGE.CONTINUATION) {
      nextActionLabel = "Update the existing pregnancy record";
    } else if (stage === PREGNANCY_WORKFLOW_STAGE.FOLLOW_UP) {
      nextActionLabel = "Review and record the diagnostic follow-up";
    } else if (raw.sourceType === "farmer_requested_verification") {
      nextActionLabel = "Review the observation and record an official diagnosis";
    } else {
      nextActionLabel = "Record an official pregnancy diagnosis";
    }
  }

  return {
    stage,
    stageLabel: getWorkflowStageLabel(raw),
    sourceLabel: getWorkflowSourceLabel(raw),
    nextActionLabel,
    readiness,
    isTerminal,
  };
};

export const getRequestWorkflowSummary = (request = {}) => {
  const raw = request.raw || request;
  const status = normalizeStatus(request.status || raw.status);
  const type = String(request.type || request.workflow || raw.type || "").toLowerCase();
  const isTerminal = TERMINAL_TASK_STATUSES.has(status);
  const isAssigned = Boolean(
    raw.technicianId || raw.approvedBy || raw.handledBy || request.assignedTechnician,
  );

  let nextActionLabel = `Complete ${request.serviceLabel || "service"}`;
  if (isTerminal) {
    nextActionLabel = "Service completed";
  } else if (status === "pending" && !isAssigned) {
    nextActionLabel = "Claim or decline request";
  } else if (type === "breeding_verification") {
    nextActionLabel = "Review the observation and record an official diagnosis";
  }

  return {
    sourceLabel:
      type === "breeding_verification"
        ? "Farmer observation"
        : getWorkflowSourceLabel(request),
    nextActionLabel,
    isTerminal,
  };
};

const SERVICE_PROGRESS = {
  pending: { label: "Request pending", badgeClass: "badge-warning" },
  approved: { label: "Assigned", badgeClass: "badge-info" },
  assigned: { label: "Assigned", badgeClass: "badge-info" },
  scheduled: { label: "Scheduled", badgeClass: "badge-info" },
  in_progress: { label: "In progress", badgeClass: "badge-primary" },
  done: { label: "Service completed", badgeClass: "badge-success" },
  completed: { label: "Service completed", badgeClass: "badge-success" },
  resolved: { label: "Service completed", badgeClass: "badge-success" },
  rejected: { label: "Request rejected", badgeClass: "badge-ghost" },
  cancelled: { label: "Request cancelled", badgeClass: "badge-ghost" },
};

const REPRODUCTIVE_OUTCOMES = {
  pregnant: { label: "Pregnant", badgeClass: "badge-success" },
  empty: { label: "Not pregnant", badgeClass: "badge-error" },
  "failed (negative pd)": { label: "Not pregnant", badgeClass: "badge-error" },
  "failed (re-heat)": { label: "Returned to heat", badgeClass: "badge-warning" },
  "failed (aborted)": { label: "Pregnancy loss", badgeClass: "badge-error" },
};

export const getBreedingAttemptPresentation = (attempt = {}) => {
  const serviceStatus = normalizeStatus(attempt.status);
  const serviceProgress = SERVICE_PROGRESS[serviceStatus] || {
    label: titleCase(attempt.status) || "Not recorded",
    badgeClass: "badge-ghost",
  };
  const pregnancy =
    attempt.pregnancy ||
    (attempt.pregnancyId && typeof attempt.pregnancyId === "object"
      ? attempt.pregnancyId
      : null);
  const officialResult =
    pregnancy?.pregnancyDiagnosis?.result || pregnancy?.result || null;
  const storedOutcome =
    attempt.outcome && String(attempt.outcome).toLowerCase() !== "pending"
      ? attempt.outcome
      : null;
  const outcomeKey = String(officialResult || storedOutcome || "").toLowerCase();
  const reproductiveOutcome = REPRODUCTIVE_OUTCOMES[outcomeKey] ||
    (["rejected", "cancelled"].includes(serviceStatus)
      ? { label: "No reproductive outcome", badgeClass: "badge-ghost" }
      : { label: "Awaiting official diagnosis", badgeClass: "badge-ghost" });

  return { serviceProgress, reproductiveOutcome };
};
