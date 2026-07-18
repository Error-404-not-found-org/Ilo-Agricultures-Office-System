export const PREGNANCY_TASK_STAGE = Object.freeze({
  INITIAL_CONFIRMATION: "initial_confirmation",
  CONTINUATION_RECHECK: "continuation_recheck",
  DIAGNOSTIC_FOLLOW_UP: "diagnostic_follow_up",
});

const STAGES = new Set(Object.values(PREGNANCY_TASK_STAGE));

export const getPregnancyTaskStage = (task) => {
  const stage = task?.metadata?.workflowStage;
  return STAGES.has(stage) ? stage : PREGNANCY_TASK_STAGE.INITIAL_CONFIRMATION;
};

export const withNormalizedPregnancyTaskMetadata = (task) => ({
  ...(task?.metadata || {}),
  workflowStage: getPregnancyTaskStage(task),
  animalId: task?.metadata?.animalId || task?.animalIds?.[0]?._id || task?.animalIds?.[0] || null,
  farmerId: task?.metadata?.farmerId || task?.farmerId?._id || task?.farmerId || null,
});

