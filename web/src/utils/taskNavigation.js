import { PREGNANCY_WORKFLOW_STAGE, getWorkflowStage } from "../constants/technicianWorkflow";

const idOf = (value) => value?._id || value?.id || (typeof value === "string" ? value : null);

export const getTaskRelationship = (item = {}) => {
  const raw = item.raw || item;
  const metadata = raw.metadata || item.metadata || {};
  return {
    taskId: idOf(item.taskId) || idOf(raw.taskId) || (raw.taskType ? idOf(raw) : null),
    requestId: idOf(item.requestId) || idOf(raw.requestId) || (!raw.taskType ? idOf(raw) : null),
    sourceType: item.sourceType || raw.sourceType || metadata.sourceType || null,
    sourceId: idOf(item.sourceId) || idOf(raw.sourceId) || idOf(metadata.sourceId),
    animalId: idOf(item.animalId) || idOf(raw.animalId) || idOf(metadata.animalId) || idOf(raw.animalIds?.[0]),
    pregnancyId: idOf(item.pregnancyId) || idOf(raw.pregnancyId) || idOf(metadata.pregnancyId) || idOf(raw.relatedRecordId),
    workflowStage: getWorkflowStage(raw),
  };
};

export const getCalendarTarget = (item = {}) => {
  const relation = getTaskRelationship(item);
  if (relation.taskId) {
    return {
      kind: "task",
      path: "/technician/work-queue",
      search: `?taskId=${encodeURIComponent(relation.taskId)}`,
      workflowStage: relation.workflowStage,
    };
  }
  if (relation.requestId) {
    return {
      kind: "request",
      path: "/technician/requests",
      search: `?requestId=${encodeURIComponent(relation.requestId)}`,
    };
  }
  return { kind: "none", path: null, search: "" };
};

export const getTaskPrimaryActionLabel = (task = {}) => {
  if (task.taskType === "PD") {
    const stage = getWorkflowStage(task);
    if (stage === PREGNANCY_WORKFLOW_STAGE.CONTINUATION) return "Record continuation recheck";
    if (stage === PREGNANCY_WORKFLOW_STAGE.FOLLOW_UP) return "Record diagnostic follow-up";
    return "Record pregnancy diagnosis";
  }
  if (task.taskType === "AI") return "Record AI service";
  if (["Health", "Treatment", "Vaccination", "Deworming"].includes(task.taskType)) return "Record health assistance";
  if (["CD", "Calving"].includes(task.taskType)) return "Record calving";
  return "Complete task";
};

export const buildPregnancyActionRequest = ({
  task = {},
  animalId,
  inseminationId,
  result,
  note,
  diagnosisDate,
  taskId,
  followUpDate,
  diagnosticMethod,
}) => {
  const stage = getWorkflowStage(task);
  const resolvedTaskId = taskId || task._id || task.id;
  if ([PREGNANCY_WORKFLOW_STAGE.CONTINUATION, PREGNANCY_WORKFLOW_STAGE.FOLLOW_UP].includes(stage)) {
    const pregnancyId = task.metadata?.pregnancyId || task.relatedRecordId?._id || task.relatedRecordId;
    return {
      url: `/technician/pregnancy-checks/${pregnancyId}/continuation-recheck`,
      payload: {
        result,
        checkedAt: diagnosisDate,
        notes: note,
        followUpDate: result === "follow_up_required" ? followUpDate : undefined,
        taskId: resolvedTaskId,
      },
    };
  }
  return {
    url: "/technician/pregnancy-check",
    payload: {
      animalId,
      inseminationId,
      result,
      technicianNote: note,
      diagnosisDate,
      taskId: resolvedTaskId,
      methodCode: diagnosticMethod || undefined,
      policyVersion: task.pregnancyReadiness?.policyVersion,
    },
  };
};

export const normalizeTaskContext = (task = {}) => {
  if (!task) return null;
  const raw = task.raw || task;
  const metadata = raw.metadata || task.metadata || {};

  const animal = raw.animalIds?.[0] || raw.animalId || {};
  const animalReference = animal.earTag || animal.animalId || (typeof animal === "string" ? animal : null) || raw.animalReference || null;

  return {
    taskId: idOf(raw._id || raw.id || raw.taskId),
    taskType: raw.taskType || null,
    workflowStage: getWorkflowStage(raw),
    taskStatus: raw.status || null,
    requestId: idOf(raw.requestId || metadata.requestId),
    sourceType: raw.sourceType || metadata.sourceType || null,
    sourceId: idOf(raw.sourceId || metadata.sourceId),
    farmerId: idOf(raw.farmerId),
    farmerName: raw.farmerId?.name || raw.farmerName || null,
    animalId: idOf(raw.animalId || metadata.animalId || raw.animalIds?.[0]),
    animalReference,
    dueDate: raw.dueDate || null,
    pregnancyId: idOf(
      metadata.pregnancyId ||
        raw.pregnancyId ||
        (["PD", "CD", "Calving"].includes(raw.taskType)
          ? raw.relatedRecordId
          : null),
    ),
    inseminationId: idOf(
      metadata.inseminationId ||
        raw.inseminationId ||
        (raw.taskType === "PD" ? raw.relatedRecordId : null),
    ),
    healthRequestId: idOf(
      metadata.healthRequestId ||
        raw.healthRequestId ||
        (["Health", "Treatment", "Vaccination", "Deworming"].includes(
          raw.taskType,
        )
          ? raw.relatedRecordId
          : null),
    ),
    metadata,
    returnTo: raw.returnTo || null,
    raw: raw,
  };
};

export const getTaskActionTarget = (taskContext) => {
  const type = taskContext?.taskType;
  if (type === "PD") {
    return {
      type: "modal",
      path: null,
      label: getTaskPrimaryActionLabel(taskContext),
    };
  }
  if (type === "AI") {
    return {
      type: "route",
      path: "/technician/walk-in",
      label: "Record AI Service",
    };
  }
  if (["Health", "Treatment", "Vaccination", "Deworming"].includes(type)) {
    return {
      type: "route",
      path: "/technician/health",
      label: "Complete Health Assistance",
    };
  }
  if (["CD", "Calving"].includes(type)) {
    return {
      type: "route",
      path: "/technician/newborns",
      label: "Record Calving",
    };
  }
  return {
    type: "none",
    path: null,
    label: "Complete task",
  };
};

export const validateTaskContextForAction = (taskContext) => {
  if (!taskContext) {
    return {
      valid: false,
      errorType: "missing_info",
      message: "This task does not contain enough information to open the service form."
    };
  }
  const { taskId, taskType, animalId, farmerId } = taskContext;

  if (!taskId || !taskType) {
    return {
      valid: false,
      errorType: "missing_info",
      message: "This task does not contain enough information to open the service form."
    };
  }

  const target = getTaskActionTarget(taskContext);
  if (target.type === "none") {
    return {
      valid: false,
      errorType: "unavailable",
      message: "The requested service workflow could not be opened."
    };
  }

  if (["AI", "Health", "Treatment", "Vaccination", "Deworming", "CD", "Calving"].includes(taskType)) {
    if (!animalId || !farmerId) {
      return {
        valid: false,
        errorType: "missing_info",
        message: "This task does not contain enough information to open the service form."
      };
    }
  }

  return { valid: true, errorType: null, message: null };
};

const SAFE_RETURN_PATHS = [
  "/technician/work-queue",
  "/technician/schedule",
  "/technician/requests"
];

export const sanitizeReturnTo = (path) => {
  if (!path) return "/technician/work-queue";
  const basePath = path.split("?")[0];
  if (SAFE_RETURN_PATHS.includes(basePath)) {
    return path;
  }
  return "/technician/work-queue";
};

export const buildTaskNavigationState = (taskContext, returnTo = "/technician/work-queue") => {
  return {
    taskContext,
    taskId: taskContext?.taskId || null,
    animalId: taskContext?.animalId || null,
    farmerId: taskContext?.farmerId || null,
    requestId: taskContext?.requestId || null,
    pregnancyId: taskContext?.pregnancyId || null,
    returnTo: sanitizeReturnTo(returnTo),
  };
};
