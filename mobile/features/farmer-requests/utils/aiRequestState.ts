export const ACTIVE_AI_REQUEST_STATUSES = new Set([
  "pending",
  "submitted",
  "approved",
  "accepted",
  "assigned",
  "scheduled",
  "in-progress",
  "in_progress",
  "awaiting-service",
  "awaiting service",
  "awaiting-result",
  "awaiting result",
  "under-monitoring",
  "under monitoring",
]);

const idOf = (value: any) =>
  typeof value === "string" ? value : value?._id || value?.id;

export const findActiveAIRequestForAnimal = (
  requests: any[] | undefined,
  animalId: string | undefined,
) => {
  if (!animalId) return undefined;
  return requests?.find(
    (request) =>
      idOf(request?.animalId) === animalId &&
      ACTIVE_AI_REQUEST_STATUSES.has(request?.status),
  );
};

export const getAIRequestSubmitErrorMessage = (error: any) => {
  if (error?.response?.data?.code === "ACTIVE_AI_REQUEST_EXISTS") {
    return "An active AI service request already exists for this animal. Complete or cancel it before submitting another one.";
  }
  return (
    error?.response?.data?.message ||
    "Failed to submit request. Please try again."
  );
};

export const AI_REQUEST_INVALIDATION_KEYS = [
  ["farmer", "requests"],
  ["farmer", "ai-requests"],
  ["ai-requests"],
] as const;

export const getAIRequestSubmitState = ({
  hasActiveRequest,
  isSubmitting,
}: {
  hasActiveRequest: boolean;
  isSubmitting: boolean;
}) => ({
  disabled: hasActiveRequest || isSubmitting,
  label: hasActiveRequest
    ? "Active request already exists"
    : "Submit AI Service Request",
});
