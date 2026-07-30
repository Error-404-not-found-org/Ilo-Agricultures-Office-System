import { AppError } from "../utils/app-error.js";

import {
  ANIMAL_REPRODUCTIVE_STATUS,
  AI_STATUS,
  HEALTH_STATUS,
  normalizeAIStatus,
  normalizeHealthStatus,
} from "./status-vocabulary.js";

export { ANIMAL_REPRODUCTIVE_STATUS, AI_STATUS, HEALTH_STATUS };

const transitions = {
  ai: {
    pending: ["approved", "scheduled", "rejected", "cancelled"],
    approved: ["scheduled", "rejected", "cancelled"],
    scheduled: ["scheduled", "in-progress", "cancelled"],
    "in-progress": ["scheduled", "done", "cancelled"],
    done: [], rejected: [], cancelled: [],
  },
  health: {
    pending: ["approved", "scheduled", "rejected", "cancelled"],
    triaged: ["approved", "scheduled", "rejected", "cancelled"],
    assigned: ["approved", "scheduled", "rejected", "cancelled"],
    approved: ["scheduled", "rejected", "cancelled"],
    scheduled: ["scheduled", "in-progress", "cancelled"],
    "in-progress": ["scheduled", "resolved", "cancelled"],
    resolved: [], rejected: [], cancelled: [],
  },
};

export const assertStatusTransition = (workflow, currentStatus, nextStatus, { isAdmin = false } = {}) => {
  const normalizeStatus =
    workflow === "health" ? normalizeHealthStatus : normalizeAIStatus;
  const normalizedCurrent = normalizeStatus(currentStatus);
  const normalizedNext = normalizeStatus(nextStatus);
  if (normalizedCurrent === normalizedNext || isAdmin) return;
  const allowed = transitions[workflow]?.[normalizedCurrent] || [];
  if (!allowed.includes(normalizedNext)) {
    throw new AppError(`Cannot change ${workflow} status from ${currentStatus} to ${nextStatus}.`, {
      status: 409,
      code: "INVALID_STATUS_TRANSITION",
      details: { workflow, currentStatus: normalizedCurrent, nextStatus: normalizedNext, allowed },
    });
  }
};

export const reproductiveStatusForPregnancyResult = (result) =>
  result === "Pregnant" ? ANIMAL_REPRODUCTIVE_STATUS.PREGNANT : ANIMAL_REPRODUCTIVE_STATUS.NORMAL;
