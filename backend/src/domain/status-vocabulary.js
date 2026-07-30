export const ANIMAL_REPRODUCTIVE_STATUS = Object.freeze({
  NORMAL: "Normal",
  IN_HEAT: "In Heat",
  INSEMINATED: "Inseminated",
  LIKELY_PREGNANT: "Likely Pregnant",
  PREGNANT: "Pregnant",
  DRY: "Dry",
  LACTATING: "Lactating",
  POST_PARTUM: "Post-partum",
});

// Compatibility values may exist in older databases and installed clients.
// New writes are normalized to the canonical vocabulary below.
export const LEGACY_ANIMAL_REPRODUCTIVE_STATUS = Object.freeze({
  OPEN: "Open",
  POSTPARTUM: "Postpartum",
});

export const normalizeAnimalReproductiveStatus = (value) => {
  if (value === LEGACY_ANIMAL_REPRODUCTIVE_STATUS.OPEN) {
    return ANIMAL_REPRODUCTIVE_STATUS.NORMAL;
  }
  if (value === LEGACY_ANIMAL_REPRODUCTIVE_STATUS.POSTPARTUM) {
    return ANIMAL_REPRODUCTIVE_STATUS.POST_PARTUM;
  }
  return value;
};

export const reproductiveStatusQuery = (value) => {
  const normalized = normalizeAnimalReproductiveStatus(value);
  if (normalized === ANIMAL_REPRODUCTIVE_STATUS.NORMAL) {
    return { $in: [ANIMAL_REPRODUCTIVE_STATUS.NORMAL, LEGACY_ANIMAL_REPRODUCTIVE_STATUS.OPEN] };
  }
  if (normalized === ANIMAL_REPRODUCTIVE_STATUS.POST_PARTUM) {
    return { $in: [ANIMAL_REPRODUCTIVE_STATUS.POST_PARTUM, LEGACY_ANIMAL_REPRODUCTIVE_STATUS.POSTPARTUM] };
  }
  return normalized;
};

export const AI_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  SCHEDULED: "scheduled",
  IN_PROGRESS: "in-progress",
  DONE: "done",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
});

// These compatibility values are read-only. They may still exist in older
// databases or queued mobile requests, but all new writes use AI_STATUS.
export const LEGACY_ACTIVE_AI_STATUS = Object.freeze({
  SUBMITTED: "submitted",
  ACCEPTED: "accepted",
  ASSIGNED: "assigned",
  IN_PROGRESS: "in_progress",
  AWAITING_SERVICE: "awaiting-service",
  AWAITING_SERVICE_SPACED: "awaiting service",
  AWAITING_RESULT: "awaiting-result",
  AWAITING_RESULT_SPACED: "awaiting result",
  UNDER_MONITORING: "under-monitoring",
  UNDER_MONITORING_SPACED: "under monitoring",
});

export const normalizeAIStatus = (value) =>
  value === LEGACY_ACTIVE_AI_STATUS.IN_PROGRESS
    ? AI_STATUS.IN_PROGRESS
    : value;

export const ACTIVE_AI_REQUEST_STATUSES = Object.freeze([
  AI_STATUS.PENDING,
  AI_STATUS.APPROVED,
  AI_STATUS.SCHEDULED,
  AI_STATUS.IN_PROGRESS,
  ...Object.values(LEGACY_ACTIVE_AI_STATUS),
]);

export const isActiveAIRequestStatus = (status) =>
  ACTIVE_AI_REQUEST_STATUSES.includes(status);

export const HEALTH_STATUS = Object.freeze({
  PENDING: "pending",
  TRIAGED: "triaged",
  ASSIGNED: "assigned",
  APPROVED: "approved",
  SCHEDULED: "scheduled",
  IN_PROGRESS: "in-progress",
  IN_PROGRESS_LEGACY: "in_progress",
  RESOLVED: "resolved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
});

export const normalizeHealthStatus = (value) =>
  value === HEALTH_STATUS.IN_PROGRESS_LEGACY
    ? HEALTH_STATUS.IN_PROGRESS
    : value;

export const ACTIVE_HEALTH_REQUEST_STATUSES = Object.freeze([
  HEALTH_STATUS.PENDING,
  HEALTH_STATUS.TRIAGED,
  HEALTH_STATUS.ASSIGNED,
  HEALTH_STATUS.APPROVED,
  HEALTH_STATUS.SCHEDULED,
  HEALTH_STATUS.IN_PROGRESS,
  HEALTH_STATUS.IN_PROGRESS_LEGACY,
]);

export const isActiveHealthRequestStatus = (status) =>
  ACTIVE_HEALTH_REQUEST_STATUSES.includes(status);

export const PREGNANCY_RESULT = Object.freeze({
  PREGNANT: "Pregnant",
  EMPTY: "Empty",
});

export const TASK_STATUS = Object.freeze({
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
});

export const CALVING_EASE = Object.freeze({
  NORMAL: "Normal",
  NATURAL: "Natural",
  DIFFICULT: "Difficult",
  ABORTION: "Abortion",
  STILLBIRTH: "Stillbirth",
  CESAREAN: "Cesarean",
});
