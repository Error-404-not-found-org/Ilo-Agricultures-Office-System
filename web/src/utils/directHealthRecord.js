export const DIRECT_HEALTH_SERVICE_TYPES = [
  { value: "disease", label: "Disease Control" },
  { value: "medicine", label: "Medicine/Supplies" },
  { value: "checkup", label: "Routine Checkup" },
  { value: "injury", label: "Injury Treatment" },
  { value: "vaccination", label: "Vaccination" },
  { value: "deworming", label: "Deworming" },
  { value: "other", label: "Other Veterinary" },
];

export const medicalRecordTypeForHealthService = (serviceType) => {
  if (serviceType === "vaccination") return "Vaccination";
  if (serviceType === "deworming") return "Deworming";
  if (["medicine", "injury"].includes(serviceType)) return "Treatment";
  return "Check-up";
};

export const formatDirectHealthDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const buildDirectHealthRecordPayload = ({
  animalId,
  serviceType,
  serviceDate,
  diagnosis,
  treatment,
  medicineGiven,
  dosage,
  withdrawalPeriodDays,
  advice,
  resolutionNotes,
  followUpDate,
}) => ({
  animalId,
  type: medicalRecordTypeForHealthService(serviceType),
  serviceDate,
  details: {
    serviceType,
    diagnosis,
    treatment,
    medicineName: medicineGiven || undefined,
    dosage: dosage || undefined,
    withdrawalPeriodDays,
    advice: advice || undefined,
  },
  withdrawalPeriodDays,
  note: resolutionNotes || undefined,
  followUpDate: followUpDate || undefined,
});
