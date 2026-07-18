import { AppError } from "../utils/app-error.js";
import {
  getMethodThresholdForSpecies,
  LEGACY_PREGNANCY_DIAGNOSIS_DAYS,
  LEGACY_PREGNANCY_POLICY_VERSION,
  resolvePregnancyConfirmationPolicy,
} from "./pregnancy-confirmation-policy.js";

export const PREGNANCY_DIAGNOSIS_MINIMUM_DAYS = LEGACY_PREGNANCY_DIAGNOSIS_DAYS;
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
  policy,
  species,
}) => {
  const resolvedPolicy = resolvePregnancyConfirmationPolicy({ policy, at });
  const policyMode = resolvedPolicy.mode;
  const policyVersion = policyMode === "method_based"
    ? resolvedPolicy.policy.version
    : LEGACY_PREGNANCY_POLICY_VERSION;
  const continuationDays = policyMode === "method_based"
    ? resolvedPolicy.policy.continuationRecheckDaysPostAI
    : LEGACY_PREGNANCY_DIAGNOSIS_DAYS;
  const status = String(insemination?.status || "").trim().toLowerCase();
  if (!COMPLETED_AI_STATUSES.has(status)) {
    return {
      isEligible: false,
      code: "AI_SERVICE_NOT_COMPLETED",
      reason: "Pregnancy diagnosis requires a completed AI service.",
      daysPostAI: null,
      minimumDays: PREGNANCY_DIAGNOSIS_MINIMUM_DAYS,
      availableDate: null,
      policyVersion,
      policyMode,
      methods: [],
      earliestAvailableMethod: null,
      continuationRecheck: null,
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
      policyVersion,
      policyMode,
      methods: [],
      earliestAvailableMethod: null,
      continuationRecheck: null,
    };
  }

  const checkedAt = at instanceof Date ? at : new Date(at);
  const daysPostAI = Math.max(
    0,
    Math.floor((checkedAt.getTime() - aiDate.getTime()) / MILLISECONDS_PER_DAY),
  );
  const methodReadiness = policyMode === "method_based"
    ? resolvedPolicy.policy.methods.map((method) => {
        const earliestDaysPostAI = getMethodThresholdForSpecies(method, species);
        const availableDate = earliestDaysPostAI === null ? null : new Date(aiDate);
        availableDate?.setUTCDate(availableDate.getUTCDate() + earliestDaysPostAI);
        const isEligible = Boolean(
          method.enabled &&
          availableDate &&
          checkedAt.getTime() >= availableDate.getTime(),
        );
        const daysRemaining = method.enabled && earliestDaysPostAI !== null
          ? Math.max(0, earliestDaysPostAI - daysPostAI)
          : null;
        const reasonCode = !method.enabled || earliestDaysPostAI === null
          ? "DIAGNOSTIC_METHOD_DISABLED"
          : isEligible
            ? "METHOD_AVAILABLE"
            : "METHOD_NOT_YET_READY";
        return {
          methodCode: method.methodCode,
          label: method.label,
          enabled: method.enabled,
          isEligible,
          earliestDaysPostAI,
          availableDate: availableDate?.toISOString() || null,
          availableDateLabel: availableDate ? formatAvailableDate(availableDate) : null,
          daysRemaining,
          reasonCode,
          reason: reasonCode === "DIAGNOSTIC_METHOD_DISABLED"
            ? `${method.label} is not enabled under the active policy.`
            : isEligible
              ? `${method.label} is available.`
              : `${method.label} becomes available on ${formatAvailableDate(availableDate)}.`,
        };
      })
    : [];
  const actionableMethods = methodReadiness
    .filter((method) => method.enabled && method.availableDate)
    .sort((a, b) => new Date(a.availableDate) - new Date(b.availableDate));
  const earliestAvailableMethod = actionableMethods[0] || null;
  const legacyEligibleDate = new Date(aiDate);
  legacyEligibleDate.setUTCDate(
    legacyEligibleDate.getUTCDate() + LEGACY_PREGNANCY_DIAGNOSIS_DAYS,
  );
  const summaryAvailableDate = policyMode === "method_based"
    ? earliestAvailableMethod?.availableDate
      ? new Date(earliestAvailableMethod.availableDate)
      : null
    : legacyEligibleDate;
  const isEligible = policyMode === "method_based"
    ? methodReadiness.some((method) => method.isEligible)
    : checkedAt.getTime() >= legacyEligibleDate.getTime();
  const availableDateLabel = summaryAvailableDate
    ? formatAvailableDate(summaryAvailableDate)
    : null;
  const continuationDate = new Date(aiDate);
  continuationDate.setUTCDate(continuationDate.getUTCDate() + continuationDays);
  const continuationRecheck = {
    milestoneDaysPostAI: continuationDays,
    isEligible: checkedAt.getTime() >= continuationDate.getTime(),
    availableDate: continuationDate.toISOString(),
    availableDateLabel: formatAvailableDate(continuationDate),
    daysRemaining: Math.max(0, continuationDays - daysPostAI),
  };

  return {
    isEligible,
    code: isEligible
      ? "PREGNANCY_CHECK_AVAILABLE"
      : policyMode === "method_based"
        ? "METHOD_NOT_YET_READY"
        : "PREGNANCY_CHECK_TOO_EARLY",
    reason: isEligible
      ? "Pregnancy check is available."
      : availableDateLabel
        ? `Pregnancy check not yet available. This animal is currently ${daysPostAI} days after insemination. The pregnancy check will be available on ${availableDateLabel}.`
        : "No pregnancy confirmation method is currently enabled.",
    daysPostAI,
    minimumDays: policyMode === "method_based"
      ? earliestAvailableMethod?.earliestDaysPostAI ?? null
      : PREGNANCY_DIAGNOSIS_MINIMUM_DAYS,
    availableDate: summaryAvailableDate?.toISOString() || null,
    availableDateLabel,
    policyVersion,
    policyMode,
    methods: methodReadiness,
    earliestAvailableMethod,
    continuationRecheck,
  };
};

export const assertPregnancyDiagnosisWindow = ({
  insemination,
  diagnosisDate,
  policy,
  species,
  methodCode,
  clientPolicyVersion,
}) => {
  const readiness = getPregnancyCheckReadiness({
    insemination,
    at: diagnosisDate,
    policy,
    species,
  });
  if (readiness.policyMode === "method_based") {
    if (!methodCode) {
      throw new AppError("Select an approved diagnostic method.", {
        status: 422,
        code: "DIAGNOSTIC_METHOD_REQUIRED",
      });
    }
    const method = readiness.methods.find((item) => item.methodCode === methodCode);
    if (!method || !method.enabled) {
      throw new AppError("The selected diagnostic method is not enabled.", {
        status: 422,
        code: "DIAGNOSTIC_METHOD_DISABLED",
      });
    }
    if (!method.isEligible) {
      throw new AppError(method.reason, {
        status: 422,
        code: "METHOD_NOT_YET_READY",
        details: method,
      });
    }
    return {
      ...readiness,
      selectedMethod: method,
      clientPolicyVersionMatches:
        !clientPolicyVersion || clientPolicyVersion === readiness.policyVersion,
    };
  }
  if (readiness.isEligible) return { ...readiness, selectedMethod: null };

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
