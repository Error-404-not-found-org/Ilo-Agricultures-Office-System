export const HEAT_RETURN_MONITORING_POLICY = {
  observationWindowStartDays: 18,
  expectedEstrousCycleDays: 21,
  technicianFollowUpDays: 25,
  pregnancyDiagnosisDueDays: 60,
  pregnancyDiagnosisOverdueDays: 75,
};

export const getHeatReturnMonitoringDates = (inseminationDate) => {
  const start = new Date(inseminationDate);
  const observationWindowStartDate = new Date(start);
  observationWindowStartDate.setUTCDate(
    observationWindowStartDate.getUTCDate() + HEAT_RETURN_MONITORING_POLICY.observationWindowStartDays
  );

  const expectedEstrousCycleDate = new Date(start);
  expectedEstrousCycleDate.setUTCDate(
    expectedEstrousCycleDate.getUTCDate() + HEAT_RETURN_MONITORING_POLICY.expectedEstrousCycleDays
  );

  const technicianFollowUpDate = new Date(start);
  technicianFollowUpDate.setUTCDate(
    technicianFollowUpDate.getUTCDate() + HEAT_RETURN_MONITORING_POLICY.technicianFollowUpDays
  );

  const pregnancyDiagnosisDueDate = new Date(start);
  pregnancyDiagnosisDueDate.setUTCDate(
    pregnancyDiagnosisDueDate.getUTCDate() +
      HEAT_RETURN_MONITORING_POLICY.pregnancyDiagnosisDueDays,
  );

  const pregnancyDiagnosisOverdueDate = new Date(start);
  pregnancyDiagnosisOverdueDate.setUTCDate(
    pregnancyDiagnosisOverdueDate.getUTCDate() +
      HEAT_RETURN_MONITORING_POLICY.pregnancyDiagnosisOverdueDays,
  );

  return {
    observationWindowStartDate,
    expectedEstrousCycleDate,
    technicianFollowUpDate,
    pregnancyDiagnosisDueDate,
    pregnancyDiagnosisOverdueDate,
  };
};

export const isTerminalAIAttempt = (ins) => {
  if (!ins) return true; // Treat missing as terminal
  if (ins.status === "cancelled" || ins.status === "rejected") return true;

  if (ins.status === "done") {
    // Conclusive boolean success flags
    if (ins.isSuccess === true || ins.isSuccess === false) return true;

    // Verified conclusive outcomes
    if (ins.outcomeVerificationStatus === "verified") {
      const outcomeStr = String(ins.outcome || "");
      if (
        outcomeStr === "Failed (Re-heat)" ||
        outcomeStr === "Failed (Negative PD)" ||
        outcomeStr === "Failed (Aborted)" ||
        outcomeStr === "Pregnant"
      ) {
        return true;
      }
    }
  }

  return false;
};
