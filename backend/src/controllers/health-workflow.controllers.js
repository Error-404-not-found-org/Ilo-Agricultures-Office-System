import { HealthRequest } from "../models/health-request.model.js";
import { MedicalRecord } from "../models/medical-record.model.js";
import { Animal } from "../models/animal.model.js";
import { assertAnimalAccess, assertClinicalRole } from "../policies/animal.policy.js";
import { assertHealthRequestAccess } from "../policies/request.policy.js";
import { createAuditLog } from "../services/audit.service.js";
import { createTimelineEvent } from "../services/animal-timeline.service.js";
import { AppError } from "../utils/app-error.js";
import { sendDetail, sendMutation } from "../utils/api-response.js";
import { activeHealthCaseKey } from "../services/health-request-creation.service.js";
import { buildFarmerHealthRequest } from "../domain/health-request-presentation.js";
import { notifyUser } from "../services/notification-delivery.service.js";

const ACTIVE_STATUSES = new Set(["pending", "triaged", "assigned", "approved", "scheduled", "in-progress", "in_progress"]);

const safeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const HEALTH_ADVICE_MAX_LENGTH = 2000;
const HEALTH_TECHNICIAN_NOTE_MAX_LENGTH = 2000;
const HEALTH_PICKUP_ITEM_MAX_LENGTH = 200;
const HEALTH_PICKUP_TEXT_MAX_LENGTH = 2000;
const ADVICE_ELIGIBLE_OWNED_STATUSES = new Set([
  "triaged",
  "assigned",
  "approved",
]);

const idText = (value) =>
  value?._id?.toString?.() || value?.toString?.() || null;

const requestOwnerIds = (request) =>
  [idText(request?.handledBy), idText(request?.assignedTechnicianId)].filter(
    Boolean,
  );

export const normalizeHealthAdvicePayload = (body = {}) => {
  if (typeof body.advice !== "string") {
    throw new AppError("Advice is required.", {
      status: 400,
      code: "HEALTH_ADVICE_REQUIRED",
    });
  }

  const advice = body.advice.trim();
  if (!advice) {
    throw new AppError("Advice cannot be blank.", {
      status: 400,
      code: "HEALTH_ADVICE_REQUIRED",
    });
  }
  if (advice.length > HEALTH_ADVICE_MAX_LENGTH) {
    throw new AppError(
      `Advice must be ${HEALTH_ADVICE_MAX_LENGTH} characters or fewer.`,
      { status: 400, code: "HEALTH_ADVICE_TOO_LONG" },
    );
  }

  let technicianNote;
  if (body.technicianNote !== undefined && body.technicianNote !== null) {
    if (typeof body.technicianNote !== "string") {
      throw new AppError("Technician note must be text.", {
        status: 400,
        code: "HEALTH_TECHNICIAN_NOTE_INVALID",
      });
    }
    technicianNote = body.technicianNote.trim();
    if (technicianNote.length > HEALTH_TECHNICIAN_NOTE_MAX_LENGTH) {
      throw new AppError(
        `Technician note must be ${HEALTH_TECHNICIAN_NOTE_MAX_LENGTH} characters or fewer.`,
        { status: 400, code: "HEALTH_TECHNICIAN_NOTE_TOO_LONG" },
      );
    }
  }

  let followUpDate;
  if (body.followUpDate === null) {
    followUpDate = null;
  } else if (body.followUpDate !== undefined) {
    followUpDate = new Date(body.followUpDate);
    if (Number.isNaN(followUpDate.getTime())) {
      throw new AppError("Follow-up date is invalid.", {
        status: 400,
        code: "HEALTH_FOLLOW_UP_DATE_INVALID",
      });
    }
  }

  return { advice, technicianNote, followUpDate };
};

const optionalPickupText = (value, fieldName, code, maxLength) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new AppError(`${fieldName} must be text.`, {
      status: 400,
      code,
    });
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new AppError(
      `${fieldName} must be ${maxLength} characters or fewer.`,
      { status: 400, code: `${code}_TOO_LONG` },
    );
  }
  return normalized;
};

export const normalizeHealthOfficePickupPayload = (body = {}) => {
  const item = optionalPickupText(
    body.item,
    "Pickup item",
    "HEALTH_OFFICE_PICKUP_ITEM_INVALID",
    HEALTH_PICKUP_ITEM_MAX_LENGTH,
  );
  if (!item) {
    throw new AppError("Pickup item is required.", {
      status: 400,
      code: "HEALTH_OFFICE_PICKUP_ITEM_REQUIRED",
    });
  }
  if (body.availabilityConfirmed !== true) {
    throw new AppError("Office availability must be confirmed.", {
      status: 400,
      code: "HEALTH_OFFICE_PICKUP_AVAILABILITY_REQUIRED",
    });
  }

  const instructions = optionalPickupText(
    body.instructions,
    "Pickup instructions",
    "HEALTH_OFFICE_PICKUP_INSTRUCTIONS_INVALID",
    HEALTH_PICKUP_TEXT_MAX_LENGTH,
  );
  const farmerMessage = optionalPickupText(
    body.farmerMessage,
    "Farmer message",
    "HEALTH_OFFICE_PICKUP_MESSAGE_INVALID",
    HEALTH_ADVICE_MAX_LENGTH,
  );
  if (!instructions && !farmerMessage) {
    throw new AppError(
      "Farmer-visible pickup instructions or message are required.",
      { status: 400, code: "HEALTH_OFFICE_PICKUP_MESSAGE_REQUIRED" },
    );
  }

  const dosageOrUseInstructions = optionalPickupText(
    body.dosageOrUseInstructions,
    "Dosage or use instructions",
    "HEALTH_OFFICE_PICKUP_DOSAGE_INVALID",
    HEALTH_PICKUP_TEXT_MAX_LENGTH,
  );
  const withdrawalGuidance = optionalPickupText(
    body.withdrawalGuidance,
    "Withdrawal guidance",
    "HEALTH_OFFICE_PICKUP_WITHDRAWAL_INVALID",
    HEALTH_PICKUP_TEXT_MAX_LENGTH,
  );

  const common = normalizeHealthAdvicePayload({
    advice: farmerMessage || instructions,
    technicianNote: body.technicianNote,
    followUpDate: body.followUpDate,
  });

  return {
    ...common,
    pickup: {
      item,
      availabilityConfirmed: true,
      instructions: instructions || farmerMessage,
      ...(dosageOrUseInstructions !== undefined
        ? { dosageOrUseInstructions }
        : {}),
      ...(withdrawalGuidance !== undefined ? { withdrawalGuidance } : {}),
    },
  };
};

const populateAdviceRequest = async (request) => {
  if (typeof request?.populate !== "function") return request;
  await request.populate("farmerId", "name pushToken");
  await request.populate("animalId", "animalId earTag species");
  return request;
};

const isAdviceReplayFor = (request, technicianId) =>
  request?.status === "resolved" &&
  request?.handlingMethod === "advice" &&
  requestOwnerIds(request).includes(technicianId);

const notifyFarmerAdviceAvailable = async ({ request, technicianId }) => {
  const farmerId = idText(request?.farmerId);
  if (!farmerId) return;
  const animalId = idText(request?.animalId);
  const animalTag =
    safeText(request?.animalId?.earTag) ||
    safeText(request?.animalId?.animalId) ||
    "the animal";

  await notifyUser({
    recipient: request.farmerId,
    recipientId: farmerId,
    senderId: technicianId,
    type: "health-request",
    relatedId: request._id,
    category: "health",
    eventType: "health_advice_available",
    linkType: "request",
    dedupeKey: `health-advice:${request._id}`,
    title: "Health advice available",
    message: `Health advice is available for ${animalTag}. Open the request to review it.`,
    metadata: {
      requestId: request._id,
      animalId,
      animalTag,
      serviceType: "health",
      handlingMethod: "advice",
    },
  });
};

const populateOfficePickupRequest = populateAdviceRequest;

const pickupTextMatches = (left, right) => safeText(left) === safeText(right);

const pickupFollowUpMatches = (storedValue, requestedValue) => {
  if (requestedValue === undefined) return true;
  if (requestedValue === null) return !storedValue;
  return new Date(storedValue).getTime() === requestedValue.getTime();
};

const isOfficePickupReplayFor = (request, technicianId, input) => {
  const pickup = request?.technicianResponse?.pickup;
  return (
    request?.status === "resolved" &&
    request?.handlingMethod === "office_pickup" &&
    requestOwnerIds(request).includes(technicianId) &&
    pickupTextMatches(pickup?.item, input.pickup.item) &&
    pickup?.availabilityConfirmed === true &&
    pickupTextMatches(pickup?.instructions, input.pickup.instructions) &&
    pickupTextMatches(
      pickup?.dosageOrUseInstructions,
      input.pickup.dosageOrUseInstructions,
    ) &&
    pickupTextMatches(
      pickup?.withdrawalGuidance,
      input.pickup.withdrawalGuidance,
    ) &&
    pickupTextMatches(request?.advice, input.advice) &&
    (input.technicianNote === undefined ||
      pickupTextMatches(request?.technicianNote, input.technicianNote)) &&
    pickupFollowUpMatches(request?.followUpDate, input.followUpDate)
  );
};

const notifyFarmerOfficePickupAvailable = async ({ request, technicianId }) => {
  const farmerId = idText(request?.farmerId);
  if (!farmerId) return;
  const animalId = idText(request?.animalId);
  const animalTag =
    safeText(request?.animalId?.earTag) ||
    safeText(request?.animalId?.animalId) ||
    "the animal";

  await notifyUser({
    recipient: request.farmerId,
    recipientId: farmerId,
    senderId: technicianId,
    type: "health-request",
    relatedId: request._id,
    category: "health",
    eventType: "health_office_pickup_available",
    linkType: "request",
    dedupeKey: `health-office-pickup:${request._id}`,
    title: "Office pickup available",
    message: `An office-pickup response is available for ${animalTag}. Open the request to review the instructions.`,
    metadata: {
      requestId: request._id,
      animalId,
      animalTag,
      serviceType: "health",
      handlingMethod: "office_pickup",
    },
  });
};

export const buildCandidateHealthDetail = (request) => {
  const farmer =
    request?.farmerId && typeof request.farmerId === "object"
      ? request.farmerId
      : {};
  const address =
    farmer.address && typeof farmer.address === "object"
      ? farmer.address
      : {};
  const dispatchLocation = request?.dispatch?.location || {};
  const photos = Array.isArray(request?.photos)
    ? request.photos.map(safeText).filter(Boolean)
    : [];

  return {
    id: request._id,
    _id: request._id,
    type: "health",
    serviceType: request.requestType || "Health Assistance",
    status: request.status,
    urgency: request.urgency,
    requestType: request.requestType,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    symptoms: request.symptoms,
    farmerNotes: safeText(request.farmerNotes),
    requestDetails: request.requestDetails,
    photos,
    imageUrl: safeText(request.imageUrl),
    animalId: request.animalId,
    farmerName: safeText(farmer.name),
    municipality:
      safeText(dispatchLocation.municipalityName) ||
      safeText(address.administrativeArea?.municipalityName) ||
      safeText(address.municipality) ||
      safeText(address.city),
    barangay:
      safeText(dispatchLocation.barangayName) ||
      safeText(address.administrativeArea?.barangayName) ||
      safeText(address.barangay),
  };
};

export const buildTechnicianCandidateHealthDetail = (request) => {
  const candidate = buildCandidateHealthDetail(request);
  const farmer =
    request?.farmerId && typeof request.farmerId === "object"
      ? request.farmerId
      : {};

  return {
    ...candidate,
    farmerId: {
      _id: farmer._id,
      name: safeText(farmer.name),
      phoneNumber: safeText(farmer.phoneNumber),
      imageUrl: safeText(farmer.imageUrl),
      address: farmer.address || null,
      farmLocation: farmer.farmLocation || null,
    },
  };
};

const getRequest = async (id) => {
  const request = await HealthRequest.findOne({ _id: id, deletedAt: null })
    .populate("farmerId", "name address phoneNumber imageUrl farmLocation")
    .populate("animalId", "animalId earTag species breed imageUrl reproductiveStatus birthDate")
    .populate("handledBy assignedTechnicianId", "name role phoneNumber")
    .lean();
  if (!request) throw new AppError("Health request not found", { status: 404, code: "HEALTH_REQUEST_NOT_FOUND" });
  return request;
};

export const getHealthRequestDetail = async (req, res) => {
  try {
    const request = await getRequest(req.params.id);
    assertHealthRequestAccess(req.user, request);

    const isNonClinicalResponse = ["advice", "office_pickup"].includes(
      request.handlingMethod,
    );
    const linkedMedicalRecord =
      ["resolved", "done", "completed"].includes(request.status) &&
      !isNonClinicalResponse
        ? await MedicalRecord.findOne({ healthRequestId: request._id })
            .select("_id")
            .lean()
        : null;
    const presentedRequest = {
      ...request,
      medicalRecordId: linkedMedicalRecord?._id || null,
    };

    const isUnclaimed = !presentedRequest.handledBy && !presentedRequest.assignedTechnicianId;
    const isFarmerRole = req.user.role === "farmer";
    const isOwnFarmer = isFarmerRole && presentedRequest.farmerId?._id?.toString() === req.user._id.toString();

    if (req.user.role === "technician") {
      const isAssignedToMe =
        presentedRequest.handledBy?._id?.toString() === req.user._id.toString() ||
        presentedRequest.assignedTechnicianId?._id?.toString() === req.user._id.toString();

      if (!isUnclaimed && !isAssignedToMe) {
        return res.status(403).json({
          message: "Request is assigned to another person.",
          code: "HEALTH_REQUEST_ASSIGNED_TO_OTHER",
        });
      }

      if (isUnclaimed) {
        return sendDetail(res, buildTechnicianCandidateHealthDetail(presentedRequest));
      }
    }

    if (isUnclaimed && !isOwnFarmer && req.user.role !== "admin" && req.user.role !== "technician") {
      return sendDetail(res, buildCandidateHealthDetail(presentedRequest));
    }

    if (isOwnFarmer) {
      return sendDetail(res, buildFarmerHealthRequest(presentedRequest));
    }

    sendDetail(res, presentedRequest);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message, code: error.code || "HEALTH_REQUEST_FETCH_FAILED" });
  }
};

export const provideHealthAdvice = async (req, res) => {
  try {
    if (req.user?.role !== "technician") {
      throw new AppError("Only technicians can provide Health advice.", {
        status: 403,
        code: "HEALTH_ADVICE_FORBIDDEN",
      });
    }

    const input = normalizeHealthAdvicePayload(req.body);
    const technicianId = req.user._id.toString();
    const existing = await HealthRequest.findOne({
      _id: req.params.id,
      deletedAt: null,
    });

    if (!existing) {
      throw new AppError("Health request not found.", {
        status: 404,
        code: "HEALTH_REQUEST_NOT_FOUND",
      });
    }

    const ownerIds = requestOwnerIds(existing);
    if (ownerIds.some((ownerId) => ownerId !== technicianId)) {
      throw new AppError(
        "This Health request is assigned to another technician.",
        { status: 403, code: "HEALTH_REQUEST_ASSIGNED_TO_OTHER" },
      );
    }

    if (isAdviceReplayFor(existing, technicianId)) {
      await populateAdviceRequest(existing);
      try {
        await notifyFarmerAdviceAvailable({ request: existing, technicianId });
      } catch (error) {
        console.error("[Health Advice Notification Error]", error.message);
      }
      return sendMutation(
        res,
        "Health advice was already sent.",
        { request: existing, idempotent: true },
      );
    }

    if (["resolved", "cancelled", "rejected"].includes(existing.status)) {
      throw new AppError(
        `This request is already ${existing.status} and cannot receive advice.`,
        { status: 409, code: "HEALTH_ADVICE_TERMINAL_REQUEST" },
      );
    }
    if (["in-progress", "in_progress"].includes(existing.status)) {
      throw new AppError(
        "An in-progress Health service cannot be converted to Advice.",
        { status: 409, code: "HEALTH_ADVICE_SERVICE_IN_PROGRESS" },
      );
    }
    if (
      existing.status === "scheduled" ||
      existing.scheduledDate ||
      existing.visitPeriod ||
      existing.handlingMethod === "farm_visit"
    ) {
      throw new AppError(
        "A scheduled Farm Visit cannot be converted to Advice.",
        { status: 409, code: "HEALTH_ADVICE_VISIT_ALREADY_SCHEDULED" },
      );
    }
    if (existing.handlingMethod === "office_pickup") {
      throw new AppError(
        "An Office Pickup response cannot be converted to Advice.",
        { status: 409, code: "HEALTH_ADVICE_HANDLING_CONFLICT" },
      );
    }

    const isUnassignedPending =
      existing.status === "pending" && ownerIds.length === 0;
    const isOwnedPending =
      existing.status === "pending" && ownerIds.includes(technicianId);
    const isEligibleOwnedStatus =
      ADVICE_ELIGIBLE_OWNED_STATUSES.has(existing.status) &&
      ownerIds.includes(technicianId);

    if (!isUnassignedPending && !isOwnedPending && !isEligibleOwnedStatus) {
      throw new AppError(
        "This Health request must be pending and unassigned, or already owned by you, before Advice can be provided.",
        { status: 409, code: "HEALTH_ADVICE_REQUEST_NOT_ELIGIBLE" },
      );
    }

    const now = new Date();
    const update = {
      $set: {
        status: "resolved",
        handlingMethod: "advice",
        advice: input.advice,
        handledBy: req.user._id,
        assignedTechnicianId: req.user._id,
        claimedAt: existing.claimedAt || now,
        resolvedAt: now,
        ...(input.technicianNote !== undefined
          ? { technicianNote: input.technicianNote }
          : {}),
        ...(input.followUpDate instanceof Date
          ? { followUpDate: input.followUpDate }
          : {}),
      },
      $unset: {
        activeCaseKey: 1,
        ...(input.followUpDate === null ? { followUpDate: 1 } : {}),
      },
      $push: {
        statusHistory: {
          status: "resolved",
          note: "Resolved with technician advice.",
          actorId: req.user._id,
          createdAt: now,
        },
      },
    };

    const updated = await HealthRequest.findOneAndUpdate(
      {
        _id: existing._id,
        deletedAt: null,
        status: existing.status,
        $and: [
          {
            $or: [
              { handledBy: req.user._id },
              { handledBy: null },
              { handledBy: { $exists: false } },
            ],
          },
          {
            $or: [
              { assignedTechnicianId: req.user._id },
              { assignedTechnicianId: null },
              { assignedTechnicianId: { $exists: false } },
            ],
          },
          {
            $or: [
              { scheduledDate: null },
              { scheduledDate: { $exists: false } },
            ],
          },
          {
            $or: [
              { visitPeriod: null },
              { visitPeriod: { $exists: false } },
            ],
          },
          {
            $or: [
              { handlingMethod: null },
              { handlingMethod: "advice" },
              { handlingMethod: { $exists: false } },
            ],
          },
        ],
      },
      update,
      { new: true },
    );

    if (!updated) {
      const latest = await HealthRequest.findOne({
        _id: existing._id,
        deletedAt: null,
      });
      if (isAdviceReplayFor(latest, technicianId)) {
        await populateAdviceRequest(latest);
        try {
          await notifyFarmerAdviceAvailable({ request: latest, technicianId });
        } catch (error) {
          console.error("[Health Advice Notification Error]", error.message);
        }
        return sendMutation(
          res,
          "Health advice was already sent.",
          { request: latest, idempotent: true },
        );
      }
      throw new AppError(
        "The request changed while Advice was being submitted. Refresh and try again.",
        { status: 409, code: "HEALTH_ADVICE_CONCURRENT_UPDATE" },
      );
    }

    await populateAdviceRequest(updated);

    try {
      await createAuditLog({
        entityType: "HealthRequest",
        entityId: updated._id,
        action: "health_advice_provided",
        actorId: req.user._id,
        before: {
          status: existing.status,
          handledBy: existing.handledBy || null,
          assignedTechnicianId: existing.assignedTechnicianId || null,
        },
        after: {
          status: "resolved",
          handlingMethod: "advice",
          followUpDate: updated.followUpDate || null,
        },
      });
    } catch (error) {
      console.error("[Health Advice Audit Error]", error.message);
    }

    try {
      await notifyFarmerAdviceAvailable({ request: updated, technicianId });
    } catch (error) {
      console.error("[Health Advice Notification Error]", error.message);
    }

    req.app?.get?.("io")?.emit?.("dashboardUpdate", {
      type: "HEALTH_ADVICE_PROVIDED",
      requestId: updated._id,
      status: "resolved",
    });

    return sendMutation(res, "Health advice sent.", {
      request: updated,
      idempotent: false,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Failed to provide Health advice.",
      code: error.code || "HEALTH_ADVICE_FAILED",
    });
  }
};

export const provideHealthOfficePickup = async (req, res) => {
  try {
    if (req.user?.role !== "technician") {
      throw new AppError("Only technicians can provide Office Pickup instructions.", {
        status: 403,
        code: "HEALTH_OFFICE_PICKUP_FORBIDDEN",
      });
    }

    const input = normalizeHealthOfficePickupPayload(req.body);
    const technicianId = req.user._id.toString();
    const existing = await HealthRequest.findOne({
      _id: req.params.id,
      deletedAt: null,
    });

    if (!existing) {
      throw new AppError("Health request not found.", {
        status: 404,
        code: "HEALTH_REQUEST_NOT_FOUND",
      });
    }

    const ownerIds = requestOwnerIds(existing);
    if (ownerIds.some((ownerId) => ownerId !== technicianId)) {
      throw new AppError(
        "This Health request is assigned to another technician.",
        { status: 403, code: "HEALTH_REQUEST_ASSIGNED_TO_OTHER" },
      );
    }

    if (isOfficePickupReplayFor(existing, technicianId, input)) {
      await populateOfficePickupRequest(existing);
      try {
        await notifyFarmerOfficePickupAvailable({
          request: existing,
          technicianId,
        });
      } catch (error) {
        console.error("[Health Office Pickup Notification Error]", error.message);
      }
      return sendMutation(res, "Office Pickup instructions were already sent.", {
        request: existing,
        idempotent: true,
      });
    }

    if (["resolved", "cancelled", "rejected"].includes(existing.status)) {
      throw new AppError(
        `This request is already ${existing.status} and cannot receive an Office Pickup response.`,
        { status: 409, code: "HEALTH_OFFICE_PICKUP_TERMINAL_REQUEST" },
      );
    }
    if (["in-progress", "in_progress"].includes(existing.status)) {
      throw new AppError(
        "An in-progress Health service cannot be converted to Office Pickup.",
        { status: 409, code: "HEALTH_OFFICE_PICKUP_SERVICE_IN_PROGRESS" },
      );
    }
    if (
      existing.status === "scheduled" ||
      existing.scheduledDate ||
      existing.visitPeriod ||
      existing.handlingMethod === "farm_visit"
    ) {
      throw new AppError(
        "A scheduled Farm Visit cannot be converted to Office Pickup.",
        {
          status: 409,
          code: "HEALTH_OFFICE_PICKUP_VISIT_ALREADY_SCHEDULED",
        },
      );
    }
    if (existing.handlingMethod === "advice") {
      throw new AppError(
        "An Advice response cannot be converted to Office Pickup.",
        { status: 409, code: "HEALTH_OFFICE_PICKUP_HANDLING_CONFLICT" },
      );
    }

    const isUnassignedPending =
      existing.status === "pending" && ownerIds.length === 0;
    const isOwnedPending =
      existing.status === "pending" && ownerIds.includes(technicianId);
    const isEligibleOwnedStatus =
      ADVICE_ELIGIBLE_OWNED_STATUSES.has(existing.status) &&
      ownerIds.includes(technicianId);

    if (!isUnassignedPending && !isOwnedPending && !isEligibleOwnedStatus) {
      throw new AppError(
        "This Health request must be pending and unassigned, or already owned by you, before Office Pickup can be provided.",
        { status: 409, code: "HEALTH_OFFICE_PICKUP_REQUEST_NOT_ELIGIBLE" },
      );
    }

    const now = new Date();
    const update = {
      $set: {
        status: "resolved",
        handlingMethod: "office_pickup",
        "technicianResponse.pickup": input.pickup,
        advice: input.advice,
        handledBy: req.user._id,
        assignedTechnicianId: req.user._id,
        claimedAt: existing.claimedAt || now,
        resolvedAt: now,
        ...(input.technicianNote !== undefined
          ? { technicianNote: input.technicianNote }
          : {}),
        ...(input.followUpDate instanceof Date
          ? { followUpDate: input.followUpDate }
          : {}),
      },
      $unset: {
        activeCaseKey: 1,
        ...(input.followUpDate === null ? { followUpDate: 1 } : {}),
      },
      $push: {
        statusHistory: {
          status: "resolved",
          note: "Resolved through Office Pickup.",
          actorId: req.user._id,
          createdAt: now,
        },
      },
    };

    const updated = await HealthRequest.findOneAndUpdate(
      {
        _id: existing._id,
        deletedAt: null,
        status: existing.status,
        $and: [
          {
            $or: [
              { handledBy: req.user._id },
              { handledBy: null },
              { handledBy: { $exists: false } },
            ],
          },
          {
            $or: [
              { assignedTechnicianId: req.user._id },
              { assignedTechnicianId: null },
              { assignedTechnicianId: { $exists: false } },
            ],
          },
          {
            $or: [
              { scheduledDate: null },
              { scheduledDate: { $exists: false } },
            ],
          },
          {
            $or: [
              { visitPeriod: null },
              { visitPeriod: { $exists: false } },
            ],
          },
          {
            $or: [
              { handlingMethod: null },
              { handlingMethod: "office_pickup" },
              { handlingMethod: { $exists: false } },
            ],
          },
        ],
      },
      update,
      { new: true },
    );

    if (!updated) {
      const latest = await HealthRequest.findOne({
        _id: existing._id,
        deletedAt: null,
      });
      if (isOfficePickupReplayFor(latest, technicianId, input)) {
        await populateOfficePickupRequest(latest);
        try {
          await notifyFarmerOfficePickupAvailable({
            request: latest,
            technicianId,
          });
        } catch (error) {
          console.error(
            "[Health Office Pickup Notification Error]",
            error.message,
          );
        }
        return sendMutation(
          res,
          "Office Pickup instructions were already sent.",
          { request: latest, idempotent: true },
        );
      }
      throw new AppError(
        "The request changed while Office Pickup was being submitted. Refresh and try again.",
        { status: 409, code: "HEALTH_OFFICE_PICKUP_CONCURRENT_UPDATE" },
      );
    }

    await populateOfficePickupRequest(updated);

    try {
      await createAuditLog({
        entityType: "HealthRequest",
        entityId: updated._id,
        action: "health_office_pickup_provided",
        actorId: req.user._id,
        before: {
          status: existing.status,
          handledBy: existing.handledBy || null,
          assignedTechnicianId: existing.assignedTechnicianId || null,
        },
        after: {
          status: "resolved",
          handlingMethod: "office_pickup",
          followUpDate: updated.followUpDate || null,
        },
      });
    } catch (error) {
      console.error("[Health Office Pickup Audit Error]", error.message);
    }

    try {
      await notifyFarmerOfficePickupAvailable({
        request: updated,
        technicianId,
      });
    } catch (error) {
      console.error("[Health Office Pickup Notification Error]", error.message);
    }

    req.app?.get?.("io")?.emit?.("dashboardUpdate", {
      type: "HEALTH_OFFICE_PICKUP_PROVIDED",
      requestId: updated._id,
      status: "resolved",
    });

    return sendMutation(res, "Office Pickup instructions sent.", {
      request: updated,
      idempotent: false,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Failed to provide Office Pickup instructions.",
      code: error.code || "HEALTH_OFFICE_PICKUP_FAILED",
    });
  }
};

export const triageHealthRequest = async (req, res) => {
  try {
    assertClinicalRole(req.user);
    const existing = await HealthRequest.findOne({ _id: req.params.id, deletedAt: null });
    if (!existing) throw new AppError("Health request not found", { status: 404, code: "HEALTH_REQUEST_NOT_FOUND" });
    if (!ACTIVE_STATUSES.has(existing.status)) {
      throw new AppError("Only active health requests can be triaged", { status: 409, code: "HEALTH_REQUEST_NOT_ACTIVE" });
    }

    const { urgency, findings = "", technicianNote = "", scheduledDate, assignedTechnicianId } = req.body;
    if (urgency && !["low", "medium", "high", "emergency"].includes(urgency)) {
      throw new AppError("Invalid urgency value", { status: 400, code: "INVALID_URGENCY" });
    }
    const nextStatus = scheduledDate ? "scheduled" : assignedTechnicianId ? "assigned" : "triaged";
    const before = { status: existing.status, urgency: existing.urgency };
    const update = {
      status: nextStatus,
      activeCaseKey: activeHealthCaseKey(existing.animalId, existing.requestType),
      handledBy: req.user._id,
      urgency: urgency || existing.urgency,
      findings,
      technicianNote,
      ...(scheduledDate ? { scheduledDate: new Date(scheduledDate) } : {}),
      ...(assignedTechnicianId ? { assignedTechnicianId } : {}),
      $push: { statusHistory: { status: nextStatus, note: technicianNote || findings, actorId: req.user._id } },
    };
    const request = await HealthRequest.findByIdAndUpdate(existing._id, update, { new: true });
    await Promise.all([
      createTimelineEvent({ animalId: request.animalId, eventType: "health_triaged", actorId: req.user._id, sourceType: "HealthRequest", sourceId: request._id, title: "Health case triaged", summary: findings || technicianNote, metadata: { urgency: request.urgency, status: request.status } }),
      createAuditLog({ entityType: "HealthRequest", entityId: request._id, action: "triaged", actorId: req.user._id, before, after: { status: request.status, urgency: request.urgency, findings } }),
    ]);
    sendMutation(res, "Health request triaged", request);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message, code: error.code || "HEALTH_TRIAGE_FAILED" });
  }
};

export const scheduleHealthFollowUp = async (req, res) => {
  try {
    assertClinicalRole(req.user);
    const request = await HealthRequest.findOne({ _id: req.params.id, deletedAt: null });
    if (!request) throw new AppError("Health request not found", { status: 404, code: "HEALTH_REQUEST_NOT_FOUND" });
    const { followUpDate, note = "" } = req.body;
    if (!followUpDate || Number.isNaN(new Date(followUpDate).getTime())) {
      throw new AppError("A valid follow-up date is required", { status: 400, code: "FOLLOW_UP_DATE_REQUIRED" });
    }
    request.followUpDate = new Date(followUpDate);
    request.statusHistory.push({ status: request.status, note: `Follow-up scheduled: ${note}`.trim(), actorId: req.user._id });
    await request.save();
    await Promise.all([
      createTimelineEvent({ animalId: request.animalId, eventType: "follow_up_due", actorId: req.user._id, sourceType: "HealthRequest", sourceId: request._id, title: "Health follow-up scheduled", summary: note, metadata: { followUpDate: request.followUpDate } }),
      createAuditLog({ entityType: "HealthRequest", entityId: request._id, action: "follow_up_scheduled", actorId: req.user._id, after: { followUpDate: request.followUpDate, note } }),
    ]);
    sendMutation(res, "Health follow-up scheduled", request);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message, code: error.code || "HEALTH_FOLLOW_UP_FAILED" });
  }
};
