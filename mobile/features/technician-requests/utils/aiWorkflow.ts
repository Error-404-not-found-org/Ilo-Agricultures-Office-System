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

const localDateFromCalendarKey = (dateKey: string) => {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const value = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
  );
  return Number.isNaN(value.getTime()) ? null : value;
};

export const getActualInseminationDefaults = (
  scheduledDate?: unknown,
  now = new Date(),
) => {
  const recordedAt = new Date(now);
  const todayKey = formatLocalCalendarDate(recordedAt);
  const rawSchedule = typeof scheduledDate === "string" ? scheduledDate : "";
  const scheduleKey = rawSchedule.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  const parsedSchedule = scheduleKey
    ? localDateFromCalendarKey(scheduleKey)
    : scheduledDate
      ? new Date(String(scheduledDate))
      : null;
  const normalizedScheduleKey =
    parsedSchedule && !Number.isNaN(parsedSchedule.getTime())
      ? formatLocalCalendarDate(parsedSchedule)
      : null;
  const isHistorical = Boolean(
    normalizedScheduleKey && normalizedScheduleKey < todayKey,
  );

  return {
    inseminationDate:
      isHistorical && normalizedScheduleKey
        ? localDateFromCalendarKey(normalizedScheduleKey) || recordedAt
        : recordedAt,
    // A visit daypart is never converted into an exact procedure time.
    inseminationTime: recordedAt,
    requiresTimeConfirmation: isHistorical,
  };
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
  if (code === "VISIT_PERIOD_IN_PAST") {
    return "That visit period has passed. Choose another available daypart.";
  }
  if (
    code === "INVALID_SCHEDULE_DATE" ||
    code === "PAST_SCHEDULE_DATE" ||
    status === 422
  ) {
    return "Select today or a future visit date.";
  }
  if (code === "NOT_ACCEPTING_REQUESTS") {
    return "Turn on Receive Requests before claiming new work.";
  }
  if (code === "TECHNICIAN_NOT_AVAILABLE") {
    return "You are not currently available for new requests.";
  }
  if (code === "OUTSIDE_SERVICE_AREA") {
    return "This request is outside your assigned Field Area.";
  }
  if (code === "SERVICE_CAPABILITY_REQUIRED") {
    return "You are not assigned to handle this type of request.";
  }
  if (code === "TECHNICIAN_NOT_OPERATIONAL") {
    return "Your Technician account is not currently available for new requests.";
  }
  if (code === "REQUEST_SERVICE_AREA_UNRESOLVED") {
    return "This request does not have a valid service municipality yet.";
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

export const getAIStartErrorMessage = (error: any) => {
  const code = String(error?.response?.data?.code || "");
  const backendMessage = error?.response?.data?.message;

  if (code === "IDEMPOTENCY_IN_PROGRESS") {
    return "This request is already being processed. Wait a moment, then refresh My Work.";
  }
  if (
    code === "AI_REQUEST_CONCURRENT_UPDATE" ||
    code === "AI_REQUEST_NOT_ACTIVE" ||
    /ALREADY|COMPLETED|TERMINAL/.test(code)
  ) {
    return "This AI request was already completed or changed. Refresh My Work before trying again.";
  }
  if (code === "INVALID_STATUS_TRANSITION") {
    return backendMessage || "This AI request is no longer ready to start.";
  }
  if (error?.response?.status === 401 || error?.response?.status === 403) {
    return "You are not authorized to start this AI service.";
  }
  return backendMessage || error?.message || "The AI service could not be started.";
};

export const getAIRecordingErrorMessage = (error: any) => {
  const code = String(error?.response?.data?.code || "");
  const backendMessage = error?.response?.data?.message;
  if (code === "INVALID_STATUS_TRANSITION") {
    return backendMessage || "This AI request is not ready to be completed.";
  }
  if (code === "EARLY_START_CONFIRMATION_REQUIRED") {
    return "Return to My Work and confirm whether you want to start this service early.";
  }
  if (code === "IDEMPOTENCY_IN_PROGRESS") {
    return "This completion is already being processed. Please wait before trying again.";
  }
  if (
    code === "AI_REQUEST_CONCURRENT_UPDATE" ||
    code === "AI_REQUEST_NOT_ACTIVE" ||
    /ALREADY|COMPLETED|DUPLICATE|TERMINAL/.test(code)
  ) {
    return "This AI request was already completed or changed. Refresh My Work before trying again.";
  }
  if (!error?.response) {
    return (
      error?.message ||
      "The service could not be submitted or queued. Check the connection and try again."
    );
  }
  return (
    backendMessage ||
    error.message ||
    "Failed to complete the insemination record."
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
