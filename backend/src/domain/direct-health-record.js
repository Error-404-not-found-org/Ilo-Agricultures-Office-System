export const DIRECT_HEALTH_SERVICE_TYPES = Object.freeze([
  "disease",
  "medicine",
  "checkup",
  "injury",
  "vaccination",
  "deworming",
  "other",
]);

export const medicalRecordTypeForHealthService = (serviceType) => {
  if (serviceType === "vaccination") return "Vaccination";
  if (serviceType === "deworming") return "Deworming";
  if (["medicine", "injury"].includes(serviceType)) return "Treatment";
  return "Check-up";
};

export const isDirectHealthServiceType = (value) =>
  DIRECT_HEALTH_SERVICE_TYPES.includes(value);
