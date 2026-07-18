import { AppError } from "../utils/app-error.js";

export const PREGNANCY_DIAGNOSIS_MINIMUM_DAYS = 60;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const COMPLETED_AI_STATUSES = new Set(["done", "resolved", "completed"]);

const formatAvailableDate = (date) =>
  date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export const getPregnancyCheckReadiness = ({
  insemination,
  at = new Date(),
}) => {
  const status = String(insemination?.status || "").trim().toLowerCase();
  if (!COMPLETED_AI_STATUSES.has(status)) {
    return {
      isEligible: false,
      code: "AI_SERVICE_NOT_COMPLETED",
      reason: "Pregnancy diagnosis requires a completed AI service.",
      daysPostAI: null,
      minimumDays: PREGNANCY_DIAGNOSIS_MINIMUM_DAYS,
      availableDate: null,
    };
  }

  const aiDate = insemination?.inseminationDate
    ? new Date(insemination.inseminationDate)
    : null;
  if (!aiDate || Number.isNaN(aiDate.getTime())) {
    return {
      isEligible: false,
      code: "AI_SERVICE_DATE_REQUIRED",
      reason: "The completed AI service date is missing or invalid.",
      daysPostAI: null,
      minimumDays: PREGNANCY_DIAGNOSIS_MINIMUM_DAYS,
      availableDate: null,
    };
  }

  const checkedAt = at instanceof Date ? at : new Date(at);
  const eligibleDate = new Date(aiDate);
  eligibleDate.setUTCDate(
    eligibleDate.getUTCDate() + PREGNANCY_DIAGNOSIS_MINIMUM_DAYS,
  );
  const daysPostAI = Math.max(
    0,
    Math.floor((checkedAt.getTime() - aiDate.getTime()) / MILLISECONDS_PER_DAY),
  );
  const isEligible = checkedAt.getTime() >= eligibleDate.getTime();
  const availableDateLabel = formatAvailableDate(eligibleDate);

  return {
    isEligible,
    code: isEligible ? "PREGNANCY_CHECK_AVAILABLE" : "PREGNANCY_CHECK_TOO_EARLY",
    reason: isEligible
      ? "Pregnancy check is available."
      : `Pregnancy check not yet available. This animal is currently ${daysPostAI} days after insemination. The pregnancy check will be available on ${availableDateLabel}.`,
    daysPostAI,
    minimumDays: PREGNANCY_DIAGNOSIS_MINIMUM_DAYS,
    availableDate: eligibleDate.toISOString(),
    availableDateLabel,
  };
};

export const assertPregnancyDiagnosisWindow = ({ insemination, diagnosisDate }) => {
  const readiness = getPregnancyCheckReadiness({
    insemination,
    at: diagnosisDate,
  });
  if (readiness.isEligible) return readiness;

  throw new AppError(
    readiness.code === "PREGNANCY_CHECK_TOO_EARLY"
      ? `Pregnancy diagnosis is not yet available. This animal is ${readiness.daysPostAI} days post-AI. Diagnosis is available on ${readiness.availableDateLabel}.`
      : readiness.reason,
    {
      status: readiness.code === "PREGNANCY_CHECK_TOO_EARLY" ? 422 : 409,
      code: readiness.code,
      details: {
        daysPostAI: readiness.daysPostAI,
        minimumDays: readiness.minimumDays,
        eligibleDate: readiness.availableDate,
      },
    },
  );
};
