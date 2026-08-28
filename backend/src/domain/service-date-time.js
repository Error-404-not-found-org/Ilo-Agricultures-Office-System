import { AppError } from "../utils/app-error.js";

const MANILA_OFFSET = "+08:00";

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
