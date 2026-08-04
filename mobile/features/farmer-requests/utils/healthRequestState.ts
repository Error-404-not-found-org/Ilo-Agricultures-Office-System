export const ACTIVE_HEALTH_REQUEST_STATUSES = new Set([
  "pending",
  "triaged",
  "assigned",
  "approved",
  "scheduled",
  "in-progress",
  "in_progress",
]);

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
