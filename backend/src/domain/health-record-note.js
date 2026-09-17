export const LEGACY_SYNTHETIC_HEALTH_NOTE =
  "Resolved through health request queue.";

export const normalizeHealthRecordNote = (value) => {
  if (typeof value !== "string") return undefined;
  const note = value.trim();
  if (!note || note === LEGACY_SYNTHETIC_HEALTH_NOTE) return undefined;
  return note;
};

export const firstGenuineHealthRecordNote = (...values) =>
  values.map(normalizeHealthRecordNote).find(Boolean);
