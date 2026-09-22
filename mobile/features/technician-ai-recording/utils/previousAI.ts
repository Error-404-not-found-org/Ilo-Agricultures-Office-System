import { getBreedProfile } from "../../../lib/cattleCore.ts";
import type {
  DirectInseminationPayload,
  PreviousAIEntryMode,
  PreviousInseminationPayload,
} from "../types/technicianAIRecording.types";

const startOfLocalDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate());

const addCalendarMonthsClamped = (value: Date, months: number) => {
  const result = startOfLocalDay(value);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
};

export const parsePreviousAIBirthDate = (value?: string | null) => {
  if (!value) return null;
  const calendar = value.slice(0, 10).split("-").map(Number);
  if (calendar.length !== 3 || calendar.some(Number.isNaN)) return null;
  const parsed = new Date(calendar[0], calendar[1] - 1, calendar[2]);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== calendar[0] ||
    parsed.getMonth() !== calendar[1] - 1 ||
    parsed.getDate() !== calendar[2]
  ) {
    return null;
  }
  return parsed;
};

export const getPreviousAIDateBounds = (
  birthDate?: string | null,
  species?: string | null,
  breed?: string | null,
  now = new Date(),
) => {
  const parsedBirthDate = parsePreviousAIBirthDate(birthDate);
  const profile = getBreedProfile(species || "Cattle", breed || undefined);

  return {
    minimumDate: parsedBirthDate
      ? addCalendarMonthsClamped(
          parsedBirthDate,
          profile.minBreedingAgeMonths,
        )
      : null,
    maximumDate: startOfLocalDay(now),
  };
};

export const validatePreviousAIDate = (
  serviceDate: Date,
  birthDate?: string | null,
  species?: string | null,
  breed?: string | null,
  now = new Date(),
) => {
  const selected = startOfLocalDay(serviceDate);
  const { minimumDate, maximumDate } = getPreviousAIDateBounds(
    birthDate,
    species,
    breed,
    now,
  );
  if (selected > maximumDate) {
    return "Previous AI date cannot be in the future.";
  }
  if (minimumDate && selected < minimumDate) {
    return "The insemination date is earlier than this animal's minimum breeding age.";
  }
  return null;
};

export const buildPreviousInseminationPayload = (
  payload: DirectInseminationPayload,
  entryMode: PreviousAIEntryMode,
): PreviousInseminationPayload => ({ ...payload, entryMode });

const PREVIOUS_AI_ERROR_MESSAGES: Record<string, string> = {
  PREVIOUS_AI_TRACKING_WINDOW_CLOSED:
    "This insemination date is outside the active tracking window. Save it as History Only instead.",
  PREVIOUS_AI_TRACKING_SUPERSEDED:
    "A newer reproductive event already defines the current cycle. Save this AI as History Only instead.",
  PREVIOUS_AI_TRACKING_ACTIVE_PREGNANCY:
    "This animal already has an active pregnancy defining its current cycle. Save this AI as History Only instead.",
};

export const getPreviousAIErrorMessage = (error: any) => {
  const code = String(error?.response?.data?.code || "");
  return String(
    PREVIOUS_AI_ERROR_MESSAGES[code] ||
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      "The previous AI record could not be saved. Please try again.",
  );
};
