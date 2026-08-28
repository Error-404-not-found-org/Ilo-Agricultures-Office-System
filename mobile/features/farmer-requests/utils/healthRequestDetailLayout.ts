export type FarmerHealthRequestDetailSection =
  | "response"
  | "scheduled_visit"
  | "original_request"
  | "progress"
  | "clinical_details";

const normalize = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_");

export function getFarmerHealthRequestDetailSections(request: {
  status?: unknown;
  handlingMethod?: unknown;
  medicalRecordId?: unknown;
}): FarmerHealthRequestDetailSection[] {
  const status = normalize(request.status);
  const handlingMethod = normalize(request.handlingMethod);
  const resolved = ["resolved", "done", "completed"].includes(status);

  if (resolved && ["advice", "office_pickup"].includes(handlingMethod)) {
    return ["response", "original_request"];
  }

  if (status === "scheduled") {
    return ["scheduled_visit", "original_request"];
  }

  if (resolved && request.medicalRecordId) {
    return ["original_request", "progress", "clinical_details"];
  }

  return ["original_request", "progress"];
}
