import {
  ACTIVE_AI_REQUEST_STATUSES,
  AI_STATUS,
} from "../domain/status-vocabulary.js";
import { Insemination } from "../models/insemination.model.js";
import { AppError } from "../utils/app-error.js";
import { CURRENT_AI_ATTEMPT_QUERY } from "../domain/previous-ai-entry.js";

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

export const isVerifiedFailedAIAttempt = (request) =>
  request?.status === "done" &&
  request?.isSuccess === false &&
  String(request?.outcome || "").startsWith("Failed") &&
  (
    request?.outcomeVerificationStatus === "verified" ||
    Boolean(request?.reviewedBy) ||
    // Legacy negative PD outcomes were written only by technician diagnosis
    // paths before explicit verification metadata existed.
    request?.outcome === "Failed (Negative PD)"
  );

export const isVerifiedReturnToHeatAIAttempt = (request) =>
  isVerifiedFailedAIAttempt(request) &&
  request?.outcome === "Failed (Re-heat)" &&
  request?.failureReason === "return_to_heat" &&
  request?.outcomeVerificationStatus === "verified";

export const assertVerifiedReturnToHeatAIAttempt = (request) => {
  if (isVerifiedReturnToHeatAIAttempt(request)) return request;
  throw new AppError(
    "The previous AI attempt must be confirmed unsuccessful before requesting another insemination.",
    { status: 409, code: "PREVIOUS_AI_FAILURE_NOT_VERIFIED" },
  );
};

const applySession = (query, session) => {
  if (session && typeof query.session === "function") {
    return query.session(session);
  }
  return query;
};

export const findActiveAIRequest = (animalId, session = null) =>
  applySession(Insemination.findOne(activeAIRequestQuery(animalId)).sort({ createdAt: 1 }), session);

const isActiveRequestKeyCollision = (error) =>
  error?.code === 11000 &&
  (error?.keyPattern?.activeRequestKey || error?.keyValue?.activeRequestKey);

export const createAIRequestWithGuard = async (payload, options = {}) => {
  const session = options?.session || null;
  const existing = await findActiveAIRequest(payload.animalId, session);
  if (existing) throw createActiveAIRequestError(existing);
  const serverPayload = { ...payload };
  delete serverPayload.completedAt;

  const lastPerformedAttempt = await applySession(
    Insemination.findOne({
      animalId: payload.animalId,
      status: "done",
      inseminationDate: { $exists: true, $ne: null },
      deletedAt: null,
      ...CURRENT_AI_ATTEMPT_QUERY,
    }).sort({ attemptNumber: -1, inseminationDate: -1 }),
    session
  );

  if (payload.previousAttemptId && !lastPerformedAttempt) {
    throw new AppError(
      "The previous AI attempt could not be found for this animal.",
      { status: 404, code: "PREVIOUS_AI_ATTEMPT_NOT_FOUND" },
    );
  }

  if (
    payload.previousAttemptId &&
    String(payload.previousAttemptId) !== String(lastPerformedAttempt?._id)
  ) {
    throw new AppError(
      "Re-insemination must be linked to the latest performed AI attempt.",
      { status: 409, code: "PREVIOUS_AI_ATTEMPT_NOT_LATEST" },
    );
  }

  if (lastPerformedAttempt) {
    if (options.requireVerifiedReturnToHeat === true) {
      assertVerifiedReturnToHeatAIAttempt(lastPerformedAttempt);
    } else if (!isVerifiedFailedAIAttempt(lastPerformedAttempt)) {
      throw new AppError(
        "The previous AI attempt must be completed and confirmed unsuccessful before re-insemination.",
        { status: 409, code: "PREVIOUS_AI_FAILURE_NOT_VERIFIED" },
      );
    }
  }

  const attemptNumber = (lastPerformedAttempt?.attemptNumber || 0) + 1;
  if (payload.status === AI_STATUS.DONE) {
    serverPayload.completedAt =
      options.completedAt instanceof Date &&
      !Number.isNaN(options.completedAt.getTime())
        ? options.completedAt
        : new Date();
  }

  try {
    let createdResult;
    if (session) {
      createdResult = await Insemination.create([{
        ...serverPayload,
        attemptNumber,
        previousAttemptId: lastPerformedAttempt?._id || null,
        attemptSeriesId:
          lastPerformedAttempt?.attemptSeriesId ||
          lastPerformedAttempt?._id ||
          payload.attemptSeriesId ||
          undefined,
        activeRequestKey: activeRequestKeyForAnimal(payload.animalId),
      }], { session });
    } else {
      createdResult = await Insemination.create({
        ...serverPayload,
        attemptNumber,
        previousAttemptId: lastPerformedAttempt?._id || null,
        attemptSeriesId:
          lastPerformedAttempt?.attemptSeriesId ||
          lastPerformedAttempt?._id ||
          payload.attemptSeriesId ||
          undefined,
        activeRequestKey: activeRequestKeyForAnimal(payload.animalId),
      });
    }
    const insemination = Array.isArray(createdResult) ? createdResult[0] : createdResult;
    return insemination;
  } catch (error) {
    if (!isActiveRequestKeyCollision(error)) throw error;
    const concurrentWinner = await findActiveAIRequest(payload.animalId, session);
    throw createActiveAIRequestError(concurrentWinner);
  }
};
