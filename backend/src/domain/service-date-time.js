import { AppError } from "../utils/app-error.js";

const MANILA_OFFSET = "+08:00";
export const MANILA_TIME_ZONE = "Asia/Manila";
export const MANILA_OFFSET_HOURS = 8;
export const MANILA_OFFSET_MS = MANILA_OFFSET_HOURS * 60 * 60 * 1000;
export const CALENDAR_DAY_MS = 24 * 60 * 60 * 1000;

export const toManilaCalendarDay = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
      return Date.UTC(
        Number(dateMatch[1]),
        Number(dateMatch[2]) - 1,
        Number(dateMatch[3]),
      );
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const manilaDate = new Date(date.getTime() + MANILA_OFFSET_MS);
  return Date.UTC(
    manilaDate.getUTCFullYear(),
    manilaDate.getUTCMonth(),
    manilaDate.getUTCDate(),
  );
};

export const differenceInManilaCalendarDays = (later, earlier) => {
  const laterDay = toManilaCalendarDay(later);
  const earlierDay = toManilaCalendarDay(earlier);
  if (laterDay === null || earlierDay === null) return null;
  return Math.floor((laterDay - earlierDay) / CALENDAR_DAY_MS);
};

export const toManilaDateKey = (value) => {
  const dayUtc = toManilaCalendarDay(value);
  if (dayUtc === null) return null;
  const d = new Date(dayUtc);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const manilaTimeKey = (value) => {
  const parts = new Intl.DateTimeFormat("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Manila",
  }).formatToParts(value);
  const part = (type) =>
    parts.find((candidate) => candidate.type === type)?.value || "";
  return `${part("hour")}:${part("minute")}`;
};

export const combineManilaServiceDateTime = ({
  date,
  time,
  fallback = new Date(),
}) => {
  if (!date) return new Date(fallback);
  if (!time && (date instanceof Date || String(date).includes("T"))) {
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const dateKey = String(date).match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  const timeMatch = String(time || manilaTimeKey(new Date(fallback))).match(
    /^([01]\d|2[0-3]):([0-5]\d)$/,
  );
  if (!dateKey || !timeMatch) {
    throw new AppError("A valid AI service date and time are required.", {
      status: 400,
      code: "INVALID_AI_SERVICE_DATETIME",
    });
  }

  const timestamp = new Date(
    `${dateKey}T${timeMatch[1]}:${timeMatch[2]}:00${MANILA_OFFSET}`,
  );
  if (Number.isNaN(timestamp.getTime())) {
    throw new AppError("A valid AI service date and time are required.", {
      status: 400,
      code: "INVALID_AI_SERVICE_DATETIME",
    });
  }
  return timestamp;
};
