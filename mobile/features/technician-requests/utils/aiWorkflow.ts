import type {
  AllowedAction,
  VisitPeriod,
  WorkflowType,
} from "../types/technicianRequests.types";

export const formatLocalCalendarDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatLocalTime = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

export const getStaticDefaultTime = (): Date => {
  const t = new Date();
  t.setHours(8, 0, 0, 0); // Static 8:00 AM baseline
  return t;
};

export const isCanonicalWorkflowId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

export const isCanonicalAIAction = (
  workflowType: WorkflowType | undefined,
  allowedAction: AllowedAction | undefined,
  expected: "CLAIM_AND_SCHEDULE" | "RECORD_SERVICE" | "VIEW_RECORD",
) => workflowType === "AI" && allowedAction === expected;

export const isValidVisitPeriod = (
  value: string | null | undefined,
): value is VisitPeriod => value === "morning" || value === "afternoon";

export const getClaimScheduleErrorMessage = (error: any) => {
  const code = error?.response?.data?.code;
  const status = error?.response?.status;

  if (code === "REQUEST_NOT_CLAIMABLE") {
    return "This request can no longer be scheduled.";
  }
  if (code === "INVALID_VISIT_PERIOD") {
    return "Select Morning or Afternoon.";
  }
  if (
    code === "INVALID_SCHEDULE_DATE" ||
    code === "PAST_SCHEDULE_DATE" ||
    status === 422
  ) {
    return "Select today or a future visit date.";
  }
  if (status === 401 || status === 403) {
    return "You are not authorized to schedule this request.";
  }
  if (code === "REQUEST_ALREADY_CLAIMED" || status === 409) {
    return "This request was already claimed by another technician.";
  }
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Unable to schedule this request."
  );
};

export interface AIRecordingInput {
  estrus: string;
  sireBreed: string;
  sireCode: string;
  semenDosesUsed: string;
  technicianNote: string;
  serviceDate: Date;
  serviceTime: Date;
}

export const validateAIRecording = (input: AIRecordingInput) => {
  if (!["Natural", "Synchronized", "Induced"].includes(input.estrus)) {
    return "Select the estrus type observed for this insemination.";
  }
  const sireBreed = input.sireBreed.trim();
  const sireCode = input.sireCode.trim();
  const technicianNote = input.technicianNote.trim();
  const doseText = input.semenDosesUsed.trim();
  const doses = Number(doseText);

  if (!sireBreed) return "Sire breed is required.";
  if (sireBreed.length > 100) return "Sire breed must be 100 characters or fewer.";
  if (!sireCode) return "Sire code is required.";
  if (sireCode.length > 64) return "Sire code must be 64 characters or fewer.";
  if (!/^\d+$/.test(doseText) || !Number.isInteger(doses) || doses < 1) {
    return "Semen doses used must be a whole number of at least 1.";
  }
  if (technicianNote.length > 2000) {
    return "Technician note must be 2,000 characters or fewer.";
  }

  const actual = new Date(input.serviceDate);
  actual.setHours(
    input.serviceTime.getHours(),
    input.serviceTime.getMinutes(),
    0,
    0,
  );
  if (actual.getTime() > Date.now()) {
    return "Actual service date and time cannot be in the future.";
  }
  return null;
};
