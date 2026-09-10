export const DIRECT_HEALTH_SERVICE_TYPES = [
  { value: "disease", label: "Disease Control" },
  { value: "medicine", label: "Medicine/Supplies" },
  { value: "checkup", label: "Routine Checkup" },
  { value: "injury", label: "Injury Treatment" },
  { value: "vaccination", label: "Vaccination" },
  { value: "deworming", label: "Deworming" },
  { value: "other", label: "Other Veterinary" },
] as const;

export function medicalRecordTypeForHealthService(serviceType: string) {
  if (serviceType === "vaccination") return "Vaccination";
  if (serviceType === "deworming") return "Deworming";
  if (["medicine", "injury"].includes(serviceType)) return "Treatment";
  return "Check-up";
}

export function formatDirectHealthDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildDirectHealthRecordPayload(input: any) {
  return {
    animalId: input.animalId,
    type: medicalRecordTypeForHealthService(input.requestType),
    serviceDate: input.serviceDate,
    details: {
      serviceType: input.requestType,
      diagnosis: input.diagnosis,
      treatment: input.treatment,
      medicineName: input.medicineGiven || undefined,
      dosage: input.dosage || undefined,
      withdrawalPeriodDays: input.withdrawalPeriodDays,
      advice: input.advice || undefined,
    },
    withdrawalPeriodDays: input.withdrawalPeriodDays,
    note: input.resolutionNotes || undefined,
    followUpDate: input.followUpDate || undefined,
  };
}
