export const getPregnancyConfirmationMetadata = (pregnancy) => {
  if (pregnancy?.confirmation?.stage) return pregnancy.confirmation;
  return {
    methodCode: null,
    stage: "legacy_unclassified",
    confirmedAt: pregnancy?.pregnancyDiagnosis?.date || pregnancy?.createdAt || null,
    confirmedBy: null,
    policyVersion: null,
    earliestThresholdSnapshot: null,
    recheckRequired: false,
    recheckDueAt: null,
  };
};

export const withPregnancyConfirmationMetadata = (pregnancy) => ({
  ...pregnancy,
  confirmation: getPregnancyConfirmationMetadata(pregnancy),
  recheckStatus: pregnancy?.recheckStatus || "not_required",
});

