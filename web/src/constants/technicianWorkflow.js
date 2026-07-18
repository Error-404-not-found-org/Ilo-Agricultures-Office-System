export const TECHNICIAN_SERVICE_TYPES = {
  ai: {
    workflow: "insemination",
    claimType: "ai",
    label: "Artificial Insemination",
    shortLabel: "AI",
    badgeClass: "badge-info",
  },
  health: {
    workflow: "health",
    claimType: "health",
    label: "Health Assistance",
    shortLabel: "Health",
    badgeClass: "badge-error",
  },
  breeding_verification: {
    workflow: "breeding_verification",
    claimType: "breeding_verification",
    label: "Breeding Verification",
    shortLabel: "Verify",
    badgeClass: "badge-secondary",
  },
  pregnancy_check: {
    workflow: "pregnancy_check",
    claimType: "breeding_verification",
    label: "Pregnancy Check",
    shortLabel: "PD",
    badgeClass: "badge-warning",
  },
  calving: {
    workflow: "calving",
    claimType: null,
    label: "Calving Assistance",
    shortLabel: "Calving",
    badgeClass: "badge-accent",
  },
};

export const TECHNICIAN_STATUS = {
  pending: { label: "Pending", badgeClass: "badge-warning" },
  assigned: { label: "Assigned", badgeClass: "badge-info" },
  approved: { label: "Assigned", badgeClass: "badge-info" },
  scheduled: { label: "Scheduled", badgeClass: "badge-info" },
  "in-progress": { label: "In Progress", badgeClass: "badge-primary" },
  in_progress: { label: "In Progress", badgeClass: "badge-primary" },
  done: { label: "Completed", badgeClass: "badge-success" },
  completed: { label: "Completed", badgeClass: "badge-success" },
  resolved: { label: "Resolved", badgeClass: "badge-success" },
  rejected: { label: "Rejected", badgeClass: "badge-ghost" },
  cancelled: { label: "Cancelled", badgeClass: "badge-ghost" },
};

export const getTechnicianStatus = (status) =>
  TECHNICIAN_STATUS[String(status || "").toLowerCase()] || {
    label: status || "Unknown",
    badgeClass: "badge-ghost",
  };

export const getClaimType = (type) => {
  const normalized = String(type || "").toLowerCase();
  if (["ai", "insemination", "artificial_insemination"].includes(normalized)) {
    return "ai";
  }
  if (normalized === "health") return "health";
  if (["breeding_verification", "pregnancy_check"].includes(normalized)) {
    return "breeding_verification";
  }
  return null;
};

export const PREGNANCY_WORKFLOW_STAGE = {
  INITIAL: "initial_confirmation",
  CONTINUATION: "continuation_recheck",
  FOLLOW_UP: "diagnostic_follow_up",
};

export const TASK_STATUS = {
  pending: { label: "Open", badgeClass: "badge-warning" },
  open: { label: "Open", badgeClass: "badge-warning" },
  claimed: { label: "In progress", badgeClass: "badge-info" },
  "in-progress": { label: "In progress", badgeClass: "badge-info" },
  in_progress: { label: "In progress", badgeClass: "badge-info" },
  completed: { label: "Completed", badgeClass: "badge-success" },
  done: { label: "Completed", badgeClass: "badge-success" },
  cancelled: { label: "Cancelled", badgeClass: "badge-ghost" },
};

export const TASK_TYPE = {
  AI: { label: "AI service", badgeClass: "badge-info" },
  PD: { label: "Pregnancy diagnosis", badgeClass: "badge-warning" },
  CD: { label: "Calving assistance", badgeClass: "badge-accent" },
  Calving: { label: "Calving assistance", badgeClass: "badge-accent" },
  Health: { label: "Health assistance", badgeClass: "badge-error" },
  Treatment: { label: "Treatment", badgeClass: "badge-error" },
  Vaccination: { label: "Vaccination", badgeClass: "badge-success" },
  Deworming: { label: "Deworming", badgeClass: "badge-success" },
  FollowUp: { label: "Follow-up visit", badgeClass: "badge-secondary" },
  GeneralVisit: { label: "General visit", badgeClass: "badge-ghost" },
};

export const WORKFLOW_STAGE = {
  initial_confirmation: "Initial pregnancy diagnosis",
  continuation_recheck: "Continuation recheck",
  diagnostic_follow_up: "Diagnostic follow-up",
};

const normalizeStatusKey = (value) =>
  String(value || "pending").trim().toLowerCase().replaceAll(" ", "_");

export const getTaskStatus = (status, dueDate, now = new Date()) => {
  const normalized = normalizeStatusKey(status);
  const base = TASK_STATUS[normalized] || {
    label: status || "Open",
    badgeClass: "badge-ghost",
  };
  const isComplete = ["completed", "done", "cancelled"].includes(normalized);
  const isOverdue = Boolean(
    !isComplete && dueDate && new Date(dueDate).getTime() < now.getTime(),
  );
  return isOverdue
    ? { label: "Overdue", badgeClass: "badge-error", isOverdue: true }
    : { ...base, isOverdue: false };
};

export const getTaskOperationalStatus = (task = {}, now = new Date()) => {
  const normalized = normalizeStatusKey(task.status);
  const status = normalized === "pending" && task.technicianId ? "claimed" : task.status;
  return getTaskStatus(status, task.dueDate, now);
};

export const getTaskType = (taskType) =>
  TASK_TYPE[taskType] || {
    label: String(taskType || "Task").replaceAll("_", " "),
    badgeClass: "badge-ghost",
  };

export const getWorkflowStage = (task = {}) => {
  const stage = task.metadata?.workflowStage || task.workflowStage;
  if (stage) return stage;
  return task.taskType === "PD" ? PREGNANCY_WORKFLOW_STAGE.INITIAL : null;
};

export const getWorkflowStageLabel = (task) => {
  const stage = typeof task === "string" ? task : getWorkflowStage(task);
  return WORKFLOW_STAGE[stage] || (stage ? String(stage).replaceAll("_", " ") : "Not applicable");
};

export const getTaskReadiness = (task = {}) => {
  const stage = getWorkflowStage(task);
  if (task.taskType !== "PD") {
    return { ready: true, label: "Ready", reason: "" };
  }
  if (stage !== PREGNANCY_WORKFLOW_STAGE.INITIAL) {
    return {
      ready: true,
      label: stage === PREGNANCY_WORKFLOW_STAGE.CONTINUATION ? "Milestone task" : "Follow-up required",
      reason:
        stage === PREGNANCY_WORKFLOW_STAGE.CONTINUATION
          ? "This task updates the existing pregnancy record."
          : "Review the previous diagnosis before continuing.",
    };
  }
  const readiness = task.pregnancyReadiness;
  if (!readiness || readiness.isEligible) {
    return { ready: true, label: "Ready", reason: "" };
  }
  return {
    ready: false,
    label: "Locked",
    reason: readiness.reason || "Pregnancy diagnosis is not available yet.",
  };
};
