export const MAX_HEALTH_ADVICE_LENGTH = 2000;

export interface HealthAdviceDraft {
  adviceForFarmer: string;
  followUpDate: string;
  internalNote: string;
}

export interface HealthAdvicePayload {
  advice: string;
  technicianNote?: string;
  followUpDate?: string;
}

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export const formatHealthFollowUpDateKey = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseHealthFollowUpDateKey = (value: string) => {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  parsed.setHours(0, 0, 0, 0);

  return parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
    ? parsed
    : null;
};

export const formatHealthFollowUpDateLabel = (value: string) => {
  const parsed = parseHealthFollowUpDateKey(value);
  if (!parsed) return "";

  return parsed.toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const entityPresent = (value: unknown) => {
  if (!value) return false;
  if (typeof value === "string") return Boolean(value.trim());
  return Boolean(
    (value as { _id?: unknown; id?: unknown })._id ||
      (value as { id?: unknown }).id,
  );
};

export const isHealthAdviceEligible = (request: any) => {
  const status = text(request?.status).toLowerCase().replace(/_/g, "-");
  const handlingMethod = text(request?.handlingMethod).toLowerCase();
  const hasOwner =
    entityPresent(request?.handledBy) ||
    entityPresent(request?.assignedTechnicianId);

  if (
    status === "scheduled" ||
    request?.scheduledDate ||
    request?.visitPeriod ||
    ["farm_visit", "office_pickup"].includes(handlingMethod) ||
    [
      "in-progress",
      "resolved",
      "done",
      "completed",
      "cancelled",
      "rejected",
      "declined",
    ].includes(status)
  ) {
    return false;
  }

  if (status === "pending") return true;
  return hasOwner && ["triaged", "assigned", "approved"].includes(status);
};

export const validateHealthAdviceDraft = (draft: HealthAdviceDraft) => {
  const advice = draft.adviceForFarmer.trim();
  if (!advice) return "Advice for the farmer is required.";
  if (advice.length > MAX_HEALTH_ADVICE_LENGTH) {
    return `Advice must be ${MAX_HEALTH_ADVICE_LENGTH.toLocaleString()} characters or fewer.`;
  }
  return null;
};

export const buildHealthAdvicePayload = (
  draft: HealthAdviceDraft,
): HealthAdvicePayload => {
  const payload: HealthAdvicePayload = {
    advice: draft.adviceForFarmer.trim(),
  };
  const technicianNote = draft.internalNote.trim();
  const followUpDate = draft.followUpDate.trim();

  if (technicianNote) payload.technicianNote = technicianNote;
  if (followUpDate) payload.followUpDate = followUpDate;

  return payload;
};
