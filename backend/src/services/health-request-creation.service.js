import { ACTIVE_HEALTH_REQUEST_STATUSES } from "../domain/status-vocabulary.js";
import { HealthRequest } from "../models/health-request.model.js";
import { AppError } from "../utils/app-error.js";

export const activeHealthCaseKey = (animalId, requestType = "disease") =>
  `${animalId}:${requestType}`;

export const activeHealthCaseQuery = (animalId, requestType = "disease") => ({
  animalId,
  requestType,
  deletedAt: null,
  status: { $in: ACTIVE_HEALTH_REQUEST_STATUSES },
});

export const createActiveHealthCaseError = (existing) =>
  new AppError(
    "An active health case of this type already exists for this animal. View or update the existing case before submitting another one.",
    {
      status: 409,
      code: "ACTIVE_HEALTH_CASE_EXISTS",
      details: {
        existingRequestId: existing?._id,
        existingRequestStatus: existing?.status,
        existingRequestType: existing?.requestType,
      },
    },
  );

export const findActiveHealthCase = (animalId, requestType) =>
  HealthRequest.findOne(activeHealthCaseQuery(animalId, requestType))
    .sort({ createdAt: 1 });

export const createHealthRequestWithGuard = async (payload) => {
  const requestType = payload.requestType || "disease";
  const existing = await findActiveHealthCase(payload.animalId, requestType);
  if (existing) throw createActiveHealthCaseError(existing);

  try {
    return await HealthRequest.create({
      ...payload,
      requestType,
      activeCaseKey: activeHealthCaseKey(payload.animalId, requestType),
    });
  } catch (error) {
    if (
      error?.code !== 11000 ||
      !(error?.keyPattern?.activeCaseKey || error?.keyValue?.activeCaseKey)
    ) {
      throw error;
    }
    const winner = await findActiveHealthCase(payload.animalId, requestType);
    throw createActiveHealthCaseError(winner);
  }
};
