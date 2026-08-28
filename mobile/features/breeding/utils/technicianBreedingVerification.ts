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
