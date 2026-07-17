export const isPregnancyCycleActive = (pregnancy, hasCalvingRecord = false) => Boolean(
  pregnancy &&
  pregnancy.pregnancyDiagnosis?.result === "Pregnant" &&
  !["completed", "lost"].includes(pregnancy.cycleStatus) &&
  !hasCalvingRecord
);
