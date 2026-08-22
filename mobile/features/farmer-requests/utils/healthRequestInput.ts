export const HEALTH_REQUEST_DETAILS_VERSION = 1 as const;

export type FarmerHealthAssistance =
  | "health_concern"
  | "medicine_request"
  | "preventive_care"
  | "other";

export type FarmerHealthObservedSign =
  | "diarrhea"
  | "not_eating_normally"
  | "weakness"
  | "fever"
  | "coughing_or_breathing_problem"
  | "nasal_discharge"
  | "abnormal_behavior"
  | "swelling"
  | "wound_or_injury"
  | "difficulty_standing_or_walking"
  | "pregnancy_related_concern"
  | "other";

export interface FarmerHealthRequestDetails {
  version: typeof HEALTH_REQUEST_DETAILS_VERSION;
  assistanceRequested: FarmerHealthAssistance;
  observedSigns: FarmerHealthObservedSign[];
  farmerDescription: string;
}

export const HEALTH_REQUEST_CATEGORIES: {
  value: FarmerHealthAssistance;
  label: string;
  description: string;
  legacyRequestType: "disease" | "medicine" | "checkup" | "other";
}[] = [
  {
    value: "health_concern",
    label: "Sick or Injured Animal",
    description: "Changes in eating, energy, breathing, movement, or injuries",
    legacyRequestType: "disease",
  },
  {
    value: "medicine_request",
    label: "Medicine or Dewormer",
    description: "Ask for medicine support or technician advice",
    legacyRequestType: "medicine",
  },
  {
    value: "preventive_care",
    label: "Checkup or Vaccination",
    description: "Routine checkups, vaccination, and preventive care",
    legacyRequestType: "checkup",
  },
  {
    value: "other",
    label: "Other Health Assistance",
    description: "Describe another animal health concern",
    legacyRequestType: "other",
  },
];

export const HEALTH_OBSERVED_SIGN_OPTIONS: {
  value: FarmerHealthObservedSign;
  label: string;
}[] = [
  { value: "diarrhea", label: "Diarrhea" },
  { value: "not_eating_normally", label: "Not eating normally" },
  { value: "weakness", label: "Weak / low energy" },
  { value: "fever", label: "Fever / feels unusually hot" },
  {
    value: "coughing_or_breathing_problem",
    label: "Coughing / breathing problem",
  },
  { value: "nasal_discharge", label: "Nasal discharge" },
  { value: "abnormal_behavior", label: "Unusual behavior" },
  { value: "swelling", label: "Swelling" },
  { value: "wound_or_injury", label: "Wound / injury" },
  {
    value: "difficulty_standing_or_walking",
    label: "Difficulty standing or walking",
  },
  { value: "other", label: "Other" },
];

const observedSignLabel = new Map(
  HEALTH_OBSERVED_SIGN_OPTIONS.map((option) => [option.value, option.label]),
);

const assistanceLabel = new Map(
  HEALTH_REQUEST_CATEGORIES.map((option) => [option.value, option.label]),
);

export const getLegacyRequestType = (category: FarmerHealthAssistance) =>
  HEALTH_REQUEST_CATEGORIES.find((item) => item.value === category)
    ?.legacyRequestType || "other";

export const buildStructuredHealthRequestDetails = ({
  assistanceRequested,
  observedSigns,
  farmerDescription,
  pregnancyConcern = false,
}: {
  assistanceRequested: FarmerHealthAssistance;
  observedSigns: FarmerHealthObservedSign[];
  farmerDescription: string;
  pregnancyConcern?: boolean;
}): FarmerHealthRequestDetails => ({
  version: HEALTH_REQUEST_DETAILS_VERSION,
  assistanceRequested,
  observedSigns: [
    ...(pregnancyConcern ? (["pregnancy_related_concern"] as const) : []),
    ...observedSigns,
  ].filter((value, index, values) => values.indexOf(value) === index),
  farmerDescription: farmerDescription.trim(),
});

export const buildLegacyHealthRequestDetails = (
  requestDetails: FarmerHealthRequestDetails,
) => {
  const assistanceLabel =
    HEALTH_REQUEST_CATEGORIES.find(
      (item) => item.value === requestDetails.assistanceRequested,
    )?.label || "Health assistance";
  const signLabels = requestDetails.observedSigns
    .map((sign) =>
      sign === "pregnancy_related_concern"
        ? "Pregnancy-related concern"
        : observedSignLabel.get(sign),
    )
    .filter((label): label is string => Boolean(label));

  return {
    symptoms: [
      `Assistance requested:\n${assistanceLabel}`,
      signLabels.length
        ? `Observed signs:\n${signLabels.map((label) => `• ${label}`).join("\n")}`
        : "",
      requestDetails.farmerDescription
        ? `Description:\n${requestDetails.farmerDescription}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    farmerNotes: requestDetails.farmerDescription,
  };
};

export const getHealthRequestInputValidationMessage = ({
  assistanceRequested,
  observedSigns,
  farmerDescription,
}: {
  assistanceRequested: FarmerHealthAssistance;
  observedSigns: FarmerHealthObservedSign[];
  farmerDescription: string;
}) => {
  if (
    ["health_concern", "other"].includes(assistanceRequested) &&
    observedSigns.length === 0 &&
    !farmerDescription.trim()
  ) {
    return "Please select an observed sign or add a short description.";
  }
  return null;
};

export const getStructuredHealthRequestPresentation = (request: {
  requestDetails?: Partial<FarmerHealthRequestDetails> | null;
}) => {
  const details = request.requestDetails;
  if (
    details?.version !== HEALTH_REQUEST_DETAILS_VERSION ||
    !details.assistanceRequested
  ) {
    return null;
  }

  const observedSigns = Array.isArray(details.observedSigns)
    ? details.observedSigns
        .map((sign) =>
          sign === "pregnancy_related_concern"
            ? "Pregnancy-related concern"
            : observedSignLabel.get(sign),
        )
        .filter((label): label is string => Boolean(label))
    : [];

  return {
    assistanceLabel:
      assistanceLabel.get(details.assistanceRequested) ||
      "Health assistance",
    observedSigns,
    farmerDescription:
      typeof details.farmerDescription === "string"
        ? details.farmerDescription.trim()
        : "",
  };
};
