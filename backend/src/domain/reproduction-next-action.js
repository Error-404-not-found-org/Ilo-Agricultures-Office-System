import { verifyPostpartumWindow } from "../utils/cattleCore.js";
import {
  AI_STATUS,
  ANIMAL_REPRODUCTIVE_STATUS,
  LEGACY_ACTIVE_AI_STATUS,
  TASK_STATUS,
  normalizeAnimalReproductiveStatus,
} from "./status-vocabulary.js";

export const REPRODUCTION_PHASE = Object.freeze({
  AVAILABLE: "AVAILABLE",
  AI_REQUESTED: "AI_REQUESTED",
  AI_SCHEDULED: "AI_SCHEDULED",
  HEAT_RETURN_MONITORING: "HEAT_RETURN_MONITORING",
  PREGNANCY_CHECK_DUE: "PREGNANCY_CHECK_DUE",
  PREGNANCY_MONITORING: "PREGNANCY_MONITORING",
  PREGNANT: "PREGNANT",
  CALVING_DUE: "CALVING_DUE",
  RECOVERY_PERIOD: "RECOVERY_PERIOD",
});

export const REPRODUCTION_NEXT_ACTION_TYPE = Object.freeze({
  SCHEDULE_AI_SERVICE: "SCHEDULE_AI_SERVICE",
  ATTEND_AI_VISIT: "ATTEND_AI_VISIT",
  MONITOR_RETURN_TO_HEAT: "MONITOR_RETURN_TO_HEAT",
  VERIFY_BREEDING_OUTCOME: "VERIFY_BREEDING_OUTCOME",
  PERFORM_PREGNANCY_DIAGNOSIS: "PERFORM_PREGNANCY_DIAGNOSIS",
  PREPARE_FOR_CALVING: "PREPARE_FOR_CALVING",
  WAIT_FOR_POSTPARTUM_RECOVERY: "WAIT_FOR_POSTPARTUM_RECOVERY",
});

export const NEXT_ACTION_DATE_KIND = Object.freeze({
  CONFIRMED: "confirmed",
  REQUESTED: "requested",
  CALCULATED: "calculated",
});

const AI_REQUESTED_STATUSES = new Set([
  AI_STATUS.PENDING,
  AI_STATUS.APPROVED,
  LEGACY_ACTIVE_AI_STATUS.SUBMITTED,
  LEGACY_ACTIVE_AI_STATUS.ACCEPTED,
  LEGACY_ACTIVE_AI_STATUS.ASSIGNED,
  LEGACY_ACTIVE_AI_STATUS.AWAITING_SERVICE,
  LEGACY_ACTIVE_AI_STATUS.AWAITING_SERVICE_SPACED,
]);

const AI_SCHEDULED_STATUSES = new Set([
  AI_STATUS.SCHEDULED,
  AI_STATUS.IN_PROGRESS,
  LEGACY_ACTIVE_AI_STATUS.IN_PROGRESS,
]);

const AI_MONITORING_STATUSES = new Set([
  LEGACY_ACTIVE_AI_STATUS.AWAITING_RESULT,
  LEGACY_ACTIVE_AI_STATUS.AWAITING_RESULT_SPACED,
  LEGACY_ACTIVE_AI_STATUS.UNDER_MONITORING,
  LEGACY_ACTIVE_AI_STATUS.UNDER_MONITORING_SPACED,
]);

const OPEN_TASK_STATUSES = new Set([
  TASK_STATUS.PENDING.toLowerCase(),
  TASK_STATUS.IN_PROGRESS.toLowerCase(),
  "in-progress",
  "in_progress",
]);

const toValidDate = (value) => {
  if (!value) return null;

  const date = value instanceof Date ? new Date(value) : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const addDays = (value, days) => {
  const date = toValidDate(value);
  if (!date) return null;

  date.setDate(date.getDate() + days);
  return date;
};

const sameId = (left, right) => {
  if (!left || !right) return false;
  return String(left) === String(right);
};

const isOpenTask = (task) => {
  const status = String(task?.status || "")
    .trim()
    .toLowerCase();

  return OPEN_TASK_STATUSES.has(status);
};

const belongsToAnimal = (task, animalId) => {
  if (!animalId) return true;

  const animalIds = Array.isArray(task?.animalIds) ? task.animalIds : [];

  if (animalIds.length === 0) return false;

  return animalIds.some((id) => sameId(id?._id || id, animalId));
};

const sortTasksByDueDate = (tasks) =>
  [...tasks].sort((left, right) => {
    const leftDate = toValidDate(left?.dueDate);
    const rightDate = toValidDate(right?.dueDate);

    if (leftDate && rightDate) {
      return leftDate.getTime() - rightDate.getTime();
    }

    if (leftDate) return -1;
    if (rightDate) return 1;

    return 0;
  });

const findTask = ({
  tasks,
  animalId,
  taskTypes,
  sourceTypes,
  inseminationId,
}) => {
  const candidates = tasks.filter((task) => {
    if (!isOpenTask(task)) return false;
    if (!belongsToAnimal(task, animalId)) return false;

    if (taskTypes && !taskTypes.includes(task?.taskType)) {
      return false;
    }

    if (sourceTypes && !sourceTypes.includes(task?.sourceType)) {
      return false;
    }

    return true;
  });

  if (inseminationId) {
    const relatedCandidates = candidates.filter((task) => {
      const metadataInseminationId = task?.metadata?.inseminationId;

      return (
        sameId(metadataInseminationId, inseminationId) ||
        sameId(task?.relatedRecordId, inseminationId)
      );
    });

    if (relatedCandidates.length > 0) {
      return sortTasksByDueDate(relatedCandidates)[0];
    }
  }

  return sortTasksByDueDate(candidates)[0] || null;
};

const createAction = ({
  phase,
  type,
  label,
  at = null,
  dateKind = null,
  source = null,
  now,
}) => {
  const actionDate = toValidDate(at);
  const currentDate = toValidDate(now) || new Date();

  return {
    phase,
    type,
    label,
    at: actionDate,
    dateKind,
    source,
    isOverdue: Boolean(
      actionDate && actionDate.getTime() < currentDate.getTime(),
    ),
  };
};

export const resolveReproductionNextAction = ({
  animal,
  activeRequest = null,
  activePregnancy = null,
  tasks = [],
  now = new Date(),
} = {}) => {
  if (!animal) return null;

  const currentDate = toValidDate(now) || new Date();
  const animalId = animal._id || animal.id;
  const inseminationId = activeRequest?._id || activeRequest?.id;

  const reproductiveStatus = normalizeAnimalReproductiveStatus(
    animal.reproductiveStatus,
  );

  const calvingTask = findTask({
    tasks,
    animalId,
    taskTypes: ["Calving", "CD"],
  });

  /*
   * Confirmed pregnancy has the highest priority.
   * A stale AI request must never override an active pregnancy.
   */
  if (
    activePregnancy ||
    reproductiveStatus === ANIMAL_REPRODUCTIVE_STATUS.PREGNANT
  ) {
    const calvingTaskDate = toValidDate(calvingTask?.dueDate);

    const pregnancyTargetDate = toValidDate(activePregnancy?.targetCalvingDate);

    const animalExpectedDate = toValidDate(animal.expectedCalvingDate);

    const at = calvingTaskDate || pregnancyTargetDate || animalExpectedDate;

    const dateKind = calvingTaskDate
      ? NEXT_ACTION_DATE_KIND.CONFIRMED
      : at
        ? NEXT_ACTION_DATE_KIND.CALCULATED
        : null;

    const source = calvingTaskDate
      ? "task.dueDate"
      : pregnancyTargetDate
        ? "pregnancy.targetCalvingDate"
        : animalExpectedDate
          ? "animal.expectedCalvingDate"
          : null;

    const isCalvingDue = Boolean(at && at.getTime() <= currentDate.getTime());

    return createAction({
      phase: isCalvingDue
        ? REPRODUCTION_PHASE.CALVING_DUE
        : REPRODUCTION_PHASE.PREGNANT,
      type: REPRODUCTION_NEXT_ACTION_TYPE.PREPARE_FOR_CALVING,
      label: isCalvingDue
        ? "Calving follow-up is due"
        : "Prepare for expected calving",
      at,
      dateKind,
      source,
      now: currentDate,
    });
  }

  /*
   * Postpartum recovery is calculated using the canonical
   * species and breed recovery rules.
   */
  const lastCalvingDate = toValidDate(animal.lastCalvingDate);

  if (lastCalvingDate) {
    const recovery = verifyPostpartumWindow(
      lastCalvingDate,
      currentDate,
      animal.species,
      animal.breed,
    );

    if (!recovery.isSafe) {
      return createAction({
        phase: REPRODUCTION_PHASE.RECOVERY_PERIOD,
        type: REPRODUCTION_NEXT_ACTION_TYPE.WAIT_FOR_POSTPARTUM_RECOVERY,
        label: "Wait for postpartum recovery",
        at: addDays(lastCalvingDate, recovery.requiredDays),
        dateKind: NEXT_ACTION_DATE_KIND.CALCULATED,
        source: "animal.lastCalvingDate+postpartumRecoveryDays",
        now: currentDate,
      });
    }
  }

  /*
   * Farmer-requested verification should be surfaced before
   * ordinary monitoring because it requires technician action.
   */
  const verificationTask = findTask({
    tasks,
    animalId,
    taskTypes: ["PD"],
    sourceTypes: ["farmer_requested_verification"],
    inseminationId,
  });

  if (verificationTask) {
    return createAction({
      phase: REPRODUCTION_PHASE.PREGNANCY_CHECK_DUE,
      type: REPRODUCTION_NEXT_ACTION_TYPE.VERIFY_BREEDING_OUTCOME,
      label: "Verify the reported breeding outcome",
      at: verificationTask.dueDate,
      dateKind: NEXT_ACTION_DATE_KIND.CONFIRMED,
      source: "task.dueDate",
      now: currentDate,
    });
  }

  const aiTask = findTask({
    tasks,
    animalId,
    taskTypes: ["AI"],
    inseminationId,
  });

  if (activeRequest) {
    const requestStatus = activeRequest.status;
    const scheduledDate = toValidDate(activeRequest.scheduledDate);

    const aiTaskDate = toValidDate(aiTask?.dueDate);
    const preferredDate = toValidDate(activeRequest.preferredDate);

    /*
     * A real scheduled date takes priority even if an older
     * record still has a pending or approved status.
     */
    if (
      scheduledDate ||
      aiTaskDate ||
      AI_SCHEDULED_STATUSES.has(requestStatus)
    ) {
      const at = scheduledDate || aiTaskDate || preferredDate;

      return createAction({
        phase: REPRODUCTION_PHASE.AI_SCHEDULED,
        type: REPRODUCTION_NEXT_ACTION_TYPE.ATTEND_AI_VISIT,
        label: "Attend the scheduled AI visit",
        at,
        dateKind:
          scheduledDate || aiTaskDate
            ? NEXT_ACTION_DATE_KIND.CONFIRMED
            : preferredDate
              ? NEXT_ACTION_DATE_KIND.REQUESTED
              : null,
        source: scheduledDate
          ? "insemination.scheduledDate"
          : aiTaskDate
            ? "task.dueDate"
            : preferredDate
              ? "insemination.preferredDate"
              : null,
        now: currentDate,
      });
    }

    if (AI_REQUESTED_STATUSES.has(requestStatus)) {
      return createAction({
        phase: REPRODUCTION_PHASE.AI_REQUESTED,
        type: REPRODUCTION_NEXT_ACTION_TYPE.SCHEDULE_AI_SERVICE,
        label: "Schedule the AI service",
        at: preferredDate,
        dateKind: preferredDate ? NEXT_ACTION_DATE_KIND.REQUESTED : null,
        source: preferredDate ? "insemination.preferredDate" : null,
        now: currentDate,
      });
    }
  }

  const pregnancyDiagnosisTask = findTask({
    tasks,
    animalId,
    taskTypes: ["PD"],
    inseminationId,
  });

  const inseminationDate =
    toValidDate(activeRequest?.inseminationDate) ||
    toValidDate(animal.lastInseminationDate);

  const heatReturnCheckDate = addDays(inseminationDate, 21);

  const pregnancyDiagnosisDate =
    toValidDate(pregnancyDiagnosisTask?.dueDate) ||
    addDays(inseminationDate, 60);

  const shouldUseMonitoringWorkflow =
    reproductiveStatus === ANIMAL_REPRODUCTIVE_STATUS.INSEMINATED ||
    reproductiveStatus === ANIMAL_REPRODUCTIVE_STATUS.LIKELY_PREGNANT ||
    AI_MONITORING_STATUSES.has(activeRequest?.status);

  if (shouldUseMonitoringWorkflow) {
    if (reproductiveStatus === ANIMAL_REPRODUCTIVE_STATUS.LIKELY_PREGNANT) {
      const isDue = Boolean(
        pregnancyDiagnosisDate &&
        pregnancyDiagnosisDate.getTime() <= currentDate.getTime(),
      );

      return createAction({
        phase: isDue
          ? REPRODUCTION_PHASE.PREGNANCY_CHECK_DUE
          : REPRODUCTION_PHASE.PREGNANCY_MONITORING,
        type: REPRODUCTION_NEXT_ACTION_TYPE.PERFORM_PREGNANCY_DIAGNOSIS,
        label: isDue
          ? "Pregnancy diagnosis is due"
          : "Prepare for pregnancy diagnosis",
        at: pregnancyDiagnosisDate,
        dateKind: pregnancyDiagnosisTask?.dueDate
          ? NEXT_ACTION_DATE_KIND.CONFIRMED
          : pregnancyDiagnosisDate
            ? NEXT_ACTION_DATE_KIND.CALCULATED
            : null,
        source: pregnancyDiagnosisTask?.dueDate
          ? "task.dueDate"
          : pregnancyDiagnosisDate
            ? "insemination.inseminationDate+60d"
            : null,
        now: currentDate,
      });
    }

    if (
      heatReturnCheckDate &&
      currentDate.getTime() <= heatReturnCheckDate.getTime()
    ) {
      return createAction({
        phase: REPRODUCTION_PHASE.HEAT_RETURN_MONITORING,
        type: REPRODUCTION_NEXT_ACTION_TYPE.MONITOR_RETURN_TO_HEAT,
        label: "Monitor for return-to-heat signs",
        at: heatReturnCheckDate,
        dateKind: NEXT_ACTION_DATE_KIND.CALCULATED,
        source: "insemination.inseminationDate+21d",
        now: currentDate,
      });
    }

    if (pregnancyDiagnosisDate) {
      const isDue = pregnancyDiagnosisDate.getTime() <= currentDate.getTime();

      return createAction({
        phase: isDue
          ? REPRODUCTION_PHASE.PREGNANCY_CHECK_DUE
          : REPRODUCTION_PHASE.PREGNANCY_MONITORING,
        type: REPRODUCTION_NEXT_ACTION_TYPE.PERFORM_PREGNANCY_DIAGNOSIS,
        label: isDue
          ? "Pregnancy diagnosis is due"
          : "Prepare for pregnancy diagnosis",
        at: pregnancyDiagnosisDate,
        dateKind: pregnancyDiagnosisTask?.dueDate
          ? NEXT_ACTION_DATE_KIND.CONFIRMED
          : NEXT_ACTION_DATE_KIND.CALCULATED,
        source: pregnancyDiagnosisTask?.dueDate
          ? "task.dueDate"
          : "insemination.inseminationDate+60d",
        now: currentDate,
      });
    }

    if (heatReturnCheckDate) {
      return createAction({
        phase: REPRODUCTION_PHASE.HEAT_RETURN_MONITORING,
        type: REPRODUCTION_NEXT_ACTION_TYPE.MONITOR_RETURN_TO_HEAT,
        label: "Review overdue return-to-heat monitoring",
        at: heatReturnCheckDate,
        dateKind: NEXT_ACTION_DATE_KIND.CALCULATED,
        source: "insemination.inseminationDate+21d",
        now: currentDate,
      });
    }
  }

  return null;
};
