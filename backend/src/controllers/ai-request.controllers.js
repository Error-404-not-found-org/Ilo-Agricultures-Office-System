import { Insemination } from "../models/insemination.model.js";
import {
  AI_STATUS,
  ANIMAL_REPRODUCTIVE_STATUS,
  TASK_STATUS,
  isActiveAIRequestStatus,
} from "../domain/status-vocabulary.js";
import { Animal } from "../models/animal.model.js";
import { User } from "../models/user.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { inngest } from "../config/inngest.js";
import { checkInseminationAgeEligibility } from "../utils/cattleCore.js";
import { getReproductionEligibility } from "../domain/reproduction-lifecycle.js";
import { createAuditLog } from "../services/audit.service.js";
import { createTimelineEvent } from "../services/animal-timeline.service.js";
import {
  assertAIRequestAccess,
  assertAIRequestStatusAccess,
  buildAIRequestAssignmentGuard,
} from "../policies/request.policy.js";
import { Task } from "../models/task.model.js";
import { assertStatusTransition } from "../domain/livestock-workflow.js";
import { resolveReproductionNextAction } from "../domain/reproduction-next-action.js";
import {
  completeInsemination,
  persistBreedingObservationVerification,
} from "../services/livestock-transaction.service.js";
import { confirmPregnancyDiagnosis } from "../services/pregnancy-confirmation.service.js";
import { HealthRequest } from "../models/health-request.model.js";
import {
  activeRequestKeyForAnimal,
  createAIRequestWithGuard,
  findActiveAIRequest,
  isVerifiedFailedAIAttempt,
} from "../services/ai-request-creation.service.js";
import { notifyTechniciansOfBreedingObservation } from "../services/breeding-observation-notification.service.js";
import { getEarlyStartTiming } from "../domain/service-timing.js";
import { notifyUser } from "../services/notification-delivery.service.js";
import {
  normalizeAICompletionFields,
  normalizeAIScheduleDate,
  normalizeTechnicianNoteInput,
  normalizeVisitPeriod,
} from "../domain/ai-recording-fields.js";

// POST /api/ai-request
// Farmer submits an AI service request for one of their animals
export const createAIRequest = async (req, res) => {
  try {
    const farmerId = req.user._id;
    const { animalId, imageUrl, comment, heatSigns, previousAttemptId } =
      req.body;

    if (!animalId) {
      return res
        .status(400)
        .json({ message: "Please select an animal for the request." });
    }

    // Make sure the animal belongs to this farmer
    const animal = await Animal.findOne({ _id: animalId, farmerId });
    if (!animal) {
      return res
        .status(404)
        .json({ message: "Animal not found or does not belong to you." });
    }

    // Active-request conflicts take priority over broader reproductive rules.
    const existingActiveRequest = await findActiveAIRequest(animalId);
    if (existingActiveRequest) {
      return res.status(409).json({
        code: "ACTIVE_AI_REQUEST_EXISTS",
        message:
          "You already submitted an active AI service request for this animal. Complete or cancel the existing request before submitting another one.",
        existingRequestId: existingActiveRequest._id,
        existingRequestStatus: existingActiveRequest.status,
      });
    }

    // Gender check
    if (animal.gender !== "Female") {
      return res.status(400).json({
        message:
          "Insemination is restricted to female animals only. This animal is registered as Male.",
      });
    }

    // Age check
    const ageCheck = checkInseminationAgeEligibility(
      animal.birthDate,
      animal.species,
    );
    if (!ageCheck.isEligible) {
      return res.status(400).json({ message: ageCheck.reason });
    }

    // The remaining workflow guard considers pregnancy and postpartum recovery.
    // Load the reproductive records required by the canonical next-action resolver.
    const [activePregnancy, reproductiveTasks] = await Promise.all([
      Pregnancy.findOne({
        animalId,
        deletedAt: null,
        "pregnancyDiagnosis.result": "Pregnant",
      }).lean(),

      Task.find({
        animalIds: animal._id,
        taskType: {
          $in: ["AI", "PD", "Calving", "CD"],
        },
        status: {
          $in: [TASK_STATUS.PENDING, TASK_STATUS.IN_PROGRESS],
        },
      })
        .sort({
          dueDate: 1,
          createdAt: 1,
        })
        .lean(),
    ]);

    const eligibility = getReproductionEligibility({
      animal,
      activeRequest: null,
      activePregnancy:
        animal.reproductiveStatus === ANIMAL_REPRODUCTIVE_STATUS.PREGNANT
          ? activePregnancy
          : null,
      tasks: reproductiveTasks,
    });
    if (!eligibility.eligible) {
      return res.status(400).json({
        message: eligibility.reason,
        code: eligibility.code,
        nextAction: eligibility.nextAction,
        nextActionAt: eligibility.nextActionAt,
        requiredRecoveryDays: eligibility.requiredRecoveryDays,
        daysSinceCalving: eligibility.daysSinceCalving,
      });
    }

    const lastPerformedAttempt = await Insemination.findOne({
      animalId,
      status: AI_STATUS.DONE,
      inseminationDate: { $exists: true, $ne: null },
      deletedAt: null,
    }).sort({ attemptNumber: -1, inseminationDate: -1 });

    let attemptLink = {};
    if (previousAttemptId) {
      const previousAttempt = await Insemination.findOne({
        _id: previousAttemptId,
        animalId,
        farmerId,
        deletedAt: null,
      });
      if (!previousAttempt) {
        return res.status(404).json({
          code: "PREVIOUS_AI_ATTEMPT_NOT_FOUND",
          message:
            "The previous AI attempt could not be found for this animal.",
        });
      }
      if (
        lastPerformedAttempt &&
        String(lastPerformedAttempt._id) !== String(previousAttempt._id)
      ) {
        return res.status(409).json({
          code: "PREVIOUS_AI_ATTEMPT_NOT_LATEST",
          message:
            "Re-insemination must be linked to the latest performed AI attempt.",
        });
      }
      if (!isVerifiedFailedAIAttempt(previousAttempt)) {
        return res.status(409).json({
          code: "PREVIOUS_AI_FAILURE_NOT_VERIFIED",
          message:
            "The previous AI attempt must be completed and confirmed unsuccessful before requesting re-insemination.",
        });
      }
      attemptLink = {
        previousAttemptId: previousAttempt._id,
        attemptSeriesId: previousAttempt.attemptSeriesId || previousAttempt._id,
        attemptNumber: (previousAttempt.attemptNumber || 1) + 1,
      };
    } else if (lastPerformedAttempt) {
      return res.status(409).json({
        code: "REINSEMINATION_CONTEXT_REQUIRED",
        message:
          "This animal already has a performed AI attempt. Open that attempt and use Request Re-insemination after its failed outcome is confirmed.",
        existingRequestId: lastPerformedAttempt._id,
        existingRequestStatus: lastPerformedAttempt.status,
      });
    }

    const request = await createAIRequestWithGuard({
      farmerId,
      animalId,
      imageUrl: imageUrl || "",
      comment: comment || "",
      heatSigns: heatSigns || [],
      preferredDate: req.body.preferredDate || new Date(),
      status: "pending",
      ...attemptLink,
    });
    const attemptNumber = request.attemptNumber;
    await Promise.all([
      createTimelineEvent({
        animalId: animal._id,
        eventType: "ai_requested",
        actorId: farmerId,
        sourceType: "Insemination",
        sourceId: request._id,
        title: "AI service requested",
        summary: comment || "Farmer requested artificial insemination service.",
        attachments: imageUrl ? [imageUrl] : [],
        metadata: { attemptNumber, preferredDate: request.preferredDate },
      }),
      createAuditLog({
        entityType: "Insemination",
        entityId: request._id,
        action: "ai_requested",
        actorId: farmerId,
        after: { status: request.status, attemptNumber },
      }),
    ]);

    console.log(
      `[Unified AI Request Created] Farmer: ${farmerId} | Animal: ${animal.animalId} | Record: ${request._id}`,
    );

    // --- TRIGGER NOTIFICATIONS ---
    try {
      const technicians = await User.find({ role: "technician" });
      const admins = await User.find({ role: "admin" });
      const farmerBarangay = req.user.address?.barangay;
      const farmerMunicipality =
        req.user.address?.municipality || req.user.address?.city || "Iloilo";
      const generalLocation = farmerBarangay
        ? `Brgy. ${farmerBarangay}, ${farmerMunicipality}`
        : farmerMunicipality;

      const metadata = {
        requestId: request._id,
        animalId: animal._id,
        animalTag: animal.earTag || animal.animalId,
        farmerName: req.user.name,
        serviceType: "ai",
        location: generalLocation,
      };
      await Promise.all([
        ...technicians.map((technician) =>
          notifyUser({
            recipient: technician,
            senderId: farmerId,
            type: "ai-request",
            relatedId: request._id,
            category: "ai",
            eventType: "service_request_submitted",
            linkType: "request",
            metadata,
          }),
        ),
        ...admins.map((admin) =>
          notifyUser({
            recipient: admin,
            senderId: farmerId,
            type: "ai-request",
            relatedId: request._id,
            category: "ai",
            eventType: "service_request_submitted",
            linkType: "request",
            metadata,
            sendPush: false,
          }),
        ),
      ]);
    } catch (notifyErr) {
      console.error("[Notification Trigger Error]", notifyErr.message);
    }

    // --- TRIGGER SOCKET UPDATE ---
    req.app.get("io").emit("dashboardUpdate", {
      type: "AI_REQUEST_CREATED",
      message: "New AI request submitted",
    });

    res
      .status(201)
      .json({ message: "AI request submitted successfully.", request });
  } catch (error) {
    console.error("[createAIRequest ERROR]", error.message);
    res.status(error.status || 500).json({
      message: error.message || "Failed to submit AI request.",
      code: error.code,
      ...(error.details || {}),
    });
  }
};

export const createReInseminationRequest = async (req, res) => {
  req.body = { ...req.body, previousAttemptId: req.params.id };
  return createAIRequest(req, res);
};

// Compatibility adapter for installed clients that still post an animalId to
// /api/animals/re-inseminate. All creation and validation remain canonical.
export const createLegacyReInseminationRequest = async (req, res) => {
  try {
    const animalId = req.body?.animalId;
    if (!animalId) {
      return res.status(400).json({
        message: "Please select an animal for the request.",
        code: "ANIMAL_REQUIRED",
      });
    }

    const latestAttempt = await Insemination.findOne({
      animalId,
      farmerId: req.user._id,
      status: AI_STATUS.DONE,
      inseminationDate: { $exists: true, $ne: null },
      deletedAt: null,
    }).sort({ attemptNumber: -1, inseminationDate: -1 });

    if (!latestAttempt) {
      return res.status(409).json({
        code: "PREVIOUS_AI_ATTEMPT_NOT_FOUND",
        message: "No performed AI attempt is available for re-insemination.",
      });
    }

    res.set("Deprecation", "true");
    res.set("Sunset", "Thu, 01 Oct 2026 00:00:00 GMT");
    res.set(
      "Link",
      `</api/ai-request/${latestAttempt._id}/re-insemination>; rel="successor-version"`,
    );
    req.params.id = String(latestAttempt._id);
    req.body = {
      ...req.body,
      comment: req.body.comment || req.body.technicianNote,
    };
    return createReInseminationRequest(req, res);
  } catch (error) {
    console.error("[createLegacyReInseminationRequest ERROR]", error.message);
    return res.status(500).json({
      message: "Failed to resolve the previous AI attempt.",
      code: "REINSEMINATION_COMPATIBILITY_FAILED",
    });
  }
};

// GET /api/ai-request/my
export const getMyRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const farmerId = req.user._id;

    const query = { farmerId, deletedAt: null, farmerDismissedAt: null };
    if (status && status !== "all") query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [requests, total] = await Promise.all([
      Insemination.find(query)
        .populate("animalId", "animalId earTag species breed imageUrl")
        .populate("approvedBy", "name")
        .populate("technicianId", "name")
        .populate(
          "previousAttemptId",
          "attemptNumber inseminationDate outcome outcomeConfirmedAt",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Insemination.countDocuments(query),
    ]);

    res.status(200).json({
      data: requests,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error("[getMyRequests ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch your AI requests." });
  }
};

// PATCH /api/ai-request/:id/dismiss
// Removes a terminal request from the farmer's personal history only. The
// official request and its links remain available to operational roles.
export const dismissAIRequestForFarmer = async (req, res) => {
  try {
    if (req.user.role !== "farmer") {
      return res.status(403).json({
        message:
          "Only the farmer who submitted this request can remove it from their history.",
      });
    }

    const request = await Insemination.findOne({
      _id: req.params.id,
      farmerId: req.user._id,
      deletedAt: null,
    }).select("status farmerDismissedAt");

    if (!request) {
      return res.status(404).json({ message: "AI service request not found." });
    }
    if (!["cancelled", "rejected"].includes(request.status)) {
      return res.status(409).json({
        message:
          "Only cancelled or rejected requests can be removed from your history.",
      });
    }

    if (!request.farmerDismissedAt) {
      await Insemination.updateOne(
        {
          _id: request._id,
          farmerId: req.user._id,
          status: { $in: ["cancelled", "rejected"] },
          farmerDismissedAt: null,
        },
        { $set: { farmerDismissedAt: new Date() } },
      );
    }

    return res.status(200).json({
      message: "Request removed from your history.",
    });
  } catch (error) {
    console.error("[dismissAIRequestForFarmer ERROR]", error.message);
    return res.status(500).json({
      message: "Failed to remove the request from your history.",
    });
  }
};

// GET /api/ai-request
export const getAllRequests = async (req, res) => {
  try {
    const { status, page, limit } = req.query;
    const query = status ? { status, deletedAt: null } : { deletedAt: null };

    if (page || limit) {
      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
      const skip = (pageNum - 1) * limitNum;

      const [requests, total] = await Promise.all([
        Insemination.find(query)
          .populate("farmerId", "name address imageUrl")
          .populate("animalId", "animalId earTag species breed imageUrl")
          .populate("approvedBy", "name")
          .populate("technicianId", "name")
          .populate(
            "previousAttemptId",
            "attemptNumber inseminationDate outcome outcomeConfirmedAt approvedBy technicianId",
          )
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Insemination.countDocuments(query),
      ]);

      return res.status(200).json({
        data: requests,
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      });
    }

    const requests = await Insemination.find(query)
      .populate("farmerId", "name address imageUrl")
      .populate("animalId", "animalId earTag species breed imageUrl")
      .populate("approvedBy", "name")
      .populate("technicianId", "name")
      .populate(
        "previousAttemptId",
        "attemptNumber inseminationDate outcome outcomeConfirmedAt approvedBy technicianId",
      )
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json(requests);
  } catch (error) {
    console.error("[getAllRequests ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch AI requests." });
  }
};

// PATCH /api/ai-request/:id/status
export const updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      scheduledDate,
      inseminationDate,
      sireBreed,
      sireCode,
      semenDosesUsed,
      estrus,
      visitPeriod,
      earlyStartConfirmed,
    } = req.body;
    const normalizedTechnicianNote = normalizeTechnicianNoteInput(req.body);

    const VALID_STATUSES = Object.values(AI_STATUS);
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const normalizedVisitPeriod = normalizeVisitPeriod(visitPeriod);

    const existing = await Insemination.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "AI request record not found." });
    }

    assertAIRequestStatusAccess(req.user, existing);

    assertStatusTransition("ai", existing.status, status, {
      isAdmin: req.user.role === "admin",
    });

    if (status === "scheduled" && !scheduledDate) {
      return res.status(400).json({
        message: "A visit date and time are required before scheduling.",
        code: "SCHEDULE_DATE_REQUIRED",
      });
    }

    if (status === "in-progress" && !existing.scheduledDate) {
      return res.status(400).json({
        message: "Schedule this visit before starting the service.",
        code: "VISIT_NOT_SCHEDULED",
      });
    }

    const startTiming =
      status === "in-progress"
        ? getEarlyStartTiming(existing.scheduledDate)
        : null;

    if (startTiming?.isEarly && earlyStartConfirmed !== true) {
      return res.status(409).json({
        message: `This visit starts in about ${startTiming.earlyStartMinutes} minutes. Confirm that you want to start the service early.`,
        code: "EARLY_START_CONFIRMATION_REQUIRED",
        earlyStartMinutes: startTiming.earlyStartMinutes,
        scheduledDate: existing.scheduledDate,
      });
    }

    let completionFields = null;
    if (status === "done") {
      completionFields = normalizeAICompletionFields({
        sireBreed,
        sireCode,
        semenDosesUsed,
      });
      if (!estrus) {
        return res.status(400).json({
          message:
            "Sire breed, sire code, and estrus type are required when completing AI.",
        });
      }
      const completedAt = inseminationDate
        ? new Date(inseminationDate)
        : new Date();
      if (Number.isNaN(completedAt.getTime())) {
        return res.status(400).json({ message: "Invalid insemination date." });
      }
      if (completedAt.getTime() > Date.now() + 5 * 60 * 1000) {
        return res.status(400).json({
          message: "Completed AI date and time cannot be in the future.",
        });
      }
    }

    const targetTechId =
      req.user.role === "admin" && req.body.approvedBy
        ? req.body.approvedBy
        : req.user._id;
    const assignmentGuard =
      req.user.role === "admin"
        ? {}
        : buildAIRequestAssignmentGuard({ technicianId: req.user._id });
    const mutationGuard = {
      status: existing.status,
      ...assignmentGuard,
    };

    // Schedule conflict guard
    if ((status === "scheduled" || status === "in-progress") && scheduledDate) {
      const targetTime = new Date(scheduledDate);
      if (Number.isNaN(targetTime.getTime())) {
        return res.status(400).json({ message: "Invalid scheduled date." });
      }
      if (targetTime.getTime() < Date.now() - 5 * 60 * 1000) {
        return res.status(400).json({
          message: "Scheduled date and time cannot be in the past.",
        });
      }
      const startTime = new Date(targetTime.getTime() - 30 * 60 * 1000);
      const endTime = new Date(targetTime.getTime() + 30 * 60 * 1000);

      const insemConflict = await Insemination.findOne({
        _id: { $ne: id },
        approvedBy: targetTechId,
        status: "scheduled",
        scheduledDate: { $gte: startTime, $lte: endTime },
        deletedAt: null,
      });

      const healthConflict = await HealthRequest.findOne({
        _id: { $ne: id },
        handledBy: targetTechId,
        status: "scheduled",
        scheduledDate: { $gte: startTime, $lte: endTime },
        deletedAt: null,
      });

      if (insemConflict || healthConflict) {
        return res.status(409).json({
          message:
            "Schedule conflict: The assigned technician already has another visit scheduled within 30 minutes of this time.",
        });
      }
    }

    const isRescheduled =
      (existing.status === "approved" ||
        existing.status === "in-progress" ||
        existing.status === "scheduled") &&
      scheduledDate &&
      existing.scheduledDate &&
      new Date(existing.scheduledDate).getTime() !==
        new Date(scheduledDate).getTime();

    const updateData = {
      status,
      approvedBy: targetTechId,
      sireBreed: completionFields?.sireBreed ?? sireBreed,
      sireCode: completionFields?.sireCode ?? sireCode,
      estrus,
    };

    if (normalizedTechnicianNote !== undefined) {
      updateData.technicianNote = normalizedTechnicianNote;
    }

    if (normalizedVisitPeriod !== undefined) {
      updateData.visitPeriod = normalizedVisitPeriod;
    }

    if (isActiveAIRequestStatus(status)) {
      updateData.activeRequestKey = activeRequestKeyForAnimal(
        existing.animalId,
      );
    }

    if (status === "scheduled") {
      updateData.scheduledDate = new Date(scheduledDate);
    }

    if (status === "in-progress" && startTiming) {
      updateData.serviceStartedAt = startTiming.startedAt;
      updateData.earlyStartMinutes = startTiming.earlyStartMinutes;
    }

    if (status === "done") {
      updateData.technicianId = targetTechId;
      updateData.inseminationDate = inseminationDate
        ? new Date(inseminationDate)
        : new Date();
      updateData.semenDosesUsed = completionFields.semenDosesUsed;
    }

    let request;
    if (status === "done") {
      request = await completeInsemination({
        id,
        updateData,
        technicianId: targetTechId,
        farmerId: existing.farmerId,
        animalId: existing.animalId,
        animalTag: existing.animalId?.earTag || existing.animalId?.animalId,
        requestFilter: mutationGuard,
      });
      await request.populate("farmerId", "name pushToken");
      await request.populate("animalId", "animalId earTag species");
    } else {
      const statusUpdate = isActiveAIRequestStatus(status)
        ? { $set: updateData }
        : { $set: updateData, $unset: { activeRequestKey: 1 } };
      request = await Insemination.findOneAndUpdate(
        {
          _id: id,
          deletedAt: null,
          ...mutationGuard,
        },
        statusUpdate,
        { returnDocument: "after" },
      )
        .populate("farmerId", "name pushToken")
        .populate("animalId", "animalId earTag species");
    }

    if (!request) {
      return res.status(409).json({
        message:
          "The AI request assignment or status changed before this update completed.",
        code: "AI_REQUEST_CONCURRENT_UPDATE",
      });
    }

    // --- TRIGGER NOTIFICATION TO FARMER ---
    try {
      if (request.farmerId && request.farmerId._id) {
        const eventType =
          status === "done"
            ? "service_completed"
            : status === "approved"
              ? "service_request_accepted"
              : status === "in-progress"
                ? "service_started"
                : status === "scheduled"
                  ? isRescheduled
                    ? "service_visit_rescheduled"
                    : "service_visit_scheduled"
                  : status === "rejected"
                    ? "service_request_declined"
                    : "service_status_updated";
        await notifyUser({
          recipient: request.farmerId,
          senderId: req.user._id,
          type: "ai-request",
          relatedId: request._id,
          category: "ai",
          eventType,
          linkType: "request",
          title: "AI service update",
          message: `The AI service request for ${request.animalId.earTag || request.animalId.animalId} is now ${status}.`,
          metadata: {
            requestId: request._id,
            animalId: request.animalId?._id,
            animalTag: request.animalId.earTag || request.animalId.animalId,
            serviceType: "ai",
            technicianName: req.user.name,
            scheduledDate: request.scheduledDate,
            reason: normalizedTechnicianNote || "",
          },
        });
      }
    } catch (notifyErr) {
      console.error("[Notification Trigger Error]", notifyErr.message);
    }

    // --- TRIGGER SOCKET UPDATE ---
    req.app.get("io").emit("dashboardUpdate", {
      type: "AI_REQUEST_UPDATED",
      message: `AI request marked as ${status}`,
      status,
    });

    // --- TRIGGER INNGEST AUTOMATION & STATUS SYNC ---
    if (status === "approved" || status === "done") {
      // Official AI, animal status, and PD follow-up writes are committed by
      // completeInsemination. Inngest is retained for downstream automation.
      try {
        await inngest.send({
          name: "insemination/approved",
          data: {
            inseminationId: request._id,
            animalId: request.animalId._id,
            farmerId: request.farmerId._id,
          },
        });
      } catch (inngestErr) {
        console.error(
          "[updateRequestStatus INNGEST ERROR]",
          inngestErr.message,
        );
      }
    }

    res.status(200).json({ message: "Request status updated.", request });
  } catch (error) {
    console.error("[updateRequestStatus ERROR]", error.message);
    const transactionUnavailable =
      /Transaction numbers are only allowed|replica set|mongos/i.test(
        error.message,
      );
    res.status(transactionUnavailable ? 503 : error.status || 500).json({
      message: transactionUnavailable
        ? "This operation requires a transaction-capable database."
        : error.message || "Failed to update request status.",
      code: transactionUnavailable ? "TRANSACTION_UNAVAILABLE" : error.code,
    });
  }
};

// PATCH /api/ai-request/:id/claim-and-schedule
// New date-only workflow: assignment and scheduling are one conditional write.
export const claimAndScheduleAIRequest = async (req, res) => {
  try {
    if (req.user?.role !== "technician") {
      return res.status(403).json({
        message: "Only technicians can claim and schedule AI requests.",
        code: "AI_REQUEST_CLAIM_FORBIDDEN",
      });
    }

    if (
      Object.hasOwn(req.body, "approvedBy") ||
      Object.hasOwn(req.body, "technicianId")
    ) {
      return res.status(400).json({
        message: "The assigned technician is determined by authentication.",
        code: "TECHNICIAN_ASSIGNMENT_NOT_ALLOWED",
      });
    }

    const scheduledDate = normalizeAIScheduleDate(req.body.scheduledDate);
    const visitPeriod = normalizeVisitPeriod(req.body.visitPeriod);
    if (visitPeriod === undefined) {
      return res.status(400).json({
        message: "Choose morning or afternoon before scheduling.",
        code: "VISIT_PERIOD_REQUIRED",
      });
    }

    const changedAt = new Date();
    const request = await Insemination.findOneAndUpdate(
      {
        _id: req.params.id,
        deletedAt: null,
        status: AI_STATUS.PENDING,
        cancellationStatus: { $nin: ["requested", "approved"] },
        ...buildAIRequestAssignmentGuard({
          technicianId: req.user._id,
          allowPendingUnassigned: true,
        }),
      },
      {
        $set: {
          approvedBy: req.user._id,
          scheduledDate,
          visitPeriod,
          status: AI_STATUS.SCHEDULED,
          claimedAt: changedAt,
          scheduledAt: changedAt,
        },
      },
      { returnDocument: "after", runValidators: true },
    )
      .populate("farmerId", "name pushToken")
      .populate("animalId", "animalId earTag species")
      .populate("approvedBy", "name");

    if (!request) {
      const current = await Insemination.findById(req.params.id)
        .populate("farmerId", "name pushToken")
        .populate("animalId", "animalId earTag species")
        .populate("approvedBy", "name");

      if (!current) {
        return res.status(404).json({
          message: "AI request record not found.",
          code: "AI_REQUEST_NOT_FOUND",
        });
      }

      const assignedTechnicianId =
        current.approvedBy?._id?.toString() ||
        current.approvedBy?.toString() ||
        null;
      const isSameTechnician =
        assignedTechnicianId === req.user._id.toString();
      const isSameSchedule =
        current.scheduledDate &&
        new Date(current.scheduledDate).getTime() === scheduledDate.getTime() &&
        current.visitPeriod === visitPeriod;

      if (
        !current.deletedAt &&
        current.status === AI_STATUS.SCHEDULED &&
        isSameTechnician &&
        isSameSchedule
      ) {
        return res.status(200).json({
          message: "Request was already claimed and scheduled.",
          request: current,
          idempotent: true,
        });
      }

      if (assignedTechnicianId && !isSameTechnician) {
        return res.status(409).json({
          message: "This request has already been claimed by another technician.",
          code: "REQUEST_ALREADY_CLAIMED",
        });
      }

      return res.status(409).json({
        message: `This request is ${current.deletedAt ? "deleted" : current.status} and cannot be scheduled.`,
        code: "REQUEST_NOT_CLAIMABLE",
      });
    }

    try {
      if (request.farmerId?._id) {
        await notifyUser({
          recipient: request.farmerId,
          senderId: req.user._id,
          type: "ai-request",
          relatedId: request._id,
          category: "ai",
          eventType: "service_visit_scheduled",
          linkType: "request",
          dedupeKey: `ai-visit-scheduled:${request._id}`,
          title: "AI visit scheduled",
          message: `Technician ${req.user.name || "assigned technician"} scheduled the AI visit for ${visitPeriod}.`,
          metadata: {
            requestId: request._id,
            animalId: request.animalId?._id,
            animalTag:
              request.animalId?.earTag || request.animalId?.animalId,
            serviceType: "ai",
            technicianName: req.user.name,
            scheduledDate: request.scheduledDate,
            visitPeriod: request.visitPeriod,
          },
        });
      }
    } catch (notifyError) {
      console.error("[claimAndScheduleAIRequest NOTIFICATION ERROR]", notifyError.message);
    }

    const io = req.app?.get?.("io");
    if (io) {
      io.emit("dashboardUpdate", {
        type: "AI_REQUEST_SCHEDULED",
        requestId: request._id,
        status: request.status,
      });
    }

    return res.status(200).json({
      message: "AI request claimed and scheduled successfully.",
      request,
    });
  } catch (error) {
    console.error("[claimAndScheduleAIRequest ERROR]", error.message);
    return res.status(error.status || 500).json({
      message: error.message || "Failed to claim and schedule AI request.",
      code: error.code,
    });
  }
};

// PATCH /api/ai-request/:id/outcome
// Backward-compatible adapter for older mobile clients. Farmer input remains
// an observation and follows the same protected technician-review workflow.
export const confirmAIOutcome = async (req, res) => {
  const { isSuccess, note = "" } = req.body;
  if (typeof isSuccess !== "boolean") {
    return res.status(400).json({
      message: "Select the breeding observation you want to report.",
      code: "OBSERVATION_TYPE_REQUIRED",
    });
  }
  res.setHeader("Deprecation", "true");
  res.setHeader(
    "Link",
    `</api/ai-request/${req.params.id}/farmer-observation>; rel="successor-version"`,
  );
  req.body = {
    reportType: isSuccess ? "possible_pregnancy" : "return_to_heat",
    signs: [],
    notes: note,
    evidencePhotos: [],
    verificationRequested: false,
  };
  return submitFarmerBreedingObservation(req, res);
};

// POST /api/ai-request/:id/farmer-observation
export const submitFarmerBreedingObservation = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      reportType,
      signs = [],
      notes = "",
      evidencePhotos = [],
      evidenceImageUrl,
      verificationRequested = false,
    } = req.body;

    if (req.user.role !== "farmer") {
      return res.status(403).json({
        message: "Only farmers can submit breeding observations.",
        code: "FARMER_ONLY_OBSERVATION",
      });
    }

    const allowedReports = ["possible_pregnancy", "return_to_heat", "unsure"];
    if (!allowedReports.includes(reportType)) {
      return res.status(400).json({
        message: "Invalid breeding observation type.",
        code: "INVALID_OBSERVATION_TYPE",
      });
    }

    const request = await Insemination.findOne({
      _id: id,
      deletedAt: null,
    }).populate("animalId");
    if (!request) {
      return res.status(404).json({ message: "AI request record not found." });
    }

    assertAIRequestAccess(req.user, request);

    if (request.farmerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You can only report observations for your own animal.",
        code: "OBSERVATION_OWNER_MISMATCH",
      });
    }

    if (!["done", "in-progress"].includes(request.status)) {
      return res.status(400).json({
        message:
          "Breeding observations can only be submitted after an AI service has been performed.",
        code: "AI_NOT_COMPLETED",
      });
    }

    const animal = await Animal.findById(
      request.animalId?._id || request.animalId,
    );
    if (!animal) {
      return res.status(404).json({ message: "Animal not found." });
    }

    // Timing guard: return-to-heat follow-up is useful earlier than pregnancy diagnosis.
    if (verificationRequested) {
      const aiDate =
        request.inseminationDate ||
        request.dateOfAI ||
        request.completedAt ||
        request.createdAt;
      if (aiDate) {
        const daysSinceAI = Math.floor(
          (Date.now() - new Date(aiDate).getTime()) / (1000 * 60 * 60 * 24),
        );
        const minimumDays = reportType === "return_to_heat" ? 18 : 35;
        if (daysSinceAI < minimumDays) {
          return res.status(400).json({
            message:
              reportType === "return_to_heat"
                ? `Return-to-heat follow-up is usually useful around Day 18 post-AI. It has only been ${daysSinceAI} day(s) since insemination. Please keep monitoring or submit your observation without requesting verification.`
                : `Pregnancy verification is typically accurate after 35 days post-AI. It has only been ${daysSinceAI} day(s) since insemination. Please wait or submit your observation without requesting verification.`,
            code: "VERIFICATION_TOO_EARLY",
            daysSinceAI,
            minimumDays,
          });
        }
      }
    }

    const photos = Array.isArray(evidencePhotos)
      ? evidencePhotos.filter(Boolean)
      : evidenceImageUrl
        ? [evidenceImageUrl]
        : [];

    const observationReportedAt = new Date();
    request.farmerOutcomeReport = reportType;
    request.farmerOutcomeReportedAt = observationReportedAt;
    request.farmerObservationSigns = Array.isArray(signs) ? signs : [];
    request.farmerObservationNotes = notes || "";
    request.evidencePhotos = photos;
    const technicianVerificationRequired =
      reportType === "return_to_heat" || Boolean(verificationRequested);
    request.verificationRequested = technicianVerificationRequired;
    request.verificationStatus = technicianVerificationRequired
      ? "pending"
      : "not_requested";

    let nextAction = "Observation saved.";

    if (reportType === "possible_pregnancy") {
      request.outcomeVerificationStatus = "reported";
      request.outcomeConfirmationSource = "farmer_possible_pregnancy";
      request.outcomeConfirmedBy = req.user._id;
      request.outcomeConfirmedAt = new Date();
      if (
        animal.reproductiveStatus === "Inseminated" ||
        animal.reproductiveStatus === "Normal"
      ) {
        animal.reproductiveStatus = "Likely Pregnant";
      }
      nextAction = verificationRequested
        ? "A technician pregnancy verification task was queued."
        : "Observation saved as likely pregnant. A technician pregnancy check is still required to confirm.";
    }

    if (reportType === "return_to_heat") {
      animal.reproductiveStatus = "In Heat";
      request.outcomeVerificationStatus = "reported";
      request.outcomeConfirmationSource = "farmer_return_to_heat";
      nextAction =
        "Return-to-heat observation saved. A technician must verify the failed attempt before re-insemination.";
    }

    if (reportType === "unsure") {
      nextAction = verificationRequested
        ? "A technician verification task was queued."
        : "Observation saved. Continue monitoring or request technician verification.";
    }

    let verificationTask = null;
    if (technicianVerificationRequired) {
      if (request.verificationTaskId) {
        verificationTask = await Task.findById(request.verificationTaskId);
      }

      if (!verificationTask) {
        verificationTask = await Task.create({
          farmerId: req.user._id,
          animalIds: [animal._id],
          technicianId:
            request.technicianId?._id ||
            request.technicianId ||
            request.approvedBy?._id ||
            request.approvedBy ||
            undefined,
          taskType: "PD",
          category: "Follow-up",
          priority: reportType === "return_to_heat" ? 1 : 2,
          notes: `Breeding verification requested by farmer. Observation: ${reportType}. Signs: ${(Array.isArray(signs) ? signs : []).join(", ") || "None"}. Notes: ${notes || "None"}`,
          status: "Pending",
          dueDate: new Date(),
          sourceType: "farmer_requested_verification",
          metadata: { inseminationId: id, reportType },
        });
        request.verificationTaskId = verificationTask._id;
      }
    }

    request.statusHistory = request.statusHistory || [];
    request.statusHistory.push({
      status: "farmer_observation",
      note: `Farmer reported ${reportType}${technicianVerificationRequired ? " and requires verification" : ""}.`,
      actorId: req.user._id,
      createdAt: new Date(),
    });

    animal.activityLogs = animal.activityLogs || [];
    animal.activityLogs.push({
      event: "Breeding Observation Reported",
      date: new Date(),
      description: `Farmer reported ${reportType}. ${notes || ""}`.trim(),
    });

    await Promise.all([
      request.save(),
      animal.save(),
      createTimelineEvent({
        animalId: animal._id,
        eventType: "farmer_breeding_observation_reported",
        actorId: req.user._id,
        sourceType: "Insemination",
        sourceId: request._id,
        title: "Breeding observation reported",
        summary: `${reportType.replaceAll("_", " ")}${notes ? `: ${notes}` : ""}`,
        attachments: photos,
        metadata: {
          reportType,
          signs: Array.isArray(signs) ? signs : [],
          verificationRequested: technicianVerificationRequired,
          verificationTaskId: verificationTask?._id,
        },
      }),
      createAuditLog({
        entityType: "Insemination",
        entityId: request._id,
        action: "farmer_breeding_observation_reported",
        actorId: req.user._id,
        after: {
          reportType,
          signs,
          verificationRequested: technicianVerificationRequired,
          verificationTaskId: verificationTask?._id,
          animalStatus: animal.reproductiveStatus,
        },
      }),
    ]);

    await notifyTechniciansOfBreedingObservation({
      farmer: req.user,
      animal,
      insemination: request,
      task: verificationTask,
      reportType,
      signs: Array.isArray(signs) ? signs : [],
      notes,
      reportedAt: observationReportedAt,
      verificationRequested: technicianVerificationRequired,
    });

    res.status(200).json({
      message: "Breeding observation saved.",
      data: {
        request,
        animal,
        verificationTask,
        nextAction,
      },
    });
  } catch (error) {
    console.error("[submitFarmerBreedingObservation ERROR]", error.message);
    res.status(error.status || 500).json({
      message: error.message || "Failed to submit breeding observation.",
      code: error.code || "BREEDING_OBSERVATION_FAILED",
    });
  }
};

// DELETE /api/ai-request/:id
export const deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await Insemination.findOne({ _id: id, deletedAt: null })
      .populate("farmerId", "name")
      .populate("animalId", "earTag animalId");

    if (!request) {
      return res.status(404).json({ message: "Request not found." });
    }

    assertAIRequestAccess(req.user, request);

    const isOwner =
      request.farmerId &&
      request.farmerId._id.toString() === req.user._id.toString();

    // Status restriction: Only for farmers. Technicians can delete any (for testing/cleanup)
    if (
      isOwner &&
      !["pending", "approved", "in-progress", "rejected"].includes(
        request.status,
      )
    ) {
      return res.status(400).json({
        message: "Completed requests cannot be cancelled.",
      });
    }

    // Notify technicians in-app and by push when the farmer removes an active request.
    try {
      if (
        isOwner &&
        ["pending", "approved", "in-progress"].includes(request.status)
      ) {
        const technicians = await User.find({ role: "technician" });
        for (const t of technicians) {
          await notifyUser({
            recipient: t,
            senderId: req.user._id,
            type: "ai-request",
            relatedId: request._id,
            category: "cancellation",
            eventType: "request_cancelled",
            linkType: "request",
            dedupeKey: `ai-request-removed:${request._id}:${t._id}`,
            title: "AI service request cancelled",
            message: `${request.farmerId?.name} cancelled the AI service request for ${request.animalId?.earTag || request.animalId?.animalId}.`,
            metadata: {
              requestId: request._id,
              animalId: request.animalId?._id,
              animalTag: request.animalId?.earTag || request.animalId?.animalId,
              farmerName: request.farmerId?.name,
              actorName: request.farmerId?.name,
              serviceType: "ai",
            },
          });
        }
      }
    } catch (notifyErr) {
      console.error("[Notification Trigger Error]", notifyErr.message);
    }

    await Insemination.findByIdAndUpdate(id, {
      $set: { deletedAt: new Date() },
      $unset: { activeRequestKey: 1 },
    });

    // Socket update to refresh tech dashboard
    req.app.get("io").emit("dashboardUpdate", {
      type: "AI_REQUEST_DELETED",
      message: "An AI request was cancelled/removed by the farmer",
    });

    res.status(200).json({ message: "Request removed successfully." });
  } catch (error) {
    console.error("[deleteRequest ERROR]", error.message);
    res.status(500).json({ message: "Failed to remove request." });
  }
};

// GET /api/visits/upcoming
export const getUpcomingVisits = async (req, res) => {
  try {
    const farmerId = req.user._id;

    // =========================
    // AI REQUESTS
    // =========================
    const aiRequests = await Insemination.find({
      farmerId,
      deletedAt: null,
      status: { $in: ["pending", "approved", "in-progress"] },
    })
      .populate("animalId", "animalId earTag species breed")
      .populate("approvedBy", "name")
      .lean();

    // =========================
    // HEALTH REQUESTS
    // =========================
    const healthRequests = await HealthRequest.find({
      farmerId,
      deletedAt: null,
      status: { $in: ["pending", "approved", "in-progress"] },
    })
      .populate("animalId", "animalId earTag species breed")
      .populate("handledBy", "name")
      .lean();

    // =========================
    // NORMALIZE AI
    // =========================
    const ai = aiRequests.map((r) => ({
      _id: r._id,
      status: r.status,
      serviceType: "ai",
      animalId: r.animalId,
      scheduledAt: r.scheduledDate || r.preferredDate || r.createdAt,
      visitPeriod: r.visitPeriod,
      technician: r.approvedBy?.name || null,
      createdAt: r.createdAt,
    }));

    // =========================
    // NORMALIZE HEALTH
    // =========================
    const health = healthRequests.map((r) => ({
      _id: r._id,
      status: r.status,
      serviceType: "health",
      animalId: r.animalId,
      scheduledAt: r.scheduledDate || r.preferredDate || r.createdAt,
      technician: r.handledBy?.name || null,
      createdAt: r.createdAt,
    }));

    // =========================
    // MERGE + SORT
    // =========================
    const merged = [...ai, ...health].sort((a, b) => {
      return new Date(a.scheduledAt) - new Date(b.scheduledAt);
    });

    return res.status(200).json({
      data: merged,
      total: merged.length,
    });
  } catch (error) {
    console.error("[getUpcomingVisits ERROR]", error.message);
    return res.status(500).json({
      message: "Failed to fetch upcoming visits",
    });
  }
};

// GET /api/ai-request/:id
export const getAIRequestDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await Insemination.findOne({
      _id: id,
      deletedAt: null,
    })
      .populate("farmerId", "name address imageUrl phoneNumber farmLocation")
      .populate(
        "animalId",
        [
          "animalId",
          "earTag",
          "species",
          "breed",
          "imageUrl",
          "reproductiveStatus",
          "birthDate",
          "lastInseminationDate",
          "expectedCalvingDate",
          "lastCalvingDate",
        ].join(" "),
      )
      .populate("approvedBy", "name role phoneNumber")
      .populate("technicianId", "name role phoneNumber")
      .populate(
        "previousAttemptId",
        [
          "attemptNumber",
          "inseminationDate",
          "outcome",
          "outcomeVerificationStatus",
          "outcomeConfirmationSource",
          "outcomeConfirmedAt",
          "technicianId",
          "approvedBy",
        ].join(" "),
      );

    if (!request) {
      return res.status(404).json({
        message: "AI request record not found.",
      });
    }

    const animal = request.animalId;

    let pregnancyRecord = null;
    let reproductiveTasks = [];

    if (animal?._id) {
      [pregnancyRecord, reproductiveTasks] = await Promise.all([
        Pregnancy.findOne({
          animalId: animal._id,
          deletedAt: null,
          "pregnancyDiagnosis.result": "Pregnant",
        })
          .sort({
            "pregnancyDiagnosis.date": -1,
            createdAt: -1,
          })
          .lean(),

        Task.find({
          animalIds: animal._id,
          taskType: {
            $in: ["AI", "PD", "Calving", "CD"],
          },
          status: {
            $in: [TASK_STATUS.PENDING, TASK_STATUS.IN_PROGRESS],
          },
        })
          .sort({
            dueDate: 1,
            createdAt: 1,
          })
          .lean(),
      ]);
    }

    // A historical pregnancy record must not override a current
    // postpartum, normal, or other non-pregnant animal status.
    const activePregnancy =
      animal?.reproductiveStatus === ANIMAL_REPRODUCTIVE_STATUS.PREGNANT
        ? pregnancyRecord
        : null;

    const nextAction = animal
      ? resolveReproductionNextAction({
          animal,
          activeRequest: request,
          activePregnancy:
            animal.reproductiveStatus === ANIMAL_REPRODUCTIVE_STATUS.PREGNANT
              ? activePregnancy
              : null,
          tasks: reproductiveTasks,
        })
      : null;

    const isUnclaimed = !request.approvedBy;
    const isFarmerRole = req.user.role === "farmer";
    const isOwnFarmer =
      isFarmerRole &&
      request.farmerId?._id?.toString() === req.user._id.toString();

    const requestObj = request.toObject();

    requestObj.nextAction = nextAction;
    requestObj.nextActionAt = nextAction?.at || null;

    if (isUnclaimed && !isOwnFarmer && req.user.role !== "admin") {
      if (requestObj.farmerId) {
        requestObj.farmerId.phoneNumber = "";

        if (requestObj.farmerId.address) {
          requestObj.farmerId.address.landmark = "";
          requestObj.farmerId.address.street = "";
          requestObj.farmerId.address.houseNumber = "";
          requestObj.farmerId.address.coordinates = null;
        }

        if (requestObj.farmerId.farmLocation) {
          requestObj.farmerId.farmLocation.landmark = "";
          requestObj.farmerId.farmLocation.directionsNote = "";
          requestObj.farmerId.farmLocation.latitude = null;
          requestObj.farmerId.farmLocation.longitude = null;
        }
      }
    }

    return res.status(200).json({
      data: requestObj,
    });
  } catch (error) {
    console.error("[getAIRequestDetail ERROR]", error.message);

    return res.status(error.status || 500).json({
      message: error.message || "Failed to fetch AI request details.",
      code: error.code || "AI_REQUEST_DETAIL_FETCH_FAILED",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/ai-request/:id/cancel
// Smart cancellation — respects role + status rules
// ─────────────────────────────────────────────────────────────────────────────
export const cancelAIRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const actor = req.user;
    const role = actor.role; // "farmer" | "technician" | "admin"

    const request = await Insemination.findOne({ _id: id, deletedAt: null })
      .populate("farmerId", "name pushToken")
      .populate("animalId", "earTag animalId")
      .populate("approvedBy", "name pushToken")
      .populate("technicianId", "name pushToken");

    if (!request) {
      return res.status(404).json({ message: "AI request not found." });
    }

    const status = request.status;
    const isFarmer = role === "farmer";
    const isTechnician = role === "technician";
    const isAdmin = role === "admin";
    const isOwner = request.farmerId?._id.toString() === actor._id.toString();

    // Ownership check for farmers
    if (isFarmer && !isOwner) {
      return res.status(403).json({ message: "You do not own this request." });
    }

    // Block everyone from cancelling terminal states
    if (["cancelled", "done", "rejected"].includes(status)) {
      return res
        .status(400)
        .json({ message: `Request is already ${status}. Cannot cancel.` });
    }

    // Block farmer and technician from cancelling in-progress
    if (["in-progress"].includes(status) && !isAdmin) {
      return res.status(403).json({
        message:
          "This request is currently in progress and cannot be cancelled.",
      });
    }

    const previousStatus = status;
    const assignedTech = request.technicianId || request.approvedBy;
    const farmer = request.farmerId;
    const animal = request.animalId;
    const animalTag = animal?.earTag || animal?.animalId || "the animal";
    const now = new Date();

    // ─── Determine if this is a scheduled / Ready Today request ───────────────
    const isScheduled = status === "scheduled";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduledDay = request.scheduledDate
      ? new Date(request.scheduledDate)
      : null;
    if (scheduledDay) scheduledDay.setHours(0, 0, 0, 0);
    const isReadyToday =
      isScheduled && scheduledDay && scheduledDay.getTime() === today.getTime();

    // ─── FARMER path ──────────────────────────────────────────────────────────
    if (isFarmer) {
      if (isScheduled) {
        // Farmer cannot directly cancel scheduled / Ready Today — create a cancellation request
        if (!reason || reason.trim() === "") {
          return res.status(400).json({
            message:
              "A reason is required to request cancellation of a scheduled visit.",
          });
        }
        request.cancellationStatus = "requested";
        request.cancellationReason = reason.trim();
        request.cancellationResponseReason = "";
        request.cancellationRespondedAt = undefined;
        request.cancelledBy = actor._id;
        request.cancellationRequestedAt = now;
        request.statusHistory = request.statusHistory || [];
        request.statusHistory.push({
          status: "cancellation_requested",
          note: reason.trim(),
          actorId: actor._id,
        });
        await request.save();

        // Audit log
        await createAuditLog({
          entityType: "AIRequest",
          entityId: request._id,
          action: "CANCEL_REQUEST",
          actorId: actor._id,
          before: { status: previousStatus, cancellationStatus: "none" },
          after: { cancellationStatus: "requested" },
          metadata: { role, reason: reason.trim(), isReadyToday },
        });

        // Notify assigned technician and administrators through the same
        // durable in-app + push path.
        try {
          if (assignedTech?._id) {
            await notifyUser({
              recipient: assignedTech,
              senderId: actor._id,
              type: "ai-request",
              relatedId: request._id,
              category: "cancellations",
              eventType: "cancellation_requested",
              linkType: "request",
              metadata: {
                requestId: request._id,
                animalId: animal?._id,
                animalTag,
                serviceType: "ai",
                farmerName: farmer?.name,
                reason: reason.trim(),
                isToday: Boolean(isReadyToday),
              },
            });
          }
          const admins = await User.find({ role: "admin" });
          for (const admin of admins) {
            await notifyUser({
              recipient: admin,
              senderId: actor._id,
              type: "ai-request",
              relatedId: request._id,
              category: "cancellations",
              eventType: "cancellation_requested",
              linkType: "request",
              metadata: {
                requestId: request._id,
                animalId: animal?._id,
                animalTag,
                serviceType: "ai",
                farmerName: farmer?.name,
                reason: reason.trim(),
                isToday: Boolean(isReadyToday),
              },
            });
          }
        } catch (notifyErr) {
          console.error("[cancelAIRequest notify ERROR]", notifyErr.message);
        }

        return res.status(200).json({
          message:
            "Cancellation request submitted. Awaiting technician review.",
          cancellationStatus: "requested",
        });
      }

      // Farmer direct cancel: pending or approved
      if (!["pending", "approved"].includes(status)) {
        return res.status(400).json({
          message: `Farmers cannot directly cancel a request with status: ${status}.`,
        });
      }

      if (status === "approved" && !reason?.trim()) {
        return res.status(400).json({
          message:
            "A cancellation reason is required after a technician has accepted the request.",
          code: "CANCELLATION_REASON_REQUIRED",
        });
      }
    }

    // ─── TECHNICIAN / ADMIN direct cancel ─────────────────────────────────────
    if ((isTechnician || isAdmin) && !reason?.trim()) {
      return res
        .status(400)
        .json({ message: "A cancellation reason is required." });
    }

    // Perform direct cancellation
    request.status = "cancelled";
    request.cancellationReason = reason?.trim() || "";
    request.cancelledBy = actor._id;
    request.cancellationRequestedAt = now;
    request.cancellationStatus = "approved";
    request.statusHistory = request.statusHistory || [];
    request.statusHistory.push({
      status: "cancelled",
      note: reason?.trim() || `Cancelled by ${role}`,
      actorId: actor._id,
    });
    await request.save();

    // Audit log
    await createAuditLog({
      entityType: "AIRequest",
      entityId: request._id,
      action: "CANCEL",
      actorId: actor._id,
      before: { status: previousStatus },
      after: { status: "cancelled" },
      metadata: { role, reason: reason?.trim() || "" },
    });

    // Notifications
    try {
      const cancellationMetadata = {
        requestId: request._id,
        animalId: animal?._id,
        animalTag,
        serviceType: "ai",
        actorName: isFarmer ? farmer?.name : actor.name || role,
        reason: reason?.trim() || "",
      };
      if (isFarmer && assignedTech?._id) {
        await notifyUser({
          recipient: assignedTech,
          senderId: actor._id,
          type: "ai-request",
          relatedId: request._id,
          category: "cancellations",
          eventType: "request_cancelled",
          linkType: "request",
          metadata: cancellationMetadata,
        });
      } else if (!isFarmer && farmer?._id) {
        await notifyUser({
          recipient: farmer,
          senderId: actor._id,
          type: "ai-request",
          relatedId: request._id,
          category: "cancellations",
          eventType: "request_cancelled",
          linkType: "request",
          metadata: cancellationMetadata,
        });
        if (isAdmin && assignedTech?._id) {
          await notifyUser({
            recipient: assignedTech,
            senderId: actor._id,
            type: "ai-request",
            relatedId: request._id,
            category: "cancellations",
            eventType: "request_cancelled",
            linkType: "request",
            metadata: cancellationMetadata,
          });
        }
      }
    } catch (notifyErr) {
      console.error("[cancelAIRequest notify ERROR]", notifyErr.message);
    }

    // Socket calendar sync
    req.app.get("io").emit("requestCancelled", {
      type: "AI",
      requestId: request._id,
      technicianId: assignedTech?._id,
      scheduledDate: request.scheduledDate,
      farmerId: farmer?._id,
    });

    return res
      .status(200)
      .json({ message: "AI request cancelled successfully." });
  } catch (error) {
    console.error("[cancelAIRequest ERROR]", error.message);
    return res.status(500).json({ message: "Failed to cancel AI request." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/ai-request/:id/cancel-respond
// Technician or Admin approves or rejects a farmer's cancellation request
// ─────────────────────────────────────────────────────────────────────────────
export const respondAICancellation = async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, reason } = req.body;
    const actor = req.user;
    const role = actor.role;

    if (!["technician", "admin"].includes(role)) {
      return res.status(403).json({
        message:
          "Only technicians or admins can respond to cancellation requests.",
      });
    }

    const request = await Insemination.findOne({ _id: id, deletedAt: null })
      .populate("farmerId", "name pushToken")
      .populate("animalId", "earTag animalId")
      .populate("approvedBy", "name pushToken")
      .populate("technicianId", "name pushToken");

    if (!request) {
      return res.status(404).json({ message: "AI request not found." });
    }

    if (request.cancellationStatus !== "requested") {
      return res.status(400).json({
        message: "This request does not have a pending cancellation request.",
      });
    }

    const farmer = request.farmerId;
    const animal = request.animalId;
    const animalTag = animal?.earTag || animal?.animalId || "the animal";
    const previousStatus = request.status;

    if (approved) {
      request.status = "cancelled";
      request.cancellationStatus = "approved";
      request.cancellationResponseReason = reason?.trim() || "";
      request.cancellationRespondedAt = new Date();
      request.statusHistory = request.statusHistory || [];
      request.statusHistory.push({
        status: "cancelled",
        note: reason?.trim() || `Cancellation approved by ${role}`,
        actorId: actor._id,
      });
      await request.save();

      await createAuditLog({
        entityType: "AIRequest",
        entityId: request._id,
        action: "CANCEL_APPROVED",
        actorId: actor._id,
        before: { status: previousStatus, cancellationStatus: "requested" },
        after: { status: "cancelled", cancellationStatus: "approved" },
        metadata: { role, reason: reason?.trim() || "" },
      });

      if (farmer?._id) {
        await notifyUser({
          recipient: farmer,
          senderId: actor._id,
          type: "ai-request",
          relatedId: request._id,
          category: "cancellations",
          eventType: "cancellation_approved",
          linkType: "request",
          metadata: {
            requestId: request._id,
            animalId: animal?._id,
            animalTag,
            serviceType: "ai",
          },
        });
      }

      // Socket calendar sync
      req.app.get("io").emit("requestCancelled", {
        type: "AI",
        requestId: request._id,
        technicianId: (request.technicianId || request.approvedBy)?._id,
        scheduledDate: request.scheduledDate,
        farmerId: farmer?._id,
      });

      return res.status(200).json({ message: "Cancellation approved." });
    } else {
      // Rejected — restore cancellationStatus
      request.cancellationStatus = "rejected";
      request.cancellationResponseReason = reason?.trim() || "";
      request.cancellationRespondedAt = new Date();
      request.statusHistory = request.statusHistory || [];
      request.statusHistory.push({
        status: "cancellation_rejected",
        note: reason?.trim() || `Cancellation rejected by ${role}`,
        actorId: actor._id,
      });
      await request.save();

      await createAuditLog({
        entityType: "AIRequest",
        entityId: request._id,
        action: "CANCEL_REJECTED",
        actorId: actor._id,
        before: { cancellationStatus: "requested" },
        after: { cancellationStatus: "rejected" },
        metadata: { role, reason: reason?.trim() || "" },
      });

      if (farmer?._id) {
        await notifyUser({
          recipient: farmer,
          senderId: actor._id,
          type: "ai-request",
          relatedId: request._id,
          category: "cancellations",
          eventType: "cancellation_rejected",
          linkType: "request",
          metadata: {
            requestId: request._id,
            animalId: animal?._id,
            animalTag,
            serviceType: "ai",
            reason: reason?.trim() || "",
          },
        });
      }

      return res.status(200).json({
        message: "Cancellation rejected. Farmer has been notified.",
        cancellationStatus: "rejected",
        cancellationResponseReason: request.cancellationResponseReason,
        cancellationRespondedAt: request.cancellationRespondedAt,
      });
    }
  } catch (error) {
    console.error("[respondAICancellation ERROR]", error.message);
    return res
      .status(500)
      .json({ message: "Failed to respond to cancellation request." });
  }
};

export const verifyFarmerBreedingObservation = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      verificationResult,
      checkMethod,
      checkedAt,
      technicianNotes = "",
      nextCheckDate,
      evidencePhotos = [],
      policyVersion,
      taskId,
    } = req.body;

    if (!["admin", "technician"].includes(req.user.role)) {
      return res.status(403).json({
        message: "Only technicians or admins can verify breeding observations.",
        code: "UNAUTHORIZED_VERIFICATION",
      });
    }

    const validResults = [
      "pregnant",
      "not_pregnant",
      "return_to_heat",
      "needs_recheck",
    ];
    if (!validResults.includes(verificationResult)) {
      return res.status(400).json({
        message: "Invalid verification result.",
        code: "INVALID_VERIFICATION_RESULT",
      });
    }

    const validMethods = [
      "palpation",
      "ultrasound",
      "visual_observation",
      "farmer_interview",
      "other",
      "blood_pag",
      "milk_pag",
      "rectal_palpation",
      "clinical_examination",
      "other_approved",
    ];
    if (!validMethods.includes(checkMethod)) {
      return res.status(400).json({
        message: "Invalid check method.",
        code: "INVALID_CHECK_METHOD",
      });
    }

    const request = await Insemination.findOne({
      _id: id,
      deletedAt: null,
    }).populate("animalId");
    if (!request) {
      return res.status(404).json({ message: "AI request record not found." });
    }

    assertAIRequestAccess(req.user, request);

    if (request.farmerId.toString() === req.user._id.toString()) {
      return res.status(403).json({
        message:
          "You cannot verify a breeding observation for your own animal.",
        code: "CANNOT_VERIFY_SELF",
      });
    }

    const animal = await Animal.findById(
      request.animalId?._id || request.animalId,
    );
    if (!animal) {
      return res.status(404).json({ message: "Animal not found." });
    }

    const beforeState = {
      verificationStatus: request.verificationStatus,
      isSuccess: request.isSuccess,
      outcome: request.outcome,
      animalStatus: animal.reproductiveStatus,
    };

    const officialDiagnosis = ["pregnant", "not_pregnant"].includes(
      verificationResult,
    );
    const methodAliases = {
      palpation: "rectal_palpation",
      visual_observation: "clinical_examination",
      farmer_interview: "clinical_examination",
      other: "other_approved",
    };
    const normalizedMethodCode = methodAliases[checkMethod] || checkMethod;
    let verifiedRequest;
    let verifiedAnimal;
    let task;
    let nextAction;
    let pregnancyRecordCreated;
    let alreadyRecorded = false;

    if (officialDiagnosis) {
      const confirmation = await confirmPregnancyDiagnosis({
        animalId: animal._id,
        inseminationId: request._id,
        result: verificationResult,
        diagnosisDate: checkedAt,
        technicianNote: technicianNotes,
        methodCode: normalizedMethodCode,
        policyVersion,
        taskId: taskId || request.verificationTaskId,
        actor: req.user,
      });
      [verifiedRequest, verifiedAnimal] = await Promise.all([
        Insemination.findById(request._id),
        Animal.findById(animal._id),
      ]);
      task = confirmation.completedTask;
      alreadyRecorded = confirmation.alreadyRecorded;
      nextAction =
        verificationResult === "pregnant"
          ? confirmation.continuationTask
            ? "Pregnancy confirmed. A Day-60 continuation recheck is required."
            : "Pregnancy confirmed and recorded."
          : "Animal confirmed not pregnant. Status reset to Normal.";
      pregnancyRecordCreated = !alreadyRecorded;
    } else {
      const verification = await persistBreedingObservationVerification({
        animal,
        insemination: request,
        verificationResult,
        checkMethod,
        checkedAt,
        technicianNotes,
        nextCheckDate,
        evidencePhotos,
        actorId: req.user._id,
      });
      verifiedRequest = verification.request;
      verifiedAnimal = verification.animal;
      task = verification.task;
      nextAction = verification.nextAction;
      pregnancyRecordCreated = verification.pregnancyRecordCreated;
    }

    if (verificationResult === "pregnant" && !alreadyRecorded) {
      try {
        await inngest.send({
          name: "pregnancy/confirmed",
          data: {
            inseminationId: verifiedRequest._id,
            animalId: verifiedAnimal._id,
            farmerId: verifiedRequest.farmerId,
          },
        });
      } catch (inngestErr) {
        console.error(
          "[verifyBreedingObservation INNGEST ERROR]",
          inngestErr.message,
        );
      }
    }

    // Official diagnoses write their timeline and audit entries in the shared transaction.
    if (!officialDiagnosis)
      await createTimelineEvent({
        animalId: verifiedAnimal._id,
        eventType: "technician_breeding_verification_recorded",
        occurredAt: checkedAt ? new Date(checkedAt) : new Date(),
        actorId: req.user._id,
        sourceType: "Insemination",
        sourceId: verifiedRequest._id,
        title: "Pregnancy Verification Completed",
        summary:
          `Verified as ${verificationResult.replaceAll("_", " ")} via ${checkMethod}. ${technicianNotes}`.trim(),
        attachments: evidencePhotos || [],
        metadata: {
          verificationResult,
          checkMethod,
          pregnancyRecordCreated,
          verificationTaskId: task?._id,
          nextCheckDate,
        },
      });

    // Create Audit Log
    if (!officialDiagnosis)
      await createAuditLog({
        entityType: "Insemination",
        entityId: verifiedRequest._id,
        action: "verify_breeding_observation",
        actorId: req.user._id,
        before: beforeState,
        after: {
          verificationStatus: verifiedRequest.verificationStatus,
          isSuccess: verifiedRequest.isSuccess,
          outcome: verifiedRequest.outcome,
          animalStatus: verifiedAnimal.reproductiveStatus,
          verificationResult,
        },
        metadata: {
          checkMethod,
          technicianNotes,
        },
      });

    // Notify Farmer
    if (!alreadyRecorded) {
      try {
        const farmer = await User.findById(verifiedRequest.farmerId);
        const eventType =
          verificationResult === "pregnant"
            ? "pregnancy_confirmed"
            : verificationResult === "needs_recheck"
              ? "continuation_recheck_due"
              : "pregnancy_not_confirmed";
        await notifyUser({
          recipient: farmer,
          recipientId: verifiedRequest.farmerId,
          senderId: req.user._id,
          type: "ai-request",
          category: "pregnancy",
          eventType,
          relatedId: verifiedAnimal._id,
          linkType: "animal",
          dedupeKey: `breeding-verification:${verifiedRequest._id}:${eventType}`,
          title: "Pregnancy check updated",
          message: `The pregnancy check for ${verifiedAnimal.earTag || verifiedAnimal.animalId} has been recorded.`,
          metadata: {
            animalId: verifiedAnimal._id,
            animalTag: verifiedAnimal.earTag || verifiedAnimal.animalId,
            technicianName: req.user.name,
            requestId: verifiedRequest._id,
            nextCheckDate,
            workflowStage:
              verificationResult === "needs_recheck"
                ? "diagnostic_follow_up"
                : "initial_confirmation",
          },
        });
      } catch (notifErr) {
        console.error(
          "[verifyFarmerBreedingObservation Notification Error]",
          notifErr.message,
        );
      }
    }

    res.status(200).json({
      message: alreadyRecorded
        ? "The pregnancy diagnosis was already recorded. The matching task has been completed."
        : "Breeding observation verified successfully.",
      code: alreadyRecorded ? "PREGNANCY_DIAGNOSIS_RECONCILED" : undefined,
      data: {
        request: verifiedRequest,
        animal: verifiedAnimal,
        task,
        nextAction,
      },
    });
  } catch (error) {
    console.error("[verifyFarmerBreedingObservation ERROR]", error);
    res.status(error.status || 500).json({
      message: error.message || "Failed to verify breeding observation.",
      code: error.code || "VERIFICATION_FAILED",
    });
  }
};
