export const ACTIVE_HEALTH_REQUEST_STATUSES = new Set([
  "pending",
  "active",
  "triaged",
  "assigned",
  "approved",
  "scheduled",
  "in-progress",
  "in_progress",
]);

export const CANONICAL_HEALTH_REQUEST_TYPES = [
  "health_concern",
  "medicine_request",
  "preventive_care",
  "other",
] as const;

export const HEALTH_HANDLING_METHODS = [
  "advice",
  "office_pickup",
  "farm_visit",
] as const;

const HEALTH_STATUS_PRESENTATION: Record<string, string> = {
  pending: "pending",
  triaged: "active",
  assigned: "active",
  approved: "active",
  scheduled: "active",
  active: "active",
  claimed: "active",
  in_progress: "in-progress",
  "in-progress": "in-progress",
  resolved: "resolved",
  done: "resolved",
  completed: "resolved",
  cancelled: "cancelled",
  rejected: "rejected",
  unassigned: "unassigned",
  declined: "declined",
};

const HEALTH_REQUEST_TYPE_GROUP: Record<string, string> = {
  disease: "health_concern",
  injury: "health_concern",
  wound: "health_concern",
  weakness: "health_concern",
  abnormal_behavior: "health_concern",
  loss_of_appetite: "health_concern",
  fever: "health_concern",
  medicine: "medicine_request",
  deworming: "medicine_request",
  checkup: "preventive_care",
  vaccination: "preventive_care",
  other: "other",
  health_concern: "health_concern",
  medicine_request: "medicine_request",
  preventive_care: "preventive_care",
  pregnancy_complication: "legacy_reproductive_concern",
  difficult_calving: "legacy_calving_concern",
};

const HEALTH_URGENCY_PRESENTATION: Record<string, string> = {
  low: "normal",
  medium: "normal",
  high: "urgent",
  emergency: "urgent",
  critical: "urgent",
  normal: "normal",
  urgent: "urgent",
};

const normalizedValue = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

export const normalizeHealthRequestStatus = (value: unknown) => {
  const normalized = normalizedValue(value);
  return typeof normalized === "string"
    ? HEALTH_STATUS_PRESENTATION[normalized] || normalized
    : normalized;
};

export const normalizeHealthRequestType = (value: unknown) => {
  const normalized = normalizedValue(value);
  return typeof normalized === "string"
    ? HEALTH_REQUEST_TYPE_GROUP[normalized] || normalized
    : normalized;
};

export const normalizeHealthUrgency = (value: unknown) => {
  const normalized = normalizedValue(value);
  return typeof normalized === "string"
    ? HEALTH_URGENCY_PRESENTATION[normalized] || normalized
    : normalized;
};

export type HealthUrgencyPresentation = {
  priority: "normal" | "urgent";
  label: "Routine attention" | "Needs urgent attention";
  technicianContext?: "Marked urgent by farmer";
};

/**
 * Converts persisted and legacy urgency values into the two presentation
 * concepts supported by the simplified Health Request experience. Unknown
 * legacy values degrade to routine attention instead of inventing a clinical
 * severity classification.
 */
export const getHealthUrgencyPresentation = (
  value: unknown,
): HealthUrgencyPresentation => {
  if (normalizeHealthUrgency(value) === "urgent") {
    return {
      priority: "urgent",
      label: "Needs urgent attention",
      technicianContext: "Marked urgent by farmer",
    };
  }

  return {
    priority: "normal",
    label: "Routine attention",
  };
};

const idOf = (value: any) =>
  typeof value === "string" ? value : value?._id || value?.id;

export const findActiveHealthCase = (
  requests: any[] | undefined,
  animalId: string | undefined,
  requestType: string | undefined,
) => requests?.find(
  (request) =>
    idOf(request?.animalId) === animalId &&
    request?.requestType === requestType &&
    ACTIVE_HEALTH_REQUEST_STATUSES.has(request?.status),
);

export const getHealthRequestErrorMessage = (error: any) => {
  if (error?.response?.data?.code === "ACTIVE_HEALTH_CASE_EXISTS") {
    return "An active health case of this type already exists for this animal. View or update the existing case first.";
  }
  return error?.response?.data?.message || "Failed to submit. Please try again.";
};
