import { AppError } from "../utils/app-error.js";

export const VISIT_PERIODS = Object.freeze(["morning", "afternoon"]);
export const VISIT_SCHEDULE_TIMEZONE_OFFSET_MINUTES = 8 * 60;
const VISIT_AFTERNOON_CUTOFF_HOUR = 18;
const VISIT_MORNING_CONFIRMATION_HOUR = 10;
const VISIT_AFTERNOON_CONFIRMATION_HOUR = 15;

const invalidField = (message, code) =>
  new AppError(message, { status: 400, code });

const confirmationRequired = (message) =>
  new AppError(message, {
    status: 409,
    code: "VISIT_PERIOD_CONFIRMATION_REQUIRED",
  });

export const normalizeVisitPeriod = (value) => {
  if (value === undefined || value === null) return undefined;

  const normalized =
    typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!VISIT_PERIODS.includes(normalized)) {
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
export const normalizeVisitScheduleDate = (
  value,
  { now = new Date() } = {},
) => {
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
      value.getTime() + VISIT_SCHEDULE_TIMEZONE_OFFSET_MINUTES * 60 * 1000,
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
    now.getTime() + VISIT_SCHEDULE_TIMEZONE_OFFSET_MINUTES * 60 * 1000,
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
      12 - VISIT_SCHEDULE_TIMEZONE_OFFSET_MINUTES / 60,
    ),
  );
};

export const assertVisitDaypartAvailable = ({
  scheduledDate,
  visitPeriod,
  samePeriodConfirmed = false,
  now = new Date(),
}) => {
  if (
    !(scheduledDate instanceof Date) ||
    Number.isNaN(scheduledDate.getTime())
  ) {
    return;
  }
  if (!VISIT_PERIODS.includes(visitPeriod)) return;

  const toManilaParts = (value) => {
    const local = new Date(
      value.getTime() + VISIT_SCHEDULE_TIMEZONE_OFFSET_MINUTES * 60 * 1000,
    );
    return {
      day: Date.UTC(
        local.getUTCFullYear(),
        local.getUTCMonth(),
        local.getUTCDate(),
      ),
      hour: local.getUTCHours(),
    };
  };
  const selected = toManilaParts(scheduledDate);
  const current = toManilaParts(now);
  if (selected.day < current.day) {
    throw invalidField(
      "Visit date cannot be in the past.",
      "SCHEDULE_DATE_IN_PAST",
    );
  }
  if (selected.day !== current.day) return;

  const currentPeriod = current.hour < 12 ? "morning" : "afternoon";
  if (currentPeriod === "afternoon" && visitPeriod === "morning") {
    throw invalidField(
      "Today Morning is no longer available. Choose another visit period.",
      "VISIT_PERIOD_IN_PAST",
    );
  }

  if (
    visitPeriod === "afternoon" &&
    current.hour >= VISIT_AFTERNOON_CUTOFF_HOUR
  ) {
    throw invalidField(
      "Today Afternoon is no longer available. Choose tomorrow instead.",
      "VISIT_PERIOD_IN_PAST",
    );
  }

  const currentPeriodNeedsConfirmation =
    (visitPeriod === "morning" &&
      currentPeriod === "morning" &&
      current.hour >= VISIT_MORNING_CONFIRMATION_HOUR) ||
    (visitPeriod === "afternoon" &&
      currentPeriod === "afternoon" &&
      current.hour >= VISIT_AFTERNOON_CONFIRMATION_HOUR);
  if (currentPeriodNeedsConfirmation && samePeriodConfirmed !== true) {
    const label = visitPeriod === "morning" ? "Morning" : "Afternoon";
    throw confirmationRequired(
      `It is already Today ${label}. Confirm that you still have enough time to travel to the farm and provide the service.`,
    );
  }
};

export const getVisitCalendarDayRange = (anchorDate) => {
  if (
    !anchorDate ||
    !(anchorDate instanceof Date) ||
    Number.isNaN(anchorDate.getTime())
  ) {
    return null;
  }

  const manilaValue = new Date(
    anchorDate.getTime() + VISIT_SCHEDULE_TIMEZONE_OFFSET_MINUTES * 60 * 1000,
  );
  const year = manilaValue.getUTCFullYear();
  const month = manilaValue.getUTCMonth();
  const day = manilaValue.getUTCDate();

  const startOfDay = new Date(
    Date.UTC(year, month, day, 0 - VISIT_SCHEDULE_TIMEZONE_OFFSET_MINUTES / 60),
  );
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

  return { start: startOfDay, end: endOfDay };
};

export const hasVisitScheduleChanged = (
  currentDate,
  currentPeriod,
  targetDate,
  targetPeriod,
) => {
  const currentKey = currentDate ? currentDate.getTime() : null;
  const targetKey = targetDate ? targetDate.getTime() : null;

  if (currentKey !== targetKey) return true;
  if (currentPeriod !== targetPeriod) return true;

  return false;
};
