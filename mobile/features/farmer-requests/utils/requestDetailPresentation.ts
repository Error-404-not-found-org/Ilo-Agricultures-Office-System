const EMPTY_REQUEST_VALUES = new Set([
  "",
  "-",
  "--",
  "n/a",
  "n.a.",
  "na",
  "none",
  "null",
  "undefined",
  "not available",
  "not applicable",
  "not provided",
  "unknown",
]);

export const getRequestText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();
  if (EMPTY_REQUEST_VALUES.has(text.toLowerCase())) return null;

  return text;
};

export const hasRequestValue = (value: unknown) =>
  getRequestText(value) !== null;

export const getRequestList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map(getRequestText)
    .filter((item): item is string => item !== null);
};

export const formatRequestDateTime = (
  value: unknown,
  formatter: (date: Date) => string,
): string | null => {
  const text = getRequestText(value);
  if (!text) return null;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;

  return formatter(date);
};
