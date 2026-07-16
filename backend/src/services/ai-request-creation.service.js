import { ACTIVE_AI_REQUEST_STATUSES } from "../domain/status-vocabulary.js";
import { Insemination } from "../models/insemination.model.js";
import { AppError } from "../utils/app-error.js";

export const ACTIVE_AI_REQUEST_CONFLICT_MESSAGE =
  "You already submitted an active AI service request for this animal. Complete or cancel the existing request before submitting another one.";

export const activeAIRequestQuery = (animalId) => ({
  animalId,
  deletedAt: null,
  status: { $in: ACTIVE_AI_REQUEST_STATUSES },
});

export const activeRequestKeyForAnimal = (animalId) => String(animalId);

export const createActiveAIRequestError = (existingRequest) =>
  new AppError(ACTIVE_AI_REQUEST_CONFLICT_MESSAGE, {
    status: 409,
    code: "ACTIVE_AI_REQUEST_EXISTS",
    details: {
      existingRequestId: existingRequest?._id,
      existingRequestStatus: existingRequest?.status,
    },
  });

export const findActiveAIRequest = (animalId) =>
  Insemination.findOne(activeAIRequestQuery(animalId)).sort({ createdAt: 1 });

const isActiveRequestKeyCollision = (error) =>
  error?.code === 11000 &&
  (error?.keyPattern?.activeRequestKey || error?.keyValue?.activeRequestKey);

export const createAIRequestWithGuard = async (payload) => {
  const existing = await findActiveAIRequest(payload.animalId);
  if (existing) throw createActiveAIRequestError(existing);

  const lastPerformedAttempt = await Insemination.findOne({
    animalId: payload.animalId,
    status: "done",
    inseminationDate: { $exists: true, $ne: null },
    deletedAt: null,
  }).sort({ attemptNumber: -1, inseminationDate: -1 });
  const attemptNumber = (lastPerformedAttempt?.attemptNumber || 0) + 1;

  try {
  return await Insemination.create({
    ...payload,
    attemptNumber,
    previousAttemptId: lastPerformedAttempt?._id || null,
    activeRequestKey: activeRequestKeyForAnimal(payload.animalId),
  });
  } catch (error) {
    if (!isActiveRequestKeyCollision(error)) throw error;
    const concurrentWinner = await findActiveAIRequest(payload.animalId);
    throw createActiveAIRequestError(concurrentWinner);
  }
};

export const isVerifiedFailedAIAttempt = (request) =>
  request?.status === "done" &&
  request?.isSuccess === false &&
  String(request?.outcome || "").startsWith("Failed") &&
  (
    request?.outcomeVerificationStatus === "verified" ||
    request?.farmerOutcomeReport === "return_to_heat" ||
    Boolean(request?.reviewedBy) ||
    // Legacy negative PD outcomes were written only by technician diagnosis
    // paths before explicit verification metadata existed.
    request?.outcome === "Failed (Negative PD)"
  );
