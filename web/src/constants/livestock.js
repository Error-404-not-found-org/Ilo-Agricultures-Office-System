export const REPRODUCTIVE_STATUSES = [
  "Normal",
  "Pregnant",
  "In Heat",
  "Inseminated",
  "Open",
];

export const HEALTH_REQUEST_TYPES = [
  "disease",
  "medicine",
  "checkup",
  "injury",
  "vaccination",
  "deworming",
  "other",
];

export const HEALTH_REQUEST_LABELS = {
  disease: "Disease Control",
  medicine: "Medicine/Supplies",
  checkup: "Routine Checkup",
  injury: "Injury Treatment",
  vaccination: "Vaccination",
  deworming: "Deworming",
  other: "Other Veterinary",
};

export const URGENCY_LEVELS = [
  { value: "low", label: "Low", color: "emerald" },
  { value: "medium", label: "Medium", color: "amber" },
  { value: "high", label: "High", color: "rose" },
];

export const INSEMINATION_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "done",
  "cancelled",
];
