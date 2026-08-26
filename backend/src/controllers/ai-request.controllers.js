import { Insemination } from "../models/insemination.model.js";
import {
  AI_STATUS,
  ANIMAL_REPRODUCTIVE_STATUS,
  TASK_STATUS,
  isActiveAIRequestStatus,
  normalizeAIStatus,
} from "../domain/status-vocabulary.js";
import { Animal } from "../models/animal.model.js";
import { User } from "../models/user.model.js";
import { resolveRequestLocation } from "../domain/geographic/municipalityResolver.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { inngest } from "../config/inngest.js";
import { checkInseminationAgeEligibility } from "../utils/cattleCore.js";
import { getReproductionEligibility } from "../domain/reproduction-lifecycle.js";
import { createAuditLog } from "../services/audit.service.js";
import { createTimelineEvent } from "../services/animal-timeline.service.js";
import {
  assertAIRequestAccess,
  assertAIRequestMutationOwnership,
  assertAIRequestStatusAccess,
  buildAIRequestAssignmentGuard,
  buildAIRequestMutationOwnershipGuard,
} from "../policies/request.policy.js";
import { Task } from "../models/task.model.js";
import { assertStatusTransition } from "../domain/livestock-workflow.js";
import { resolveReproductionNextAction } from "../domain/reproduction-next-action.js";
import {
  completeInsemination,
  persistBreedingObservationVerification,
} from "../services/livestock-transaction.service.js";
import { confirmPregnancyDiagnosis, executePregnancyFinalization } from "../services/pregnancy-confirmation.service.js";
import { HealthRequest } from "../models/health-request.model.js";
import {
  activeRequestKeyForAnimal,
  createAIRequestWithGuard,
  findActiveAIRequest,
  isVerifiedFailedAIAttempt,
  isVerifiedReturnToHeatAIAttempt,
} from "../services/ai-request-creation.service.js";
import { notifyTechniciansOfBreedingObservation } from "../services/breeding-observation-notification.service.js";
import {
  ensureBreedingObservationFollowUpTask,
  cancelPendingReproductiveTasksForInsemination,
  buildInseminationIdMatch
} from "../services/breeding-observation-followup.service.js";
import { getEarlyStartTiming } from "../domain/service-timing.js";
import { combineManilaServiceDateTime } from "../domain/service-date-time.js";
import { notifyUser } from "../services/notification-delivery.service.js";
import {
  normalizeAICompletionFields,
  normalizeAIScheduleDate,
  normalizeTechnicianNoteInput,
  normalizeVisitPeriod,
} from "../domain/ai-recording-fields.js";
import { notifyDispatchRequestSubmitted } from "../services/dispatch-request-notification.service.js";
import {
  assertVisitDaypartAvailable,
  hasVisitScheduleChanged,
} from "../domain/visit-scheduling.js";
import {
  assertFarmerBreedingObservationWindow,
  getPregnancyCheckReadiness,
} from "../domain/pregnancy-readiness.js";
import { loadPregnancyConfirmationPolicy } from "../services/pregnancy-policy.service.js";
import { assertTechnicianEligibleForNewRequest } from "../services/dispatch-eligibility.service.js";
import { assertPregnancyMutationAuthority } from "../policies/pregnancy-mutation.policy.js";
import { archiveInseminationAsAdmin } from "../services/admin-insemination-archive.service.js";
import {
  buildFarmerAIRequest,
  buildFarmerAIRequests,
} from "../domain/ai-request-presentation.js";

// POST /api/ai-request
// Farmer submits an AI service request for one of their animals
export const createAIRequest = async (req, res) => {
  try {
    const farmerId = req.user._id;
    const {
      animalId,
      imageUrl,
      photos,
      comment,
      heatSigns,
      previousAttemptId,
    } = req.body;

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
      if (!isVerifiedReturnToHeatAIAttempt(previousAttempt)) {
        return res.status(409).json({
          code: "PREVIOUS_AI_FAILURE_NOT_VERIFIED",
          message:
            "The previous AI attempt must be confirmed unsuccessful before requesting another insemination.",
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

    const dispatchLocation = resolveRequestLocation(req.user);
    const dispatchSnapshot = {
      location: dispatchLocation,
      stage: "local",
      resolutionStatus:
        dispatchLocation.source === "unresolved" ? "unresolved" : "resolved",
      version: 1,
      resolvedAt: new Date(),
    };

    const request = await createAIRequestWithGuard(
      {
        farmerId,
        animalId,
        imageUrl: imageUrl || (photos && photos.length > 0 ? photos[0] : ""),
        photos: photos || [],
        comment: comment || "",
        heatSigns: heatSigns || [],
        status: "pending",
        dispatch: dispatchSnapshot,
        ...attemptLink,
      },
      { requireVerifiedReturnToHeat: Boolean(previousAttemptId) },
    );
    const attemptNumber = request.attemptNumber;
    const isReInsemination = Boolean(request.previousAttemptId);
    await Promise.all([
      createTimelineEvent({
        animalId: animal._id,
        eventType: isReInsemination
          ? "ai_reinsemination_requested"
          : "ai_requested",
        actorId: farmerId,
        sourceType: "Insemination",
        sourceId: request._id,
        title: isReInsemination
          ? "Re-insemination requested"
          : "AI service requested",
        summary:
          comment ||
          (isReInsemination
            ? "Farmer requested another AI service after the previous attempt was confirmed unsuccessful."
            : "Farmer requested artificial insemination service."),
        attachments: photos?.length > 0 ? photos : imageUrl ? [imageUrl] : [],
        metadata: {
          attemptNumber,
          previousAttemptId: request.previousAttemptId || null,
          requestKind: isReInsemination ? "re_insemination" : "initial_ai",
        },
      }),
      createAuditLog({
        entityType: "Insemination",
        entityId: request._id,
        action: isReInsemination
          ? "ai_reinsemination_requested"
          : "ai_requested",
        actorId: farmerId,
        after: {
          status: request.status,
          attemptNumber,
          previousAttemptId: request.previousAttemptId || null,
        },
      }),
    ]);

    console.log(
      `[Unified AI Request Created] Farmer: ${farmerId} | Animal: ${animal.animalId} | Record: ${request._id}`,
    );

    // --- TRIGGER NOTIFICATIONS ---
    try {
      await notifyDispatchRequestSubmitted({
        request,
        requestType: "AI",
        animal,
        farmer: req.user,
      });
    } catch (notifyErr) {
      console.error("[Notification Delivery Error]", notifyErr.message);
    }

    // --- TRIGGER SOCKET UPDATE ---
    req.app.get("io").emit("dashboardUpdate", {
      type: "AI_REQUEST_CREATED",
      message: isReInsemination
        ? "New re-insemination request submitted"
        : "New AI request submitted",
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
      data: buildFarmerAIRequests(requests),
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
    if (req.user?.role === "technician") {
      query.$and = [
        buildAIRequestMutationOwnershipGuard({
          technicianId: req.user._id,
        }),
      ];
    }

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
    if (req.user?.role !== "technician") {
      return res.status(403).json({
        message: "AI request status changes require a Technician account.",
        code: "TECHNICIAN_CLINICAL_ROLE_REQUIRED",
      });
    }

    const { id } = req.params;
    const {
      status,
      scheduledDate,
      inseminationDate,
      time,
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

    const finalVisitPeriod =
      visitPeriod !== undefined ? normalizeVisitPeriod(visitPeriod) : undefined;

    const existing = await Insemination.findById(id).populate("animalId", "earTag animalId");
    if (!existing) {
      return res.status(404).json({ message: "AI request record not found." });
    }
    const authoritativePreviousStatus = existing.status;

    assertAIRequestStatusAccess(req.user, existing);

    assertAIRequestStatusAccess(req.user, existing);

    assertStatusTransition("ai", existing.status, status, {
      isAdmin: req.user.role === "admin",
    });

    let normalizedScheduledDate;
    if (status === "scheduled") {
      try {
        if (!scheduledDate) {
          return res.status(400).json({
            message: "A visit date is required before scheduling.",
            code: "SCHEDULE_DATE_REQUIRED",
          });
        }
        if (!visitPeriod) {
          return res.status(400).json({
            message: "A visit period is required before scheduling.",
            code: "VISIT_PERIOD_REQUIRED",
          });
        }
        normalizedScheduledDate = normalizeAIScheduleDate(scheduledDate);
        assertVisitDaypartAvailable({
          scheduledDate: normalizedScheduledDate,
          visitPeriod: finalVisitPeriod,
          samePeriodConfirmed: req.body.samePeriodConfirmed === true,
        });
      } catch (err) {
        return res.status(err.status || 400).json({
          message: err.message,
          code: err.code || "INVALID_SCHEDULE",
        });
      }
    }

    if (status === "in-progress" && !existing.scheduledDate) {
      return res.status(400).json({
        message: "Schedule this visit before starting the service.",
        code: "VISIT_NOT_SCHEDULED",
      });
    }

    const startTiming =
      status === "in-progress"
        ? getEarlyStartTiming(
            existing.scheduledDate,
            new Date(),
            existing.visitPeriod,
          )
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
      const completedAt = combineManilaServiceDateTime({
        date: inseminationDate,
        time,
      });
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

    const isRescheduled =
      (existing.status === "approved" ||
        existing.status === "in-progress" ||
        existing.status === "scheduled") &&
      status === "scheduled" &&
      hasVisitScheduleChanged(
        existing.scheduledDate,
        existing.visitPeriod,
        normalizedScheduledDate,
        finalVisitPeriod,
      );

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

    if (finalVisitPeriod !== undefined) {
      updateData.visitPeriod = finalVisitPeriod;
    }

    if (isActiveAIRequestStatus(status)) {
      updateData.activeRequestKey = activeRequestKeyForAnimal(
        existing.animalId,
      );
    }

    if (status === "scheduled") {
      updateData.scheduledDate = normalizedScheduledDate;
    }

    if (status === "in-progress" && startTiming) {
      updateData.serviceStartedAt = startTiming.startedAt;
      updateData.earlyStartMinutes = startTiming.earlyStartMinutes;
    }

    if (status === "done") {
      updateData.technicianId = targetTechId;
      updateData.inseminationDate = combineManilaServiceDateTime({
        date: inseminationDate,
        time,
      });
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

    if (status === "done") {
      console.info("[AI_COMPLETION_COMMITTED]", {
        requestId: String(request._id),
        previousStatus: authoritativePreviousStatus,
        status: request.status,
        transactionCommitted: true,
      });
    }

    // The authoritative domain write is complete. Respond before downstream
    // notification/automation work so those integrations cannot turn a
    // committed completion into a client-visible PATCH failure or timeout.
    res.status(200).json({ message: "Request status updated.", request });

    // --- TRIGGER NOTIFICATION TO FARMER ---
    try {
      if (request.farmerId && request.farmerId._id) {
        const requestKind =
          request.previousAttemptId || Number(request.attemptNumber) > 1
            ? "re_insemination"
            : "initial_ai";
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
            visitPeriod: request.visitPeriod,
            reason: normalizedTechnicianNote || "",
            requestKind,
            attemptNumber: request.attemptNumber || 1,
            previousAttemptId: request.previousAttemptId || null,
          },
        });
      }
    } catch (notifyErr) {
      console.error("[Notification Trigger Error]", notifyErr.message);
    }

    // --- TRIGGER SOCKET UPDATE ---
    try {
      req.app?.get("io")?.emit("dashboardUpdate", {
        type: "AI_REQUEST_UPDATED",
        message: `AI request marked as ${status}`,
        status,
      });
    } catch (socketErr) {
      console.error("[AI Request Socket Error]", socketErr.message);
    }

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
  } catch (error) {
    console.error("[updateRequestStatus ERROR]", error.message);
    if (res.headersSent) return;
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
    assertVisitDaypartAvailable({
      scheduledDate,
      visitPeriod,
      samePeriodConfirmed: req.body.samePeriodConfirmed === true,
    });

    const candidate = await Insemination.findOne({
      _id: req.params.id,
      deletedAt: null,
      status: AI_STATUS.PENDING,
      approvedBy: null,
      technicianId: null,
    })
      .select("dispatch")
      .lean();
    if (candidate) {
      assertTechnicianEligibleForNewRequest({
        technician: req.user,
        requestType: "AI",
        dispatch: candidate.dispatch,
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
      const isSameTechnician = assignedTechnicianId === req.user._id.toString();
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
          message:
            "This request has already been claimed by another technician.",
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
        const requestKind =
          request.previousAttemptId || Number(request.attemptNumber) > 1
            ? "re_insemination"
            : "initial_ai";
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
            animalTag: request.animalId?.earTag || request.animalId?.animalId,
            serviceType: "ai",
            technicianName: req.user.name,
            scheduledDate: request.scheduledDate,
            visitPeriod: request.visitPeriod,
            requestKind,
            attemptNumber: request.attemptNumber || 1,
            previousAttemptId: request.previousAttemptId || null,
          },
        });
      }
    } catch (notifyError) {
      console.error(
        "[claimAndScheduleAIRequest NOTIFICATION ERROR]",
        notifyError.message,
      );
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

    const isTerminalOutcome =
      request.outcome === "Pregnant" ||
      request.outcome === "Failed (Re-heat)" ||
      request.outcome === "Failed (Aborted)" ||
      request.outcome === "Failed (Negative PD)";

    const isTerminal =
      (isTerminalOutcome && request.outcomeVerificationStatus === "verified") ||
      typeof request["isSuccess"] === "boolean";

    if (isTerminal) {
      return res.status(409).json({
        message:
          "This AI attempt has already been verified with a terminal outcome and cannot accept further observations.",
        code: "AI_ATTEMPT_TERMINAL",
      });
    }

    const animal = await Animal.findById(
      request.animalId?._id || request.animalId,
    );
    if (!animal) {
      return res.status(404).json({ message: "Animal not found." });
    }

    assertFarmerBreedingObservationWindow({ insemination: request });

    const policyResolution = await loadPregnancyConfirmationPolicy();
    const pregnancyReadiness = getPregnancyCheckReadiness({
      insemination: request,
      policy: policyResolution.policy,
      species: animal.species,
    });

    const photos = Array.isArray(evidencePhotos)
      ? evidencePhotos.filter(Boolean)
      : evidenceImageUrl
        ? [evidenceImageUrl]
        : [];

    const observationReportedAt = new Date();
    const previousFarmerReport = request.farmerOutcomeReport;
    request.farmerOutcomeReport = reportType;
    request.farmerOutcomeReportedAt = observationReportedAt;
    request.farmerObservationSigns = Array.isArray(signs) ? signs : [];
    request.farmerObservationNotes = notes || "";
    request.evidencePhotos = photos;
    request.observationSource = "farmer";
    request.observationRecordedBy = req.user._id;
    const followUp = await ensureBreedingObservationFollowUpTask({
      request,
      farmerId: req.user._id,
      animalId: animal._id,
      technicianId:
        request.technicianId?._id ||
        request.technicianId ||
        request.approvedBy?._id ||
        request.approvedBy,
      reportType,
      signs,
      notes,
      pregnancyReadiness,
      at: observationReportedAt,
    });
    const verificationTask = followUp.task;
    const technicianVerificationRequired = followUp.technicianActionRequired;
    request.verificationRequested = technicianVerificationRequired;
    request.verificationStatus = followUp.verificationStatus;
    // We intentionally DO NOT update request.verificationTaskId here, because that field is reserved for the PD task.

    let nextAction = "Observation saved.";

    if (reportType === "possible_pregnancy") {
      request.outcomeVerificationStatus = "reported";
      request.outcomeConfirmationSource = "farmer_possible_pregnancy";
      request.outcomeConfirmedBy = req.user._id;
      request.outcomeConfirmedAt = new Date();
      nextAction = technicianVerificationRequired
        ? "Possible pregnancy signs recorded. Technician follow-up is available now."
        : "Possible pregnancy signs recorded. Pregnancy confirmation will follow the existing readiness schedule.";
    }

    if (reportType === "return_to_heat") {
      request.outcomeVerificationStatus = "reported";
      request.outcomeConfirmationSource = "farmer_return_to_heat";
      nextAction =
        "Return-to-heat observation saved. A technician must verify the failed attempt before re-insemination.";
    }

    if (reportType === "unsure") {
      request.outcomeVerificationStatus = "pending";
      request.outcomeConfirmationSource = null;
      request.outcomeConfirmedBy = null;
      request.outcomeConfirmedAt = null;
      nextAction = "Observation saved. Continue monitoring the animal.";
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
          technicianFollowUpRequired: technicianVerificationRequired,
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
          technicianFollowUpRequired: technicianVerificationRequired,
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
      technicianActionRequired: technicianVerificationRequired,
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

export const recordTechnicianBreedingObservation = async (req, res) => {
  try {
    if (req.user?.role !== "technician") {
      return res.status(403).json({
        message: "Only technicians can record breeding observations.",
        code: "UNAUTHORIZED_VERIFICATION",
      });
    }
    const { reportType, signs, notes, evidenceImageUrl, evidencePhotos, source } = req.body;

    if (!['possible_pregnancy', 'return_to_heat', 'unsure', 'unable_to_contact'].includes(reportType)) {
      return res.status(400).json({ message: 'Invalid reportType.' });
    }
    const request = await Insemination.findById(req.params.id)
      .populate('animalId', 'species earTag farmerId reproductiveStatus activityLogs')
      .populate('technicianId')
      .populate('approvedBy');

    if (!request) {
      return res.status(404).json({ message: 'AI Request not found.' });
    }

    // 1. Domain-level terminal guard based on AI attempt
    if (request.outcomeVerificationStatus === 'verified' && request.outcome !== 'Pending') {
      return res.status(409).json({
        code: "AI_ATTEMPT_ALREADY_TERMINAL",
        message: "This AI attempt has already reached a terminal reproductive outcome.",
      });
    }

    // 2. Add backend duplicate-submission guard
    const existingTask = await Task.findOne({
      taskType: "BreedingFollowUp",
      "metadata.inseminationId": buildInseminationIdMatch(request._id),
    });
    assertPregnancyMutationAuthority({
      actor: req.user,
      task: existingTask,
      insemination: request,
      allowUnassignedTaskClaim: false,
    });

    if (existingTask && ["Completed", "Cancelled", "Rejected"].includes(existingTask.status)) {
      return res.status(409).json({
        code: "BREEDING_FOLLOWUP_ALREADY_RESOLVED",
        message: "This breeding follow-up has already been resolved."
      });
    }

    // 3. Prevent performing scheduled BreedingFollowUp tasks before their due date
    if (existingTask && existingTask.status === "Pending" && existingTask.dueDate && new Date(existingTask.dueDate) > new Date()) {
      return res.status(409).json({
        code: "BREEDING_FOLLOWUP_NOT_DUE",
        message: "This scheduled breeding follow-up is not due yet."
      });
    }

    if (reportType === 'unable_to_contact') {
      const task = await Task.findOneAndUpdate(
        {
          taskType: "BreedingFollowUp",
          "metadata.inseminationId": request._id,
          status: { $nin: ["Completed", "Cancelled", "Rejected"] },
        },
        {
          $set: {
            status: "Completed",
            completedAt: new Date(),
            notes: `Unable to contact farmer. Notes: ${notes || "None"}`,
            "metadata.followUpResolution": "unable_to_contact",
            "metadata.reportType": "unable_to_contact",
          }
        },
        { returnDocument: "after" }
      );

      return res.status(200).json({
        message: 'Unable to contact recorded. Follow-up closed.',
        task
      });
    }

    const isVerified =
      request.verificationStatus === 'verified' ||
      request.verificationStatus === 'rejected' ||
      request.outcomeVerificationStatus === 'verified';

    if (request.farmerOutcomeReport && request.observationSource === 'farmer' && isVerified) {
      return res.status(409).json({
        message: 'This observation has already been reviewed by a technician and cannot be modified.',
        code: 'OBSERVATION_ALREADY_VERIFIED',
      });
    }

    const animal = await Animal.findById(request.animalId?._id || request.animalId);
    if (!animal) {
      return res.status(404).json({ message: 'Animal not found.' });
    }

    const photos = Array.isArray(evidencePhotos)
      ? evidencePhotos.filter(Boolean)
      : evidenceImageUrl
        ? [evidenceImageUrl]
        : [];

    // 4. Technician "Returned to heat" must be terminal
    if (reportType === 'return_to_heat') {
      const verification = await persistBreedingObservationVerification({
        animal,
        insemination: request,
        verificationResult: "return_to_heat",
        checkMethod: "visual_observation",
        checkedAt: new Date(),
        technicianNotes: notes,
        nextCheckDate: null,
        evidencePhotos: photos,
        actor: req.user,
        taskId: existingTask?._id,
      });

      // Clean up any Pending reproductive tasks (like PD) according to the policy
      await cancelPendingReproductiveTasksForInsemination({
        inseminationId: request._id,
        taskTypes: ["BreedingFollowUp", "PD"],
        reason: "Cancelled because attempt terminally failed (return to heat).",
      });

      return res.status(200).json({
        message: "Return to heat authoritatively recorded.",
        request: verification.request,
        animal: verification.animal,
        task: verification.task,
        nextAction: verification.nextAction,
      });
    }

    const policyResolution = await loadPregnancyConfirmationPolicy();
    const pregnancyReadiness = getPregnancyCheckReadiness({
      insemination: request,
      policy: policyResolution.policy,
      species: animal.species,
    });

    const observationReportedAt = new Date();
    request.farmerOutcomeReport = reportType;
    request.farmerOutcomeReportedAt = observationReportedAt;
    request.farmerObservationSigns = Array.isArray(signs) ? signs : [];
    request.farmerObservationNotes = notes || '';
    request.evidencePhotos = photos;
    request.observationSource = 'technician';
    request.observationRecordedBy = req.user._id;

    // Follow-up adjustment (temporarily reusing the existing logic until BreedingFollowUp task is fully separated)
    const followUp = await ensureBreedingObservationFollowUpTask({
      request,
      farmerId: animal.farmerId,
      animalId: animal._id,
      technicianId: req.user._id,
      reportType,
      signs,
      notes,
      pregnancyReadiness,
      at: observationReportedAt,
    });

    // Technician observations act as authoritative, so the task should be completed
    if (followUp && followUp.task) {
      await Task.updateOne(
        { _id: followUp.task._id },
        {
          $set: {
            status: "Completed",
            completedAt: new Date(),
          }
        }
      );
    }

    const verificationTask = followUp.task;
    const technicianVerificationRequired = followUp.technicianActionRequired;
    request.verificationRequested = technicianVerificationRequired;
    request.verificationStatus = followUp.verificationStatus;

    let nextAction = 'Observation saved.';

    if (reportType === 'possible_pregnancy') {
      request.outcomeVerificationStatus = 'reported';
      // 3. Stop Technician observations from becoming fake farmer observations
      // request.outcomeConfirmationSource = 'farmer_possible_pregnancy';
      nextAction = technicianVerificationRequired
        ? 'Possible pregnancy signs recorded. Technician follow-up is available now.'
        : 'Possible pregnancy signs recorded. Pregnancy confirmation will follow the existing readiness schedule.';
    }

    if (reportType === 'unsure') {
      request.outcomeVerificationStatus = 'pending';
      request.outcomeConfirmationSource = null;
      request.outcomeConfirmedBy = null;
      request.outcomeConfirmedAt = null;
      nextAction = 'Observation saved. Continue monitoring the animal.';
    }

    request.statusHistory = request.statusHistory || [];
    request.statusHistory.push({
      status: 'technician_observation_recorded',
      note: `Technician recorded observation: ${reportType} via ${source || 'technician'}.`,
      actorId: req.user._id,
      createdAt: new Date(),
    });

    animal.activityLogs = animal.activityLogs || [];
    animal.activityLogs.push({
      event: 'Breeding Observation Recorded',
      date: new Date(),
      description: `Technician recorded observation: ${reportType}. ${notes || ''}`.trim(),
    });

    await Promise.all([
      request.save(),
      animal.save(),
      createTimelineEvent({
        animalId: animal._id,
        eventType: 'technician_breeding_observation_recorded',
        actorId: req.user._id,
        sourceType: 'Insemination',
        sourceId: request._id,
        title: 'Breeding observation recorded',
        summary: `${reportType.replaceAll('_', ' ')}${notes ? `: ${notes}` : ''}`,
        attachments: photos,
        metadata: {
          reportType,
          source,
          signs: Array.isArray(signs) ? signs : [],
          technicianFollowUpRequired: technicianVerificationRequired,
          verificationTaskId: verificationTask?._id,
        },
      }),
      createAuditLog({
        entityType: 'Insemination',
        entityId: request._id,
        action: 'technician_breeding_observation_recorded',
        actorId: req.user._id,
        after: {
          farmerOutcomeReport: reportType,
          observationSource: source,
          observationRecordedBy: req.user._id,
        },
      }),
    ]);

    return res.status(200).json({
      message: 'Technician observation successfully recorded.',
      data: {
        request,
        animal,
        verificationTask,
        nextAction,
      },
    });
  } catch (error) {
    console.error('Record technician breeding observation error:', error);
    res.status(error.status || 500).json({
      message: error.message || 'Internal server error.',
      code: error.code,
    });
  }
};

// POST /api/ai-request/:id/farmer-pregnancy-report
export const submitFarmerPregnancyReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes = "", evidencePhotos = [], evidenceImageUrl } = req.body;

    if (req.user.role !== "farmer") {
      return res.status(403).json({
        message: "Only farmers can submit pregnancy reports.",
        code: "FARMER_ONLY_REPORT",
      });
    }

    const request = await Insemination.findOne({ _id: id, deletedAt: null }).populate("animalId");
    if (!request) return res.status(404).json({ message: "AI request record not found." });

    assertAIRequestAccess(req.user, request);

    if (request.farmerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You can only report pregnancy for your own animal.",
        code: "OBSERVATION_OWNER_MISMATCH",
      });
    }

    if (request.status !== "done") {
      return res.status(400).json({
        message: "Pregnancy reports can only be submitted after an AI service has been authoritatively performed.",
        code: "AI_NOT_COMPLETED",
      });
    }

    if (!request.inseminationDate) {
      return res.status(400).json({
        message: "The AI service is missing a canonical insemination date.",
        code: "AI_NOT_COMPLETED",
      });
    }

    if (request.outcome === "Pregnant" || request.outcome === "Failed" || request.isSuccess !== null || request.outcomeVerificationStatus === "verified") {
      return res.status(409).json({
        message: "This AI attempt has already been authoritatively resolved.",
        code: "AI_ALREADY_RESOLVED",
      });
    }

    if (request.farmerPregnancyReport && request.pregnancyReportVerificationStatus === "pending") {
      return res.status(409).json({
        message: "A pregnancy report is already pending technician review.",
        code: "PREGNANCY_REPORT_ALREADY_PENDING",
      });
    }

    const animal = await Animal.findById(request.animalId?._id || request.animalId);
    if (!animal) return res.status(404).json({ message: "Animal not found." });

    if (animal.reproductiveStatus === "Pregnant") {
      return res.status(409).json({
        message: "This animal already has an authoritative pregnancy recorded.",
        code: "ANIMAL_ALREADY_PREGNANT",
      });
    }

    const photos = Array.isArray(evidencePhotos) ? evidencePhotos.filter(Boolean) : (evidenceImageUrl ? [evidenceImageUrl] : []);

    request.farmerPregnancyReport = true;
    request.farmerPregnancyReportedAt = new Date();
    request.farmerPregnancyNotes = notes || "";
    request.farmerPregnancyPhotos = photos;
    request.pregnancyReportVerificationStatus = "pending";

    console.log("----- PREGNANCY REPORT TRACE -----");
    console.log("request.params.id:", id);
    console.log("request._id:", request._id.toString());
    console.log("request.collection.name:", request.collection.name);
    console.log("BEFORE save:");
    console.log("farmerPregnancyReport:", request.farmerPregnancyReport);
    console.log("pregnancyReportVerificationStatus:", request.pregnancyReportVerificationStatus);
    console.log("farmerPregnancyNotes:", request.farmerPregnancyNotes);
    console.log("farmerPregnancyPhotos.length:", request.farmerPregnancyPhotos?.length);

    await Promise.all([
      request.save(),
      createTimelineEvent({
        animalId: animal._id,
        eventType: "farmer_breeding_observation_reported",
        actorId: req.user._id,
        sourceType: "Insemination",
        sourceId: request._id,
        title: "Farmer reported pregnancy",
        summary: `Pregnancy report submitted with evidence.`,
        attachments: photos,
        metadata: { isPregnancyReport: true },
      }),
    ]);

    const refetched = await Insemination.findById(request._id);
    console.log("AFTER save/refetch:");
    console.log("farmerPregnancyReport:", refetched?.farmerPregnancyReport);
    console.log("pregnancyReportVerificationStatus:", refetched?.pregnancyReportVerificationStatus);
    console.log("farmerPregnancyNotes:", refetched?.farmerPregnancyNotes);
    console.log("farmerPregnancyPhotos.length:", refetched?.farmerPregnancyPhotos?.length);
    console.log("----------------------------------");

    res.status(200).json({
      message: "Pregnancy report saved and sent for technician review.",
      data: { request },
    });
  } catch (error) {
    console.error("[submitFarmerPregnancyReport ERROR]", error.message);
    res.status(error.status || 500).json({
      message: error.message || "Failed to submit pregnancy report.",
      code: error.code || "PREGNANCY_REPORT_FAILED",
    });
  }
};

// POST /api/ai-request/:id/verify-pregnancy-report
export const verifyFarmerPregnancyReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    if (req.user.role !== "technician") {
      return res.status(403).json({
        message: "Only technicians can verify pregnancy reports.",
        code: "UNAUTHORIZED_VERIFICATION",
      });
    }

    if (!["request_more_info", "accept"].includes(action)) {
      return res.status(400).json({ message: "Invalid verification action." });
    }

    const request = await Insemination.findOne({ _id: id, deletedAt: null }).populate("animalId");
    if (!request) return res.status(404).json({ message: "AI request record not found." });

    const reviewTask = await Task.findOne({
      taskType: { $in: ["PD", "BreedingFollowUp"] },
      status: { $nin: ["Completed", "Cancelled", "Rejected"] },
      $or: [
        ...(request.verificationTaskId
          ? [{ _id: request.verificationTaskId }]
          : []),
        { "metadata.inseminationId": request._id },
      ],
    }).sort({ dueDate: 1, createdAt: 1 });
    assertPregnancyMutationAuthority({
      actor: req.user,
      task: reviewTask,
      insemination: request,
      allowUnassignedTaskClaim: false,
    });

    if (!request.farmerPregnancyReport || request.pregnancyReportVerificationStatus !== "pending") {
      return res.status(400).json({
        message: "There is no pending farmer pregnancy report to verify.",
        code: "NO_PENDING_REPORT",
      });
    }

    const animal = await Animal.findById(request.animalId?._id || request.animalId);
    if (!animal) return res.status(404).json({ message: "Animal not found." });

    if (action === "request_more_info") {
      request.pregnancyReportVerificationStatus = "more_info_requested";
      request.pregnancyReportReviewedBy = req.user._id;
      request.pregnancyReportReviewedAt = new Date();

      await Promise.all([
        request.save(),
        createTimelineEvent({
          animalId: animal._id,
          eventType: "pregnancy_check_requested", // existing event type fits OK or custom
          actorId: req.user._id,
          sourceType: "Insemination",
          sourceId: request._id,
          title: "Technician requested more info",
          summary: "More information was requested for the farmer pregnancy report.",
        }),
      ]);

      return res.status(200).json({
        message: "Requested more information from the farmer.",
        data: { request },
      });
    }

    if (action === "accept") {
      return res.status(400).json({
        message: "Direct acceptance of farmer pregnancy reports is deprecated. Please use the professional pregnancy diagnosis workflow (PD Task).",
        code: "DEPRECATED_WORKFLOW",
      });
    }
  } catch (error) {
    console.error("[verifyFarmerPregnancyReport ERROR]", error.message);
    res.status(error.status || 500).json({
      message: error.message || "Failed to verify pregnancy report.",
      code: error.code || "PREGNANCY_VERIFICATION_FAILED",
    });
  }
};

// DELETE /api/ai-request/:id
export const deleteRequest = async (req, res) => {
  try {
    await archiveInseminationAsAdmin({
      id: req.params.id,
      actor: req.user,
    });

    req.app.get("io").emit("dashboardUpdate", {
      type: "AI_REQUEST_DELETED",
      message: "An AI request was archived by an administrator",
    });

    res.status(200).json({
      message: "Insemination record soft-deleted successfully",
    });
  } catch (error) {
    console.error("[deleteRequest ERROR]", error.message);
    res.status(error.status || 500).json({
      message: error.message || "Failed to archive AI request.",
      code: error.code,
    });
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
      status: { $in: ["scheduled", "in-progress"] },
      scheduledDate: { $ne: null },
    })
      .sort({ scheduledDate: 1 })
      .limit(10)
      .populate("animalId", "animalId earTag species breed")
      .populate("approvedBy", "name")
      .lean();

    // =========================
    // HEALTH REQUESTS
    // =========================
    const healthRequests = await HealthRequest.find({
      farmerId,
      deletedAt: null,
      status: { $in: ["scheduled", "in-progress", "in_progress"] },
      scheduledDate: { $ne: null },
      handlingMethod: { $nin: ["advice", "office_pickup"] },
    })
      .sort({ scheduledDate: 1 })
      .limit(10)
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
      scheduledDate: r.scheduledDate,
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
      scheduledDate: r.scheduledDate,
      visitPeriod: r.visitPeriod,
      technician: r.handledBy?.name || null,
      createdAt: r.createdAt,
    }));

    // =========================
    // MERGE + SORT
    // =========================
    const merged = [...ai, ...health].sort((a, b) => {
      return new Date(a.scheduledDate) - new Date(b.scheduledDate);
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

const safeCandidateText = (value) =>
  typeof value === "string" ? value.trim() : "";

export const buildCandidateAIDetail = (request) => {
  const farmer =
    request?.farmerId && typeof request.farmerId === "object"
      ? request.farmerId
      : {};
  const address =
    farmer.address && typeof farmer.address === "object" ? farmer.address : {};
  const dispatchLocation = request?.dispatch?.location || {};
  const previousAttempt =
    request?.previousAttemptId && typeof request.previousAttemptId === "object"
      ? request.previousAttemptId
      : null;

  return {
    id: request._id,
    _id: request._id,
    workflowId: request._id,
    workflowType: "AI",
    allowedAction: "CLAIM_AND_SCHEDULE",
    actionLabel: "Accept & Set Visit",
    type: request.type,
    serviceType: "Artificial Insemination",
    requestKind: request.previousAttemptId ? "re_insemination" : "initial_ai",
    attemptNumber: request.attemptNumber || 1,
    previousAttemptId: previousAttempt
      ? {
          _id: previousAttempt._id,
          attemptNumber: previousAttempt.attemptNumber,
          inseminationDate: previousAttempt.inseminationDate,
          outcome: previousAttempt.outcome,
          outcomeVerificationStatus: previousAttempt.outcomeVerificationStatus,
          outcomeConfirmationSource: previousAttempt.outcomeConfirmationSource,
          outcomeConfirmedAt: previousAttempt.outcomeConfirmedAt,
        }
      : request.previousAttemptId || null,
    status: request.status,
    urgency: request.urgency,
    preferredDate: request.preferredDate,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    heatSigns: request.heatSigns,
    farmerNotes: safeCandidateText(request.comment),
    comment: safeCandidateText(request.comment),
    imageUrl: safeCandidateText(request.imageUrl),
    animalId: request.animalId,
    farmerName: safeCandidateText(farmer.name),
    municipality:
      safeCandidateText(dispatchLocation.municipalityName) ||
      safeCandidateText(address.administrativeArea?.municipalityName) ||
      safeCandidateText(address.municipality) ||
      safeCandidateText(address.city),
    barangay:
      safeCandidateText(dispatchLocation.barangayName) ||
      safeCandidateText(address.administrativeArea?.barangayName) ||
      safeCandidateText(address.barangay),
  };
};

export const buildTechnicianCandidateAIDetail = (request) => {
  const candidate = buildCandidateAIDetail(request);
  const farmer =
    request?.farmerId && typeof request.farmerId === "object"
      ? request.farmerId
      : {};

  return {
    ...candidate,
    farmerId: {
      _id: farmer._id,
      name: safeCandidateText(farmer.name),
      phoneNumber: safeCandidateText(farmer.phoneNumber),
      imageUrl: safeCandidateText(farmer.imageUrl),
      address: farmer.address || null,
      farmLocation: farmer.farmLocation || null,
    },
  };
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
          "farmerId",
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

    if (
      req.user.role === "farmer" &&
      String(request.farmerId?._id || request.farmerId) !== String(req.user._id)
    ) {
      return res.status(403).json({
        message: "You can only view your own AI requests.",
        code: "AI_REQUEST_ACCESS_DENIED",
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

    requestObj.status = normalizeAIStatus(requestObj.status);
    requestObj.requestKind =
      requestObj.previousAttemptId || Number(requestObj.attemptNumber) > 1
        ? "re_insemination"
        : "initial_ai";

    requestObj.nextAction = nextAction;
    requestObj.nextActionAt = nextAction?.at || null;

    if (req.user.role === "technician") {
      const isAssignedToMe =
        requestObj.approvedBy?._id?.toString() === req.user._id.toString() ||
        requestObj.technicianId?._id?.toString() === req.user._id.toString();

      if (!isUnclaimed && !isAssignedToMe) {
        return res.status(403).json({
          message: "Request is assigned to another technician.",
          code: "AI_REQUEST_ASSIGNED_TO_OTHER",
        });
      }

      if (isUnclaimed) {
        return res
          .status(200)
          .json(buildTechnicianCandidateAIDetail(requestObj));
      }
    }

    if (
      isUnclaimed &&
      !isOwnFarmer &&
      req.user.role !== "admin" &&
      req.user.role !== "technician"
    ) {
      return res.status(200).json(buildCandidateAIDetail(requestObj));
    }

    if (isFarmerRole) {
      return res.status(200).json({
        data: buildFarmerAIRequest(requestObj),
      });
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

    let request = await Insemination.findOne({ _id: id, deletedAt: null })
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
    if (isTechnician) {
      assertAIRequestMutationOwnership(actor, request);
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
    const actorGuard = isFarmer
      ? { farmerId: actor._id }
      : isTechnician
        ? buildAIRequestMutationOwnershipGuard({ technicianId: actor._id })
        : {};
    request = await Insemination.findOneAndUpdate(
      {
        _id: id,
        deletedAt: null,
        status: previousStatus,
        ...actorGuard,
      },
      {
        $set: {
          status: "cancelled",
          cancellationReason: reason?.trim() || "",
          cancelledBy: actor._id,
          cancellationRequestedAt: now,
          cancellationStatus: "approved",
        },
        $unset: { activeRequestKey: 1 },
        $push: {
          statusHistory: {
            status: "cancelled",
            note: reason?.trim() || `Cancelled by ${role}`,
            actorId: actor._id,
          },
        },
      },
      { returnDocument: "after" },
    )
      .populate("farmerId", "name pushToken")
      .populate("animalId", "earTag animalId")
      .populate("approvedBy", "name pushToken")
      .populate("technicianId", "name pushToken");
    if (!request) {
      return res.status(409).json({
        message:
          "The request changed or is no longer assigned to you. Refresh and try again.",
        code: "AI_CANCELLATION_CONCURRENT_UPDATE",
      });
    }

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
    return res.status(error.status || 500).json({
      message: error.message || "Failed to cancel AI request.",
      code: error.code,
    });
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

    let request = await Insemination.findOne({ _id: id, deletedAt: null })
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
    if (role === "technician") {
      assertAIRequestMutationOwnership(actor, request);
    }

    const farmer = request.farmerId;
    const animal = request.animalId;
    const animalTag = animal?.earTag || animal?.animalId || "the animal";
    const previousStatus = request.status;
    const responseGuard =
      role === "technician"
        ? buildAIRequestMutationOwnershipGuard({ technicianId: actor._id })
        : {};

    if (approved) {
      const respondedAt = new Date();
      request = await Insemination.findOneAndUpdate(
        {
          _id: id,
          deletedAt: null,
          status: previousStatus,
          cancellationStatus: "requested",
          ...responseGuard,
        },
        {
          $set: {
            status: "cancelled",
            cancellationStatus: "approved",
            cancellationResponseReason: reason?.trim() || "",
            cancellationRespondedAt: respondedAt,
          },
          $unset: { activeRequestKey: 1 },
          $push: {
            statusHistory: {
              status: "cancelled",
              note: reason?.trim() || `Cancellation approved by ${role}`,
              actorId: actor._id,
            },
          },
        },
        { returnDocument: "after" },
      )
        .populate("farmerId", "name pushToken")
        .populate("animalId", "earTag animalId")
        .populate("approvedBy", "name pushToken")
        .populate("technicianId", "name pushToken");
      if (!request) {
        return res.status(409).json({
          message: "The cancellation request changed. Refresh and try again.",
          code: "AI_CANCELLATION_RESPONSE_CONCURRENT_UPDATE",
        });
      }

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
      const respondedAt = new Date();
      request = await Insemination.findOneAndUpdate(
        {
          _id: id,
          deletedAt: null,
          status: previousStatus,
          cancellationStatus: "requested",
          ...responseGuard,
        },
        {
          $set: {
            cancellationStatus: "rejected",
            cancellationResponseReason: reason?.trim() || "",
            cancellationRespondedAt: respondedAt,
          },
          $push: {
            statusHistory: {
              status: "cancellation_rejected",
              note: reason?.trim() || `Cancellation rejected by ${role}`,
              actorId: actor._id,
            },
          },
        },
        { returnDocument: "after" },
      )
        .populate("farmerId", "name pushToken")
        .populate("animalId", "earTag animalId")
        .populate("approvedBy", "name pushToken")
        .populate("technicianId", "name pushToken");
      if (!request) {
        return res.status(409).json({
          message: "The cancellation request changed. Refresh and try again.",
          code: "AI_CANCELLATION_RESPONSE_CONCURRENT_UPDATE",
        });
      }

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
    return res.status(error.status || 500).json({
      message: error.message || "Failed to respond to cancellation request.",
      code: error.code,
    });
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

    if (req.user.role !== "technician") {
      return res.status(403).json({
        message: "Only technicians can verify breeding observations.",
        code: "UNAUTHORIZED_VERIFICATION",
      });
    }

    const validResults = [
      "pregnant",
      "not_pregnant",
      "return_to_heat",
      "cannot_confirm",
      "needs_recheck",
    ];
    if (!validResults.includes(verificationResult)) {
      return res.status(400).json({
        message: "Invalid verification result.",
        code: "INVALID_VERIFICATION_RESULT",
      });
    }

    const request = await Insemination.findOne({
      _id: id,
      deletedAt: null,
    }).populate("animalId");
    if (!request) {
      return res.status(404).json({ message: "AI request record not found." });
    }

    if (request.isSuccess === false || request.verificationStatus === "verified" || request.verificationStatus === "rejected") {
      return res.status(409).json({
        message: "This insemination attempt has already been resolved or verified.",
        code: "VERIFICATION_ALREADY_RESOLVED",
      });
    }

    assertAIRequestAccess(req.user, request);

    const isReturnToHeatObservationReview =
      request.farmerOutcomeReport === "return_to_heat";
    if (
      verificationResult === "cannot_confirm" &&
      !isReturnToHeatObservationReview
    ) {
      return res.status(400).json({
        message:
          "Cannot-confirm is only valid when reviewing a Farmer return-to-heat report.",
        code: "INVALID_VERIFICATION_CONTEXT",
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
    const reviewDecisionDoesNotRequireMethod =
      isReturnToHeatObservationReview &&
      ["return_to_heat", "cannot_confirm"].includes(verificationResult);
    if (
      !reviewDecisionDoesNotRequireMethod &&
      !validMethods.includes(checkMethod)
    ) {
      return res.status(400).json({
        message: "Please select a valid diagnostic method.",
        code: "INVALID_CHECK_METHOD",
      });
    }

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
        actor: req.user,
        taskId: taskId || request.verificationTaskId,
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
        title: isReturnToHeatObservationReview
          ? "Farmer Breeding Update Reviewed"
          : "Pregnancy Verification Completed",
        summary:
          `Recorded as ${verificationResult.replaceAll("_", " ")}${checkMethod ? ` via ${checkMethod}` : ""}. ${technicianNotes}`.trim(),
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
            : verificationResult === "return_to_heat"
              ? "return_to_heat_confirmed"
              : verificationResult === "needs_recheck"
                ? "continuation_recheck_due"
                : isReturnToHeatObservationReview
                  ? "breeding_observation_reviewed"
                  : "pregnancy_not_confirmed";
        const isConfirmedReturnToHeat = verificationResult === "return_to_heat";
        await notifyUser({
          recipient: farmer,
          recipientId: verifiedRequest.farmerId,
          senderId: req.user._id,
          type: "ai-request",
          category: isReturnToHeatObservationReview ? "ai" : "pregnancy",
          eventType,
          relatedId: isConfirmedReturnToHeat
            ? verifiedRequest._id
            : verifiedAnimal._id,
          linkType: isConfirmedReturnToHeat ? "record" : "animal",
          dedupeKey: `breeding-verification:${verifiedRequest._id}:${eventType}`,
          title: isReturnToHeatObservationReview
            ? "Breeding update reviewed"
            : "Pregnancy check updated",
          message: isReturnToHeatObservationReview
            ? verificationResult === "return_to_heat"
              ? `A technician confirmed the return-to-heat update for ${verifiedAnimal.earTag || verifiedAnimal.animalId}.`
              : `A technician reviewed the return-to-heat update for ${verifiedAnimal.earTag || verifiedAnimal.animalId} but could not confirm it.`
            : `The pregnancy check for ${verifiedAnimal.earTag || verifiedAnimal.animalId} has been recorded.`,
          metadata: {
            animalId: verifiedAnimal._id,
            animalTag: verifiedAnimal.earTag || verifiedAnimal.animalId,
            technicianName: req.user.name,
            ...(isReturnToHeatObservationReview
              ? {
                  inseminationId: verifiedRequest._id,
                  ...(isConfirmedReturnToHeat
                    ? {
                        recordId: verifiedRequest._id,
                        sourceId: verifiedRequest._id,
                        sourceKind: "insemination",
                        recordType: "insemination",
                      }
                    : {}),
                }
              : { requestId: verifiedRequest._id }),
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
