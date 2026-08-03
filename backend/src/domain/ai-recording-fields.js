import { AppError } from "../utils/app-error.js";

export const AI_VISIT_PERIODS = Object.freeze(["morning", "afternoon"]);
export const SIRE_BREED_MAX_LENGTH = 100;
export const SIRE_CODE_MAX_LENGTH = 64;

const invalidField = (message, code) =>
  new AppError(message, { status: 400, code });

export const normalizeVisitPeriod = (value) => {
  if (value === undefined || value === null) return undefined;

  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!AI_VISIT_PERIODS.includes(normalized)) {
    throw invalidField(
      "Visit period must be morning or afternoon.",
      "INVALID_VISIT_PERIOD",
    );
  }
  return normalized;
};

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
