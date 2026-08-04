import { AppError } from "../utils/app-error.js";

export const LEGACY_PREGNANCY_POLICY_VERSION = "legacy-day-60";
export const LEGACY_PREGNANCY_DIAGNOSIS_DAYS = 60;

export const PREGNANCY_METHOD_CODES = Object.freeze([
  "blood_pag",
  "milk_pag",
  "ultrasound",
  "rectal_palpation",
  "clinical_examination",
  "other_approved",
]);

export const PREGNANCY_DIAGNOSIS_RESULTS = Object.freeze([
  "Pregnant",
  "Empty",
]);

const METHOD_CODE_SET = new Set(PREGNANCY_METHOD_CODES);
const RESULT_SET = new Set(PREGNANCY_DIAGNOSIS_RESULTS);

const policyError = (message, details = undefined) =>
  new AppError(message, {
    status: 422,
    code: "INVALID_PREGNANCY_POLICY",
    details,
  });

const validateThreshold = (value, field) => {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value) || value < 0) {
    throw policyError(`${field} must be a non-negative whole number or null.`);
  }
  return value;
};

const normalizeSpeciesOverrides = (overrides, methodCode) => {
  if (overrides === undefined) return {};
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
    throw policyError(`Species overrides for ${methodCode} must be an object.`);
  }

  return Object.fromEntries(
    Object.entries(overrides).map(([species, override]) => {
      if (!species.trim() || !override || typeof override !== "object" || Array.isArray(override)) {
        throw policyError(`Invalid species override for ${methodCode}.`);
      }
      return [
        species,
        {
          ...override,
          earliestDaysPostAI: validateThreshold(
            override.earliestDaysPostAI,
            `${methodCode}.${species}.earliestDaysPostAI`,
          ),
        },
      ];
    }),
  );
};

export const validatePregnancyConfirmationPolicy = (policy) => {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    throw policyError("Pregnancy confirmation policy must be an object.");
  }
  if (!String(policy.version || "").trim()) {
    throw policyError("Pregnancy confirmation policy version is required.");
  }

  const effectiveFrom = new Date(policy.effectiveFrom);
  if (!policy.effectiveFrom || Number.isNaN(effectiveFrom.getTime())) {
    throw policyError("Pregnancy confirmation policy effectiveFrom must be a valid date.");
  }
  if (typeof policy.enabled !== "boolean") {
    throw policyError("Pregnancy confirmation policy enabled must be a boolean.");
  }

  const continuationRecheckDaysPostAI = validateThreshold(
    policy.continuationRecheckDaysPostAI,
    "continuationRecheckDaysPostAI",
  );
  if (continuationRecheckDaysPostAI === null) {
    throw policyError("A continuation recheck milestone is required.");
  }
  if (!Array.isArray(policy.methods)) {
    throw policyError("Pregnancy confirmation policy methods must be an array.");
  }

  const seen = new Set();
  const methods = policy.methods.map((method) => {
    if (!method || typeof method !== "object" || Array.isArray(method)) {
      throw policyError("Each pregnancy confirmation method must be an object.");
    }
    const methodCode = String(method.methodCode || "").trim();
    if (!METHOD_CODE_SET.has(methodCode)) {
      throw policyError(`Unknown pregnancy confirmation method: ${methodCode || "(missing)"}.`);
    }
    if (seen.has(methodCode)) {
      throw policyError(`Duplicate pregnancy confirmation method: ${methodCode}.`);
    }
    seen.add(methodCode);
    if (!String(method.label || "").trim()) {
      throw policyError(`A label is required for ${methodCode}.`);
    }
    if (typeof method.enabled !== "boolean") {
      throw policyError(`The enabled flag for ${methodCode} must be boolean.`);
    }

    const earliestDaysPostAI = validateThreshold(
      method.earliestDaysPostAI,
      `${methodCode}.earliestDaysPostAI`,
    );
    if (method.enabled && earliestDaysPostAI === null) {
      throw policyError(`Enabled method ${methodCode} requires an approved threshold.`);
    }
    if (!Array.isArray(method.acceptedResults) || method.acceptedResults.length === 0) {
      throw policyError(`Accepted result values are required for ${methodCode}.`);
    }
    const acceptedResults = [...new Set(method.acceptedResults.map(String))];
    const invalidResult = acceptedResults.find((result) => !RESULT_SET.has(result));
    if (invalidResult) {
      throw policyError(`Invalid pregnancy result ${invalidResult} for ${methodCode}.`);
    }
    for (const field of [
      "technicianDiagnosisMayConfirm",
      "acceptedExternalEvidenceMayConfirm",
      "continuationRecheckRequired",
    ]) {
      if (typeof method[field] !== "boolean") {
        throw policyError(`${methodCode}.${field} must be boolean.`);
      }
    }
    const speciesOverrides = normalizeSpeciesOverrides(
      method.speciesOverrides,
      methodCode,
    );

    return {
      ...method,
      methodCode,
      label: method.label.trim(),
      earliestDaysPostAI,
      acceptedResults,
      speciesOverrides,
    };
  });

  return {
    ...policy,
    version: String(policy.version).trim(),
    effectiveFrom: effectiveFrom.toISOString(),
    continuationRecheckDaysPostAI,
    methods,
  };
};

export const resolvePregnancyConfirmationPolicy = ({ policy, at = new Date() } = {}) => {
  if (!policy) return { mode: "legacy_day_60", policy: null, validationError: null };

  try {
    const validated = validatePregnancyConfirmationPolicy(policy);
    const effectiveAt = at instanceof Date ? at : new Date(at);
    const hasApprovedMethod = validated.methods.some(
      (method) => method.enabled && method.earliestDaysPostAI !== null,
    );
    if (
      !validated.enabled ||
      !hasApprovedMethod ||
      Number.isNaN(effectiveAt.getTime()) ||
      new Date(validated.effectiveFrom).getTime() > effectiveAt.getTime()
    ) {
      return { mode: "legacy_day_60", policy: validated, validationError: null };
    }
    return { mode: "method_based", policy: validated, validationError: null };
  } catch (error) {
    return { mode: "legacy_day_60", policy: null, validationError: error };
  }
};

export const getMethodThresholdForSpecies = (method, species) => {
  const override = species ? method?.speciesOverrides?.[species] : null;
  return override?.earliestDaysPostAI ?? method?.earliestDaysPostAI ?? null;
};
