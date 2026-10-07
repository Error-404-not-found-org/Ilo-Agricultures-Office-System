export const buildMonthlyAccomplishmentRows = (report, barangay = "all") => {
  const headers = [
    "Record Type", "Service Date", "Animal ID", "Ear Tag", "Species", "Breed",
    "Farmer", "Barangay", "Attempt Number", "Estrus", "Sire Breed", "Sire Code",
    "Semen Doses Used", "Result / Outcome", "Diagnostic Method", "Linked AI Attempt",
    "Expected Calving Date", "Calving Ease", "Total Delivered", "Living Calves",
    "Stillborn", "Calf IDs / Ear Tags", "Technician",
  ];
  const entries = [
    ...(report?.artificialInsemination || []).map((record) => ({ type: "AI", record, date: record.serviceDate })),
    ...(report?.pregnancyDiagnosis || []).map((record) => ({ type: "PD", record, date: record.diagnosisDate })),
    ...(report?.calving || []).map((record) => ({ type: "CD", record, date: record.calvingDate })),
  ].filter(({ record }) => barangay === "all" || record.barangay?.toLowerCase() === barangay.toLowerCase());
  const rows = entries.map(({ type, record, date }) => [
    type, date ?? "", record.animalId ?? "", record.earTag ?? "", record.species ?? "", record.breed ?? "",
    record.farmerName ?? "", record.barangay ?? "",
    type === "AI" ? record.attemptNumber ?? "" : "",
    type === "AI" ? record.estrus ?? "" : "",
    type === "AI" ? record.sireBreed ?? "" : "",
    type === "AI" ? record.sireCode ?? "" : "",
    type === "AI" ? record.semenDosesUsed ?? "" : "",
    type === "PD" ? record.result ?? "" : type === "CD" || type === "AI" ? record.outcome ?? "" : "",
    type === "PD" ? record.diagnosticMethod ?? "" : "",
    type === "PD" ? record.linkedAttemptNumber ?? "" : "",
    type === "PD" ? record.expectedCalvingDate ?? "" : "",
    type === "CD" ? record.calvingEase ?? "" : "",
    type === "CD" ? record.totalDelivered ?? "" : "",
    type === "CD" ? record.livingCalfCount ?? "" : "",
    type === "CD" ? record.stillbornCount ?? "" : "",
    type === "CD" ? (record.calves || []).map((calf) => calf.earTag || calf.animalId).filter(Boolean).join(", ") : "",
    record.technicianName ?? "",
  ]);
  return { headers, rows };
};
