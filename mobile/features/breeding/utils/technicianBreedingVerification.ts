import type { BreedingObservationAttempt } from "./breedingObservationPresentation";

export type TechnicianBreedingVerificationResult =
  | "pregnant"
  | "not_pregnant"
  | "return_to_heat"
  | "cannot_confirm"
  | "needs_recheck";

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
