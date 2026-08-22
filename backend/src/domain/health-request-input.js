import { CANONICAL_HEALTH_REQUEST_TYPE } from "./health-request-vocabulary.js";
import { AppError } from "../utils/app-error.js";

export const HEALTH_REQUEST_DETAILS_VERSION = 1;
export const HEALTH_REQUEST_DESCRIPTION_MAX_LENGTH = 2000;

export const HEALTH_OBSERVED_SIGN = Object.freeze({
  DIARRHEA: "diarrhea",
  NOT_EATING_NORMALLY: "not_eating_normally",
  WEAKNESS: "weakness",
  FEVER: "fever",
  COUGHING_OR_BREATHING_PROBLEM: "coughing_or_breathing_problem",
  NASAL_DISCHARGE: "nasal_discharge",
  ABNORMAL_BEHAVIOR: "abnormal_behavior",
  SWELLING: "swelling",
  WOUND_OR_INJURY: "wound_or_injury",
  DIFFICULTY_STANDING_OR_WALKING: "difficulty_standing_or_walking",
  PREGNANCY_RELATED_CONCERN: "pregnancy_related_concern",
  OTHER: "other",
});

export const HEALTH_OBSERVED_SIGN_LABEL = Object.freeze({
  [HEALTH_OBSERVED_SIGN.DIARRHEA]: "Diarrhea",
  [HEALTH_OBSERVED_SIGN.NOT_EATING_NORMALLY]: "Not eating normally",
  [HEALTH_OBSERVED_SIGN.WEAKNESS]: "Weak / low energy",
  [HEALTH_OBSERVED_SIGN.FEVER]: "Fever / feels unusually hot",
  [HEALTH_OBSERVED_SIGN.COUGHING_OR_BREATHING_PROBLEM]:
    "Coughing / breathing problem",
  [HEALTH_OBSERVED_SIGN.NASAL_DISCHARGE]: "Nasal discharge",
  [HEALTH_OBSERVED_SIGN.ABNORMAL_BEHAVIOR]: "Unusual behavior",
  [HEALTH_OBSERVED_SIGN.SWELLING]: "Swelling",
  [HEALTH_OBSERVED_SIGN.WOUND_OR_INJURY]: "Wound / injury",
  [HEALTH_OBSERVED_SIGN.DIFFICULTY_STANDING_OR_WALKING]:
    "Difficulty standing or walking",
  [HEALTH_OBSERVED_SIGN.PREGNANCY_RELATED_CONCERN]:
    "Pregnancy-related concern",
  [HEALTH_OBSERVED_SIGN.OTHER]: "Other",
});

export const HEALTH_ASSISTANCE_LABEL = Object.freeze({
  [CANONICAL_HEALTH_REQUEST_TYPE.HEALTH_CONCERN]: "Health concern",
  [CANONICAL_HEALTH_REQUEST_TYPE.MEDICINE_REQUEST]:
    "Medicine or dewormer",
  [CANONICAL_HEALTH_REQUEST_TYPE.PREVENTIVE_CARE]: "Preventive care",
  [CANONICAL_HEALTH_REQUEST_TYPE.OTHER]: "Other health assistance",
});

const LEGACY_REQUEST_TYPE_BY_ASSISTANCE = Object.freeze({
  [CANONICAL_HEALTH_REQUEST_TYPE.HEALTH_CONCERN]: "disease",
  [CANONICAL_HEALTH_REQUEST_TYPE.MEDICINE_REQUEST]: "medicine",
  [CANONICAL_HEALTH_REQUEST_TYPE.PREVENTIVE_CARE]: "checkup",
  [CANONICAL_HEALTH_REQUEST_TYPE.OTHER]: "other",
});

const cleanText = (value) =>
  typeof value === "string" ? value.trim() : "";

export const legacyRequestTypeForAssistance = (assistanceRequested) =>
  LEGACY_REQUEST_TYPE_BY_ASSISTANCE[assistanceRequested] || "other";

export const normalizeHealthRequestDetails = (
  requestDetails,
  { legacyFarmerNotes = "" } = {},
) => {
  if (requestDetails === undefined || requestDetails === null) return undefined;
  if (
    typeof requestDetails !== "object" ||
    Array.isArray(requestDetails)
  ) {
    throw new AppError("Structured Health request details must be an object.", {
      status: 400,
      code: "HEALTH_REQUEST_DETAILS_INVALID",
    });
  }
  if (requestDetails.version !== HEALTH_REQUEST_DETAILS_VERSION) {
    throw new AppError("Unsupported Health request details version.", {
      status: 400,
      code: "HEALTH_REQUEST_DETAILS_VERSION_UNSUPPORTED",
    });
  }

  const assistanceRequested = cleanText(requestDetails.assistanceRequested);
  if (!Object.values(CANONICAL_HEALTH_REQUEST_TYPE).includes(assistanceRequested)) {
    throw new AppError("Assistance requested is invalid.", {
      status: 400,
      code: "HEALTH_ASSISTANCE_REQUESTED_INVALID",
    });
  }

  const rawObservedSigns = requestDetails.observedSigns ?? [];
  if (!Array.isArray(rawObservedSigns)) {
    throw new AppError("Observed signs must be an array.", {
      status: 400,
      code: "HEALTH_OBSERVED_SIGNS_INVALID",
    });
  }
  const allowedSigns = new Set(Object.values(HEALTH_OBSERVED_SIGN));
  const observedSigns = rawObservedSigns.map(cleanText);
  if (
    observedSigns.some((sign) => !sign || !allowedSigns.has(sign)) ||
    new Set(observedSigns).size !== observedSigns.length
  ) {
    throw new AppError("Observed signs contain an invalid or duplicate value.", {
      status: 400,
      code: "HEALTH_OBSERVED_SIGNS_INVALID",
    });
  }

  const farmerDescription = cleanText(
    requestDetails.farmerDescription ?? legacyFarmerNotes,
  );
  if (farmerDescription.length > HEALTH_REQUEST_DESCRIPTION_MAX_LENGTH) {
    throw new AppError(
      `Farmer description must be ${HEALTH_REQUEST_DESCRIPTION_MAX_LENGTH} characters or fewer.`,
      { status: 400, code: "HEALTH_FARMER_DESCRIPTION_TOO_LONG" },
    );
  }

  return {
    version: HEALTH_REQUEST_DETAILS_VERSION,
    assistanceRequested,
    observedSigns,
    farmerDescription,
  };
};

export const buildLegacyHealthSymptoms = (requestDetails) => {
  const assistanceLabel =
    HEALTH_ASSISTANCE_LABEL[requestDetails.assistanceRequested] ||
    "Health assistance";
  const signLabels = requestDetails.observedSigns
    .map((sign) => HEALTH_OBSERVED_SIGN_LABEL[sign])
    .filter(Boolean);

  return [
    `Assistance requested:\n${assistanceLabel}`,
    signLabels.length
      ? `Observed signs:\n${signLabels.map((label) => `• ${label}`).join("\n")}`
      : "",
    requestDetails.farmerDescription
      ? `Description:\n${requestDetails.farmerDescription}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
};
