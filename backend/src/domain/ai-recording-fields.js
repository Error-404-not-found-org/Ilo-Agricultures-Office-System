import { AppError } from "../utils/app-error.js";

export const AI_VISIT_PERIODS = Object.freeze(["morning", "afternoon"]);
export const SIRE_BREED_MAX_LENGTH = 100;
export const SIRE_CODE_MAX_LENGTH = 64;
export const AI_SCHEDULE_TIMEZONE_OFFSET_MINUTES = 8 * 60;

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

// The new date-only scheduling operation persists the selected Philippine
// calendar day at 12:00 Asia/Manila (04:00 UTC). Noon is a neutral storage
// anchor, not an appointment time; visitPeriod remains the service window.
export const normalizeAIScheduleDate = (value, { now = new Date() } = {}) => {
  if (value === undefined || value === null || value === "") {
    throw invalidField(
      "A visit date is required before scheduling.",
      "SCHEDULE_DATE_REQUIRED",
    );
  }

  let year;
  let month;
  let day;
  if (typeof value === "string") {
    const text = value.trim();
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
    const hasValidTimestamp =
      text.length === 10 || !Number.isNaN(Date.parse(text));
    if (match && hasValidTimestamp) {
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
    }
  } else if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const manilaValue = new Date(
      value.getTime() + AI_SCHEDULE_TIMEZONE_OFFSET_MINUTES * 60 * 1000,
    );
    year = manilaValue.getUTCFullYear();
    month = manilaValue.getUTCMonth() + 1;
    day = manilaValue.getUTCDate();
  }

  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day
  ) {
    throw invalidField("Visit date is invalid.", "INVALID_SCHEDULE_DATE");
  }

  const manilaNow = new Date(
    now.getTime() + AI_SCHEDULE_TIMEZONE_OFFSET_MINUTES * 60 * 1000,
  );
  const selectedDay = Date.UTC(year, month - 1, day);
  const today = Date.UTC(
    manilaNow.getUTCFullYear(),
    manilaNow.getUTCMonth(),
    manilaNow.getUTCDate(),
  );
  if (selectedDay < today) {
    throw invalidField(
      "Visit date cannot be in the past.",
      "SCHEDULE_DATE_IN_PAST",
    );
  }

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      12 - AI_SCHEDULE_TIMEZONE_OFFSET_MINUTES / 60,
    ),
  );
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
