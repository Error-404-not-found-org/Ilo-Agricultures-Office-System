import type { BreedingObservationAttempt } from "./breedingObservationPresentation";

export type TechnicianBreedingVerificationResult =
  | "pregnant"
  | "not_pregnant"
  | "return_to_heat"
  | "cannot_confirm"
  | "needs_recheck";

export type PregnancyTaskWorkflowStage =
  | "initial_confirmation"
  | "continuation_recheck"
  | "diagnostic_follow_up";

export type PregnancyContinuationResult =
  | "continuing"
  | "loss_detected"
  | "follow_up_required";

export const CANONICAL_PREGNANCY_DIAGNOSIS_OUTCOMES = [
  { value: "pregnant", label: "Pregnant" },
  { value: "not_pregnant", label: "Not Pregnant" },
  { value: "return_to_heat", label: "Returned to Heat" },
  { value: "needs_recheck", label: "Recheck Required" },
] as const;

export const PILOT_DIAGNOSTIC_METHODS = [
  { methodCode: "palpation", label: "Manual Palpation" },
  { methodCode: "visual_observation", label: "Visual Assessment" },
  { methodCode: "farmer_interview", label: "Farmer Interview" },
  { methodCode: "other", label: "Other" },
] as const;

export const formatDiagnosticMethodLabel = (
  methodCodeOrLabel?: string | null,
) => {
  if (!methodCodeOrLabel) return "Not Recorded";
  const normalized = String(methodCodeOrLabel).trim().toLowerCase();
  switch (normalized) {
    case "palpation":
    case "rectal_palpation":
    case "manual palpation":
      return "Manual Palpation";
    case "visual_observation":
    case "visual observation":
    case "visual assessment":
      return "Visual Assessment";
    case "farmer_interview":
    case "farmer interview":
      return "Farmer Interview";
    case "ultrasound":
      return "Ultrasound";
    case "blood_pag":
      return "Blood PAG";
    case "milk_pag":
      return "Milk PAG";
    case "other":
    case "other_approved":
      return "Other";
    default:
      return String(methodCodeOrLabel)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
};

export const PILOT_SELECTABLE_METHOD_CODES = new Set([
  "palpation",
  "rectal_palpation",
  "visual_observation",
  "farmer_interview",
  "other",
  "other_approved",
]);

export const getVisibleDiagnosticMethodOptions = ({
  methods,
  selectedMethod,
  isEligible = true,
  reason,
}: {
  methods?: any[] | null;
  selectedMethod?: string | null;
  isEligible?: boolean;
  reason?: string | null;
} = {}) => {
  if (Array.isArray(methods) && methods.length > 0) {
    return methods
      .filter(
        (m: any) =>
          PILOT_SELECTABLE_METHOD_CODES.has(m.methodCode) ||
          m.methodCode === selectedMethod,
      )
      .map((m: any) => ({
        ...m,
        label: formatDiagnosticMethodLabel(m.label || m.methodCode),
      }));
  }

  const base: any[] = [
    {
      methodCode: "palpation",
      label: "Manual Palpation",
      enabled: true,
      isEligible,
      reason,
    },
    {
      methodCode: "visual_observation",
      label: "Visual Assessment",
      enabled: true,
      isEligible,
      reason,
    },
    {
      methodCode: "farmer_interview",
      label: "Farmer Interview",
      enabled: true,
      isEligible,
      reason,
    },
    {
      methodCode: "other",
      label: "Other",
      enabled: true,
      isEligible,
      reason,
    },
  ];

  if (selectedMethod && !PILOT_SELECTABLE_METHOD_CODES.has(selectedMethod)) {
    base.splice(1, 0, {
      methodCode: selectedMethod,
      label: formatDiagnosticMethodLabel(selectedMethod),
      enabled: true,
      isEligible,
      reason,
    });
  }

  return base;
};

export const isPregnancyContinuationStage = (
  stage?: string | null,
): stage is Exclude<PregnancyTaskWorkflowStage, "initial_confirmation"> =>
  stage === "continuation_recheck" || stage === "diagnostic_follow_up";

export const buildPregnancyContinuationPayload = ({
  result,
  checkedAt,
  notes,
  followUpDate,
  taskId,
}: {
  result: PregnancyContinuationResult;
  checkedAt: Date;
  notes?: string;
  followUpDate?: Date | null;
  taskId: string;
}) => ({
  result,
  checkedAt: checkedAt.toISOString(),
  notes: notes || "",
  ...(followUpDate ? { followUpDate: followUpDate.toISOString() } : {}),
  taskId,
});

export const isFarmerReturnToHeatReview = (
  attempt?: BreedingObservationAttempt | null,
) => attempt?.farmerOutcomeReport === "return_to_heat";

export const buildTechnicianBreedingVerificationPayload = ({
  verificationResult,
  checkMethod,
  checkedAt,
  technicianNotes,
  nextCheckDate,
  policyVersion,
  taskId,
}: {
  verificationResult: TechnicianBreedingVerificationResult;
  checkMethod?: string;
  checkedAt: Date;
  technicianNotes?: string;
  nextCheckDate?: Date | null;
  policyVersion?: string;
  taskId?: string;
}) => ({
  verificationResult,
  ...(checkMethod ? { checkMethod } : {}),
  checkedAt: checkedAt.toISOString(),
  technicianNotes: technicianNotes || "",
  ...(nextCheckDate ? { nextCheckDate: nextCheckDate.toISOString() } : {}),
  ...(policyVersion ? { policyVersion } : {}),
  ...(taskId ? { taskId } : {}),
});
