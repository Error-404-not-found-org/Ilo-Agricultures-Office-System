const LEGACY_PREGNANCY_DIAGNOSIS_DAYS = 60;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export const getPregnancyReadinessFallback = (
  inseminationDate,
  at = new Date(),
) => {
  const aiDate = inseminationDate ? new Date(inseminationDate) : null;
  const checkedAt = at instanceof Date ? at : new Date(at);
  if (
    !aiDate ||
    Number.isNaN(aiDate.getTime()) ||
    Number.isNaN(checkedAt.getTime())
  ) {
    return {
      isEligible: false,
      daysPostAI: null,
      minimumDays: LEGACY_PREGNANCY_DIAGNOSIS_DAYS,
      policyMode: "legacy",
      reason: "The completed AI service date is missing or invalid.",
    };
  }

  const daysPostAI = Math.floor(
    (checkedAt.getTime() - aiDate.getTime()) / MILLISECONDS_PER_DAY,
  );
  if (daysPostAI < 0) {
    return {
      isEligible: false,
      daysPostAI,
      minimumDays: LEGACY_PREGNANCY_DIAGNOSIS_DAYS,
      policyMode: "legacy",
      reason:
        "Pregnancy diagnosis is unavailable because the AI service date is in the future.",
    };
  }

  const isEligible = daysPostAI >= LEGACY_PREGNANCY_DIAGNOSIS_DAYS;
  return {
    isEligible,
    daysPostAI,
    minimumDays: LEGACY_PREGNANCY_DIAGNOSIS_DAYS,
    policyMode: "legacy",
    reason: isEligible
      ? "Pregnancy check is available."
      : `Pregnancy diagnosis is not yet available. This animal is ${daysPostAI} days post-AI.`,
  };
};
