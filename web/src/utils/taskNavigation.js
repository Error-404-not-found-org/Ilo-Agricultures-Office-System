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
