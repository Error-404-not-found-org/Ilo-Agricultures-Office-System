// Phase 1 vocabulary is presentation/compatibility-only. Production workflow
// mutations continue to use HEALTH_STATUS from status-vocabulary.js.
export const CANONICAL_HEALTH_REQUEST_STATUS = Object.freeze({
  PENDING: "pending",
  ACTIVE: "active",
  IN_PROGRESS: "in-progress",
  RESOLVED: "resolved",
  CANCELLED: "cancelled",
});

export const HEALTH_REQUEST_STATUS_COMPATIBILITY = Object.freeze({
  TRIAGED: "triaged",
  ASSIGNED: "assigned",
  APPROVED: "approved",
  SCHEDULED: "scheduled",
  CLAIMED: "claimed",
  IN_PROGRESS_LEGACY: "in_progress",
  DONE: "done",
  COMPLETED: "completed",
  REJECTED: "rejected",
  UNASSIGNED: "unassigned",
  DECLINED: "declined",
});

const HEALTH_STATUS_PRESENTATION_MAP = Object.freeze({
  [CANONICAL_HEALTH_REQUEST_STATUS.PENDING]:
    CANONICAL_HEALTH_REQUEST_STATUS.PENDING,
  [HEALTH_REQUEST_STATUS_COMPATIBILITY.TRIAGED]:
    CANONICAL_HEALTH_REQUEST_STATUS.ACTIVE,
  [HEALTH_REQUEST_STATUS_COMPATIBILITY.ASSIGNED]:
    CANONICAL_HEALTH_REQUEST_STATUS.ACTIVE,
  [HEALTH_REQUEST_STATUS_COMPATIBILITY.APPROVED]:
    CANONICAL_HEALTH_REQUEST_STATUS.ACTIVE,
  [HEALTH_REQUEST_STATUS_COMPATIBILITY.SCHEDULED]:
    CANONICAL_HEALTH_REQUEST_STATUS.ACTIVE,
  [HEALTH_REQUEST_STATUS_COMPATIBILITY.CLAIMED]:
    CANONICAL_HEALTH_REQUEST_STATUS.ACTIVE,
  [CANONICAL_HEALTH_REQUEST_STATUS.ACTIVE]:
    CANONICAL_HEALTH_REQUEST_STATUS.ACTIVE,
  [HEALTH_REQUEST_STATUS_COMPATIBILITY.IN_PROGRESS_LEGACY]:
    CANONICAL_HEALTH_REQUEST_STATUS.IN_PROGRESS,
  [CANONICAL_HEALTH_REQUEST_STATUS.IN_PROGRESS]:
    CANONICAL_HEALTH_REQUEST_STATUS.IN_PROGRESS,
  [CANONICAL_HEALTH_REQUEST_STATUS.RESOLVED]:
    CANONICAL_HEALTH_REQUEST_STATUS.RESOLVED,
  [HEALTH_REQUEST_STATUS_COMPATIBILITY.DONE]:
    CANONICAL_HEALTH_REQUEST_STATUS.RESOLVED,
  [HEALTH_REQUEST_STATUS_COMPATIBILITY.COMPLETED]:
    CANONICAL_HEALTH_REQUEST_STATUS.RESOLVED,
  [CANONICAL_HEALTH_REQUEST_STATUS.CANCELLED]:
    CANONICAL_HEALTH_REQUEST_STATUS.CANCELLED,
  // Rejected remains distinguishable as terminal "not approved" history.
  [HEALTH_REQUEST_STATUS_COMPATIBILITY.REJECTED]:
    HEALTH_REQUEST_STATUS_COMPATIBILITY.REJECTED,
  // These values describe ownership/query or per-technician presentation and
  // are intentionally not converted into persisted lifecycle states.
  [HEALTH_REQUEST_STATUS_COMPATIBILITY.UNASSIGNED]:
    HEALTH_REQUEST_STATUS_COMPATIBILITY.UNASSIGNED,
  [HEALTH_REQUEST_STATUS_COMPATIBILITY.DECLINED]:
    HEALTH_REQUEST_STATUS_COMPATIBILITY.DECLINED,
});

const normalizedValue = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

export const normalizeHealthRequestStatus = (value) => {
  const normalized = normalizedValue(value);
  return HEALTH_STATUS_PRESENTATION_MAP[normalized] || normalized;
};

export const CANONICAL_HEALTH_REQUEST_TYPE = Object.freeze({
  HEALTH_CONCERN: "health_concern",
  MEDICINE_REQUEST: "medicine_request",
  PREVENTIVE_CARE: "preventive_care",
  OTHER: "other",
});

export const HEALTH_REQUEST_TYPE_COMPATIBILITY_GROUP = Object.freeze({
  REPRODUCTIVE_CONCERN: "legacy_reproductive_concern",
  CALVING_CONCERN: "legacy_calving_concern",
});

const HEALTH_REQUEST_TYPE_GROUP_MAP = Object.freeze({
  disease: CANONICAL_HEALTH_REQUEST_TYPE.HEALTH_CONCERN,
  injury: CANONICAL_HEALTH_REQUEST_TYPE.HEALTH_CONCERN,
  wound: CANONICAL_HEALTH_REQUEST_TYPE.HEALTH_CONCERN,
  weakness: CANONICAL_HEALTH_REQUEST_TYPE.HEALTH_CONCERN,
  abnormal_behavior: CANONICAL_HEALTH_REQUEST_TYPE.HEALTH_CONCERN,
  loss_of_appetite: CANONICAL_HEALTH_REQUEST_TYPE.HEALTH_CONCERN,
  fever: CANONICAL_HEALTH_REQUEST_TYPE.HEALTH_CONCERN,
  medicine: CANONICAL_HEALTH_REQUEST_TYPE.MEDICINE_REQUEST,
  deworming: CANONICAL_HEALTH_REQUEST_TYPE.MEDICINE_REQUEST,
  checkup: CANONICAL_HEALTH_REQUEST_TYPE.PREVENTIVE_CARE,
  vaccination: CANONICAL_HEALTH_REQUEST_TYPE.PREVENTIVE_CARE,
  other: CANONICAL_HEALTH_REQUEST_TYPE.OTHER,
  health_concern: CANONICAL_HEALTH_REQUEST_TYPE.HEALTH_CONCERN,
  medicine_request: CANONICAL_HEALTH_REQUEST_TYPE.MEDICINE_REQUEST,
  preventive_care: CANONICAL_HEALTH_REQUEST_TYPE.PREVENTIVE_CARE,
  pregnancy_complication:
    HEALTH_REQUEST_TYPE_COMPATIBILITY_GROUP.REPRODUCTIVE_CONCERN,
  difficult_calving: HEALTH_REQUEST_TYPE_COMPATIBILITY_GROUP.CALVING_CONCERN,
});

export const normalizeHealthRequestType = (value) => {
  const normalized = normalizedValue(value);
  return HEALTH_REQUEST_TYPE_GROUP_MAP[normalized] || normalized;
};

export const HEALTH_REQUEST_PRIORITY = Object.freeze({
  NORMAL: "normal",
  URGENT: "urgent",
});

const HEALTH_URGENCY_PRESENTATION_MAP = Object.freeze({
  low: HEALTH_REQUEST_PRIORITY.NORMAL,
  medium: HEALTH_REQUEST_PRIORITY.NORMAL,
  high: HEALTH_REQUEST_PRIORITY.URGENT,
  emergency: HEALTH_REQUEST_PRIORITY.URGENT,
  critical: HEALTH_REQUEST_PRIORITY.URGENT,
  normal: HEALTH_REQUEST_PRIORITY.NORMAL,
  urgent: HEALTH_REQUEST_PRIORITY.URGENT,
});

export const normalizeHealthUrgency = (value) => {
  const normalized = normalizedValue(value);
  return HEALTH_URGENCY_PRESENTATION_MAP[normalized] || normalized;
};

export const HEALTH_HANDLING_METHOD = Object.freeze({
  ADVICE: "advice",
  OFFICE_PICKUP: "office_pickup",
  FARM_VISIT: "farm_visit",
});

const idOf = (value) => value?._id ?? value?.id ?? value ?? null;

// Ownership remains field-derived; status normalization never assigns work.
export const healthRequestOwnerId = (request) =>
  idOf(request?.handledBy) || idOf(request?.assignedTechnicianId) || null;
