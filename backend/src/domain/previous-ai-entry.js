import {
  checkInseminationAgeEligibility,
  getBreedProfile,
} from "../utils/cattleCore.js";
import { AppError } from "../utils/app-error.js";

export const PREVIOUS_AI_ENTRY_MODE = Object.freeze({
  HISTORY_ONLY: "history_only",
  CONTINUE_TRACKING: "continue_tracking",
});

export const HISTORY_ONLY_AI_QUERY = Object.freeze({
  entryMode: PREVIOUS_AI_ENTRY_MODE.HISTORY_ONLY,
});

export const CURRENT_AI_ATTEMPT_QUERY = Object.freeze({
  entryMode: { $ne: PREVIOUS_AI_ENTRY_MODE.HISTORY_ONLY },
});

export const isHistoryOnlyAIRecord = (record) =>
  record?.entryMode === PREVIOUS_AI_ENTRY_MODE.HISTORY_ONLY;

export const normalizePreviousAIEntryMode = (value) => {
  if (Object.values(PREVIOUS_AI_ENTRY_MODE).includes(value)) return value;

  throw new AppError(
    "Choose whether this previous AI is history only or should continue current tracking.",
    { status: 400, code: "PREVIOUS_AI_ENTRY_MODE_REQUIRED" },
  );
};

export const validatePreviousAIEventDate = ({
  eventDate,
  birthDate,
  species,
  now = new Date(),
}) => {
  const parsedEventDate = new Date(eventDate);
  if (Number.isNaN(parsedEventDate.getTime())) {
    throw new AppError("A valid previous AI service date is required.", {
      status: 400,
      code: "INVALID_PREVIOUS_AI_DATE",
    });
  }

  const parsedNow = new Date(now);
  if (parsedEventDate.getTime() > parsedNow.getTime()) {
    throw new AppError("Previous AI service date cannot be in the future.", {
      status: 400,
      code: "PREVIOUS_AI_DATE_IN_FUTURE",
    });
  }

  if (!birthDate) {
    throw new AppError(
      "Birth date is required before a previous AI record can be validated.",
      { status: 400, code: "BIRTH_DATE_REQUIRED" },
    );
  }

  const parsedBirthDate = new Date(birthDate);
  if (Number.isNaN(parsedBirthDate.getTime())) {
    throw new AppError(
      "The animal birth date is invalid. Please correct it before recording AI.",
      { status: 400, code: "INVALID_BIRTH_DATE" },
    );
  }

  if (parsedEventDate.getTime() < parsedBirthDate.getTime()) {
    throw new AppError("AI service date cannot be before the animal's birth date.", {
      status: 400,
      code: "PREVIOUS_AI_BEFORE_BIRTH",
    });
  }

  const breedingAge = checkInseminationAgeEligibility(
    parsedBirthDate,
    species,
    parsedEventDate,
  );
  if (!breedingAge.isEligible) {
    throw new AppError(
      "The insemination date is earlier than this animal's minimum breeding age.",
      { status: 400, code: "PREVIOUS_AI_BELOW_BREEDING_AGE" },
    );
  }

  return parsedEventDate;
};

export const assertPreviousAICanContinueTracking = ({
  eventDate,
  now = new Date(),
  species,
  breed,
}) => {
  const { avgGestationDays } = getBreedProfile(species, breed);
  const trackingEndDate = new Date(eventDate);
  trackingEndDate.setUTCDate(
    trackingEndDate.getUTCDate() + avgGestationDays,
  );

  if (new Date(now).getTime() > trackingEndDate.getTime()) {
    throw new AppError(
      "This AI date is beyond the current reproductive tracking window. Save it as History Only instead.",
      {
        status: 409,
        code: "PREVIOUS_AI_TRACKING_WINDOW_CLOSED",
        details: { trackingEndDate, avgGestationDays },
      },
    );
  }

  return { trackingEndDate, avgGestationDays };
};

export const assertAIRecordSupportsCurrentTracking = (record) => {
  if (!isHistoryOnlyAIRecord(record)) return record;

  throw new AppError(
    "History-only AI records cannot be used to change the current reproductive cycle.",
    { status: 409, code: "HISTORICAL_AI_NOT_TRACKABLE" },
  );
};
