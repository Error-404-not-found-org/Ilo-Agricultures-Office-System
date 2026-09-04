import {
  PREGNANCY_WORKFLOW_STAGE,
  getWorkflowStage,
} from "../constants/technicianWorkflow";

const idOf = (value) =>
  value?._id || value?.id || (typeof value === "string" ? value : null);

const CANONICAL_MY_WORK_PATH = "/technician/requests?section=myWork";

export const getTaskRelationship = (item = {}) => {
  const raw = item.raw || item;
  const metadata = raw.metadata || item.metadata || {};
  return {
    taskId: idOf(item.taskId) || idOf(raw.taskId) || null,
    workflowId: idOf(item._id) || idOf(raw._id) || idOf(item.id) || idOf(raw.id) || null,
    requestId:
      idOf(item.requestId) ||
      idOf(raw.requestId) ||
      (!raw.workflowType ? idOf(raw) : null),
    sourceType:
      item.sourceType || raw.sourceType || metadata.sourceType || null,
    sourceId:
      idOf(item.sourceId) || idOf(raw.sourceId) || idOf(metadata.sourceId),
    animalId:
      idOf(item.animalId) ||
      idOf(raw.animalId) ||
      idOf(metadata.animalId) ||
      idOf(raw.animalIds?.[0]),
    pregnancyId:
      idOf(item.pregnancyId) ||
      idOf(raw.pregnancyId) ||
      idOf(metadata.pregnancyId) ||
      idOf(raw.relatedRecordId),
    workflowStage: getWorkflowStage(raw),
  };
};

export const getCalendarTarget = (item = {}) => {
  const relation = getTaskRelationship(item);
  if (relation.taskId) {
    return {
      kind: "task",
      path: "/technician/requests",
      search: `?section=myWork&taskId=${encodeURIComponent(relation.taskId)}`,
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
  const { allowedAction, workflowType } = task;

  switch (allowedAction) {
    case "CLAIM":
      return "Claim Task";
    case "SCHEDULE_VISIT":
      return "Schedule Visit";
    case "HANDLE_REQUEST":
      return "Handle Request";
    case "START_SERVICE":
      return "Start Service";
    case "RECORD_SERVICE": {
      if (workflowType === "PD") {
        const stage = getWorkflowStage(task);
        if (stage === PREGNANCY_WORKFLOW_STAGE.CONTINUATION)
          return "Record Recheck";
        if (stage === PREGNANCY_WORKFLOW_STAGE.FOLLOW_UP) return "Record Follow-up";
        return "Record Diagnosis";
      }
      if (workflowType === "AI") return "Record AI";
      if (
        ["Health", "Treatment", "Vaccination", "Deworming"].includes(workflowType)
      )
        return "Record Health";
      if (["CD", "Calving"].includes(workflowType)) return "Record Calving";
      return "Record Service";
    }
    case "VIEW_RECORD":
      return "View Record";
    default:
      return "Complete";
  }
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
  const resolvedTaskId = taskId || task.taskId;
  if (
    [
      PREGNANCY_WORKFLOW_STAGE.CONTINUATION,
      PREGNANCY_WORKFLOW_STAGE.FOLLOW_UP,
    ].includes(stage)
  ) {
    const pregnancyId =
      task.metadata?.pregnancyId ||
      task.relatedRecordId?._id ||
      task.relatedRecordId;
    return {
      url: `/technician/pregnancy-checks/${pregnancyId}/continuation-recheck`,
      payload: {
        result,
        checkedAt: diagnosisDate,
        notes: note,
        followUpDate:
          result === "follow_up_required" ? followUpDate : undefined,
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
  const animalReference =
    animal.earTag ||
    animal.animalId ||
    (typeof animal === "string" ? animal : null) ||
    raw.animalReference ||
    null;

  return {
    taskId: idOf(raw.taskId),
    workflowId: idOf(raw._id || raw.id),
    workflowType: raw.workflowType || null,
    allowedAction: raw.allowedAction || null,
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
        (["PD", "CD", "Calving"].includes(raw.workflowType)
          ? raw.relatedRecordId
          : null),
    ),
    inseminationId: idOf(
      metadata.inseminationId ||
        raw.inseminationId ||
        (raw.workflowType === "PD" ? raw.relatedRecordId : null),
    ),
    healthRequestId: idOf(
      metadata.healthRequestId ||
        raw.healthRequestId ||
        (["Health", "Treatment", "Vaccination", "Deworming"].includes(
          raw.workflowType,
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
  const { allowedAction, workflowType } = taskContext || {};
  
  if (!allowedAction) {
    return {
      type: "none",
      path: null,
      label: "Complete task",
    };
  }

  return {
    type: allowedAction,
    workflow: workflowType,
    label: getTaskPrimaryActionLabel(taskContext),
  };
};

export const validateTaskContextForAction = (taskContext) => {
  if (!taskContext) {
    return {
      valid: false,
      errorType: "missing_info",
      message:
        "This task does not contain enough information to open the service form.",
    };
  }
  const { allowedAction, workflowType, animalId, farmerId } = taskContext;

  if (!allowedAction) {
    return {
      valid: false,
      errorType: "unavailable",
      message: "The requested service workflow could not be opened.",
    };
  }

  if (allowedAction === "RECORD_SERVICE") {
    if (
      [
        "AI",
        "Health",
        "Treatment",
        "Vaccination",
        "Deworming",
        "CD",
        "Calving",
      ].includes(workflowType)
    ) {
      if (!animalId || !farmerId) {
        return {
          valid: false,
          errorType: "missing_info",
          message:
            "This task does not contain enough information to open the service form.",
        };
      }
    }
  }

  return { valid: true, errorType: null, message: null };
};

const SAFE_RETURN_PATHS = [
  "/technician/work-queue",
  "/technician/schedule",
  "/technician/requests",
];

export const sanitizeReturnTo = (path) => {
  if (!path) return CANONICAL_MY_WORK_PATH;
  const basePath = path.split("?")[0];
  if (basePath === "/technician/work-queue") {
    const query = path.includes("?") ? path.slice(path.indexOf("?") + 1) : "";
    const params = new URLSearchParams(query);
    params.set("section", "myWork");
    params.delete("workflowState");
    params.delete("workState");
    params.delete("workStateFilter");
    params.delete("scope");
    params.delete("statusFilter");
    return `/technician/requests?${params.toString()}`;
  }
  if (SAFE_RETURN_PATHS.includes(basePath)) {
    return path;
  }
  return CANONICAL_MY_WORK_PATH;
};

export const buildTaskNavigationState = (
  taskContext,
  returnTo = CANONICAL_MY_WORK_PATH,
) => {
  return {
    taskContext,
    taskId: taskContext?.taskId || null,
    workflowId: taskContext?.workflowId || null,
    animalId: taskContext?.animalId || null,
    farmerId: taskContext?.farmerId || null,
    requestId: taskContext?.requestId || null,
    pregnancyId: taskContext?.pregnancyId || null,
    returnTo: sanitizeReturnTo(returnTo),
  };
};
