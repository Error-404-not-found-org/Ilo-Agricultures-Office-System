const NOT_RECORDED = "Not recorded";

const cleanText = (value: unknown) => {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const text = String(value).trim();
  return text &&
    !["null", "undefined", "n/a", "na"].includes(text.toLowerCase())
    ? text
    : "";
};

export const formatAIRecordValue = (value: unknown, fallback = NOT_RECORDED) =>
  cleanText(value) || fallback;

export const formatAIRecordLabel = (
  value: unknown,
  fallback = NOT_RECORDED,
) => {
  const text = cleanText(value);
  if (!text) return fallback;
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const formatDate = (value: unknown, includeTime: boolean) => {
  const date = value ? new Date(String(value)) : null;
  if (!date || Number.isNaN(date.getTime())) return NOT_RECORDED;

  const dateText = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);

  if (!includeTime) return dateText;

  const timeText = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${dateText} • ${timeText}`;
};

const getPersonName = (value: unknown) => {
  if (!value || typeof value !== "object") return "";
  return (
    cleanText((value as { name?: unknown; fullName?: unknown }).name) ||
    cleanText((value as { fullName?: unknown }).fullName)
  );
};

const getAnimal = (record: any, fallbackAnimal?: any) =>
  record?.animalId && typeof record.animalId === "object"
    ? record.animalId
    : fallbackAnimal || {};

export type AIRecordDisplayData = {
  earTag: string;
  species: string;
  breed: string;
  actualInsemination: string;
  estrus: string;
  sireBreed: string;
  sireCode: string;
  semenDosesUsed: string;
  technician: string;
  attempt: string;
  scheduledVisit: string | null;
  breedingOutcome: string;
  breedingOutcomePending: boolean;
  technicianNote: string;
};

export const getAIRecordDisplayData = (
  record: any,
  fallbackAnimal?: any,
): AIRecordDisplayData => {
  const animal = getAnimal(record, fallbackAnimal);
  const technician =
    getPersonName(record?.technicianId) || getPersonName(record?.approvedBy);
  const rawOutcome = cleanText(record?.outcome);
  const breedingOutcomePending =
    !rawOutcome || rawOutcome.toLowerCase() === "pending";
  const scheduledDate = cleanText(record?.scheduledDate);
  const visitPeriod = cleanText(record?.visitPeriod);
  const doses = Number(record?.semenDosesUsed);
  const attempt = Number(record?.attemptNumber);

  return {
    earTag: formatAIRecordValue(animal?.earTag || animal?.animalId),
    species: formatAIRecordLabel(animal?.species),
    breed: formatAIRecordLabel(animal?.breed),
    // The procedure timestamp is authoritative. createdAt is deliberately not
    // used because it represents persistence, not when insemination occurred.
    actualInsemination: formatDate(record?.inseminationDate, true),
    estrus: formatAIRecordLabel(record?.estrus),
    sireBreed: formatAIRecordLabel(record?.sireBreed),
    sireCode: formatAIRecordValue(record?.sireCode),
    semenDosesUsed:
      Number.isSafeInteger(doses) && doses >= 1 ? String(doses) : NOT_RECORDED,
    technician: technician || NOT_RECORDED,
    attempt:
      Number.isSafeInteger(attempt) && attempt >= 1
        ? `#${attempt}`
        : NOT_RECORDED,
    scheduledVisit: scheduledDate
      ? `${formatDate(scheduledDate, false)}${
          visitPeriod ? ` • ${formatAIRecordLabel(visitPeriod, "")}` : ""
        }`
      : null,
    breedingOutcome: breedingOutcomePending
      ? "Pending confirmation"
      : formatAIRecordLabel(rawOutcome),
    breedingOutcomePending,
    technicianNote: cleanText(record?.technicianNote),
  };
};
