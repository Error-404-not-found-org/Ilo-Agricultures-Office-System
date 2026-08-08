import { AppError } from "../utils/app-error.js";
import {
  VISIT_PERIODS as AI_VISIT_PERIODS,
  VISIT_SCHEDULE_TIMEZONE_OFFSET_MINUTES as AI_SCHEDULE_TIMEZONE_OFFSET_MINUTES,
  normalizeVisitPeriod,
  normalizeVisitScheduleDate as normalizeAIScheduleDate,
} from "./visit-scheduling.js";

export {
  AI_VISIT_PERIODS,
  AI_SCHEDULE_TIMEZONE_OFFSET_MINUTES,
  normalizeVisitPeriod,
  normalizeAIScheduleDate,
};

export const SIRE_BREED_MAX_LENGTH = 100;
export const SIRE_CODE_MAX_LENGTH = 64;
export const AI_TECHNICIAN_NOTE_MAX_LENGTH = 2000;

const invalidField = (message, code) =>
  new AppError(message, { status: 400, code });

const normalizeManualText = (
  value,
  { label, required, maxLength, requiredCode, lengthCode },
) => {
  if (value === undefined || value === null) {
    if (!required) return undefined;
    throw invalidField(`${label} is required.`, requiredCode);
  }
  if (typeof value !== "string") {
    throw invalidField(`${label} must be text.`, requiredCode);
  }

  const normalized = value.trim();
  if (!normalized) {
    if (!required) return undefined;
    throw invalidField(`${label} is required.`, requiredCode);
  }
  if (normalized.length > maxLength) {
    throw invalidField(
      `${label} must be ${maxLength} characters or less.`,
      lengthCode,
    );
  }
  return normalized;
};

export const normalizeSireBreed = (value, { required = false } = {}) =>
  normalizeManualText(value, {
    label: "Sire breed",
    required,
    maxLength: SIRE_BREED_MAX_LENGTH,
    requiredCode: "SIRE_BREED_REQUIRED",
    lengthCode: "SIRE_BREED_TOO_LONG",
  });

export const normalizeSireCode = (value, { required = false } = {}) =>
  normalizeManualText(value, {
    label: "Sire code",
    required,
    maxLength: SIRE_CODE_MAX_LENGTH,
    requiredCode: "SIRE_CODE_REQUIRED",
    lengthCode: "SIRE_CODE_TOO_LONG",
  });

export const normalizeTechnicianNote = (value) =>
  normalizeManualText(value, {
    label: "Technician note",
    required: false,
    maxLength: AI_TECHNICIAN_NOTE_MAX_LENGTH,
    requiredCode: "INVALID_TECHNICIAN_NOTE",
    lengthCode: "TECHNICIAN_NOTE_TOO_LONG",
  });

export const normalizeTechnicianNoteInput = (source = {}) => {
  for (const alias of ["technicianNote", "technicianNotes", "notes"]) {
    if (Object.hasOwn(source, alias) && source[alias] !== undefined) {
      return normalizeTechnicianNote(source[alias]);
    }
  }
  return undefined;
};

export const normalizeSemenDosesUsed = (
  value,
  { defaultWhenOmitted = false } = {},
) => {
  if (value === undefined || value === null) {
    return defaultWhenOmitted ? 1 : undefined;
  }

  let normalized;
  if (typeof value === "number") {
    normalized = value;
  } else if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    normalized = Number(value.trim());
  } else {
    throw invalidField(
      "Number of semen doses used must be a whole number of at least 1.",
      "INVALID_SEMEN_DOSES_USED",
    );
  }

  if (!Number.isSafeInteger(normalized) || normalized < 1) {
    throw invalidField(
      "Number of semen doses used must be a whole number of at least 1.",
      "INVALID_SEMEN_DOSES_USED",
    );
  }
  return normalized;
};

export const normalizeAICompletionFields = ({
  sireBreed,
  sireCode,
  semenDosesUsed,
}) => ({
  sireBreed: normalizeSireBreed(sireBreed, { required: true }),
  sireCode: normalizeSireCode(sireCode, { required: true }),
  semenDosesUsed: normalizeSemenDosesUsed(semenDosesUsed, {
    defaultWhenOmitted: true,
  }),
});
