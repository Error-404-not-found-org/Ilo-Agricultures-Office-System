import { Insemination } from "../models/insemination.model.js";
import { Animal } from "../models/animal.model.js";
import { User } from "../models/user.model.js";
import { Notification } from "../models/notification.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { inngest } from "../config/inngest.js";
import {
  calculateTargetCalvingDate,
  checkInseminationAgeEligibility,
} from "../utils/cattleCore.js";
import { getReproductionEligibility } from "../domain/reproduction-lifecycle.js";
import { createAuditLog } from "../services/audit.service.js";
import { createTimelineEvent } from "../services/animal-timeline.service.js";
import { assertAIRequestAccess } from "../policies/request.policy.js";
import { Task } from "../models/task.model.js";

// POST /api/ai-request
// Farmer submits an AI service request for one of their animals
export const createAIRequest = async (req, res) => {
  try {
    const farmerId = req.user._id;
    const { animalId, imageUrl, comment, heatSigns } = req.body;

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

    // The workflow guard considers active requests, pregnancy, and postpartum recovery.
    const existingActiveRequest = await Insemination.findOne({
      animalId,
      status: { $in: ["pending", "approved", "in-progress"] },
      deletedAt: null,
    });
    const activePregnancy = await Pregnancy.findOne({
      animalId,
      deletedAt: null,
      "pregnancyDiagnosis.result": "Pregnant",
    });
    const eligibility = getReproductionEligibility({
      animal,
      activeRequest: existingActiveRequest,
      activePregnancy,
    });
    if (!eligibility.eligible) {
      return res.status(400).json({
        message: eligibility.reason,
        code: eligibility.code,
        nextActionAt: eligibility.nextActionAt,
      });
    }

    // Calculate attempt number
    const lastAttempt = await Insemination.findOne({ animalId }).sort({
      attemptNumber: -1,
    });
    const attemptNumber = lastAttempt ? lastAttempt.attemptNumber + 1 : 1;

    const request = await Insemination.create({
      farmerId,
      animalId,
      imageUrl: imageUrl || "",
      comment: comment || "",
      heatSigns: heatSigns || [],
      preferredDate: req.body.preferredDate || new Date(),
      status: "pending",
      attemptNumber,
    });
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

      const techNotifs = technicians.map((t) =>
        Notification.create({
          recipientId: t._id,
          senderId: farmerId,
          type: "ai-request",
          relatedId: request._id,
          title: `📋 AI Request: Tag #${animal.earTag || animal.animalId}`,
          message: `Farmer ${req.user.name} requested AI service for a ${animal.species} (${animal.breed}). Preferred date: ${new Date(request.preferredDate).toLocaleDateString()}.`,
        }),
      );

      const adminNotifs = admins.map((a) =>
        Notification.create({
          recipientId: a._id,
          senderId: farmerId,
          type: "ai-request",
          relatedId: request._id,
          title: `[Summary] AI Request: Tag #${animal.earTag || animal.animalId}`,
          message: `Farmer ${req.user.name} submitted an AI request for a ${animal.species} (${animal.breed}).`,
        }),
      );

      await Promise.all([...techNotifs, ...adminNotifs]);

      // --- MOBILE PUSH NOTIFICATIONS TO TECHNICIANS ---
      for (const t of technicians) {
        if (t.pushToken) {
          await sendPushNotification(
            t.pushToken,
            `📋 AI Request: Tag #${animal.earTag || animal.animalId}`,
            `Farmer ${req.user.name} requested AI service for a ${animal.species} (${animal.breed}).`,
          );
        }
      }
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
    res
      .status(500)
      .json({ message: error.message || "Failed to submit AI request." });
  }
};

// GET /api/ai-request/my
export const getMyRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const farmerId = req.user._id;

    const query = { farmerId, deletedAt: null };
    if (status && status !== "all") query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [requests, total] = await Promise.all([
      Insemination.find(query)
        .populate("animalId", "animalId earTag species breed imageUrl")
        .populate("approvedBy", "name")
        .populate("technicianId", "name")
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
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json(requests);
  } catch (error) {
    console.error("[getAllRequests ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch AI requests." });
  }
};

import { sendPushNotification } from "../lib/push-notifications.js";

// PATCH /api/ai-request/:id/status
export const updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      technicianNote,
      scheduledDate,
      inseminationDate,
      sireBreed,
      sireCode,
      estrus,
    } = req.body;

    const VALID_STATUSES = [
      "pending",
      "approved",
      "rejected",
      "done",
      "in-progress",
      "scheduled",
    ];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const existing = await Insemination.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "AI request record not found." });
    }

    // Concurrency guard: check if already assigned to another technician
    if (
      existing.approvedBy &&
      existing.approvedBy.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      const assignedTech = await User.findById(existing.approvedBy);
      return res.status(403).json({
        message: `This request is already being assisted by technician: ${assignedTech?.name || "another technician"}.`,
      });
    }

    if (status === "done") {
      if (!sireBreed || !sireCode || !estrus) {
        return res.status(400).json({
          message: "Sire breed, sire code, and estrus type are required when completing AI.",
        });
      }
      const completedAt = inseminationDate ? new Date(inseminationDate) : new Date();
      if (Number.isNaN(completedAt.getTime())) {
        return res.status(400).json({ message: "Invalid insemination date." });
      }
      if (completedAt.getTime() > Date.now() + 5 * 60 * 1000) {
        return res.status(400).json({ message: "Completed AI date and time cannot be in the future." });
      }
    }

    const targetTechId = (req.user.role === "admin" && req.body.approvedBy) ? req.body.approvedBy : req.user._id;

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
      technicianNote: technicianNote || "",
      scheduledDate: scheduledDate || undefined,
      sireBreed,
      sireCode,
      estrus,
    };

    if (status === "done") {
      updateData.inseminationDate = inseminationDate
        ? new Date(inseminationDate)
        : new Date();
    }

    const request = await Insemination.findByIdAndUpdate(id, updateData, {
      returnDocument: "after",
    })
      .populate("farmerId", "name pushToken")
      .populate("animalId", "animalId earTag species");

    if (!request) {
      return res.status(404).json({ message: "AI request record not found." });
    }

    // --- TRIGGER NOTIFICATION TO FARMER ---
    try {
      if (request.farmerId && request.farmerId._id) {
        const title = "AI Request Update";
        let message = `Your AI request for animal ${request.animalId.earTag || request.animalId.animalId} status has been updated to: ${status}.`;

        if (status === "done") {
          message = `Great news! The artificial insemination for animal ${request.animalId.earTag || request.animalId.animalId} has been successfully completed today. Expected calving calculations are underway!`;
        } else if (
          status === "approved" ||
          status === "in-progress" ||
          status === "scheduled"
        ) {
          const schedDateStr = request.scheduledDate
            ? new Date(request.scheduledDate).toLocaleDateString()
            : "today";
          if (isRescheduled) {
            message = `your artificial insemination request for animal ${request.animalId.earTag || request.animalId.animalId} is rescheduled to ${schedDateStr} by technician : ${req.user.name}`;
          } else if (status === "scheduled") {
            message = `your artificial insemination request for animal ${request.animalId.earTag || request.animalId.animalId} is scheduled for ${schedDateStr} by technician : ${req.user.name}`;
          } else {
            message = `your artificial insemination request for animal ${request.animalId.earTag || request.animalId.animalId} is accepted by technician : ${req.user.name}`;
          }
        } else if (status === "rejected") {
          message = `Your AI request for animal ${request.animalId.earTag || request.animalId.animalId} was not approved. Note: ${technicianNote || "No details provided"}.`;
        }

        // 1. Database Notification (In-app)
        await Notification.create({
          recipientId: request.farmerId._id,
          senderId: req.user._id,
          type: "ai-request",
          relatedId: request._id,
          title,
          message,
        });

        // 2. Mobile Push Notification
        if (request.farmerId.pushToken) {
          await sendPushNotification(
            request.farmerId.pushToken,
            title,
            message,
            { requestId: request._id, type: "ai-request" },
          );
        }
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
      // 1. Immediately update Animal Status to "Inseminated" if done
      if (status === "done") {
        await Animal.findByIdAndUpdate(
          request.animalId._id || request.animalId,
          {
            reproductiveStatus: "Inseminated",
          },
        );
        console.log(
          `[Status Sync] Animal ${request.animalId} set to Inseminated via updateRequestStatus.`,
        );

        // Create follow-up Pregnancy Diagnosis task (60 days post-AI)
        try {
          const existingAutoTask = await Task.findOne({
            sourceType: "automatic_pd_followup",
            "metadata.inseminationId": id,
            status: { $nin: ["Completed", "Cancelled"] },
          });
          if (!existingAutoTask) {
            const aiBaseDate = new Date(request.inseminationDate || request.dateOfAI || request.completedAt || Date.now());
            const pdDueDate = new Date(aiBaseDate);
            pdDueDate.setDate(pdDueDate.getDate() + 60);
            await Task.create({
              technicianId: req.user._id,
              farmerId: request.farmerId?._id || request.farmerId,
              animalIds: [request.animalId?._id || request.animalId],
              taskType: "PD",
              category: "Follow-up",
              priority: 2,
              notes: `Scheduled Pregnancy Diagnosis (PD) follow-up for Animal Tag #${request.animalId?.earTag || request.animalId?.animalId || "Unknown"} — due ${pdDueDate.toLocaleDateString()} (60 days post-AI on ${aiBaseDate.toLocaleDateString()}).`,
              status: "Pending",
              dueDate: pdDueDate,
              sourceType: "automatic_pd_followup",
              metadata: { inseminationId: id },
            });
            console.log(
              `[Task Created] Scheduled PD follow-up for Insemination ${id}, due ${pdDueDate.toISOString()}`,
            );
          } else {
            console.log(
              `[Task Skipped] Auto PD follow-up already exists for Insemination ${id}`,
            );
          }
        } catch (taskErr) {
          console.error("Failed to create follow-up task:", taskErr.message);
        }
      }

      // 2. Trigger background automation
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
    res.status(500).json({ message: "Failed to update request status." });
  }
};

// PATCH /api/ai-request/:id/outcome
// Farmer confirms if the AI was successful (pregnant) or not (re-heat)
export const confirmAIOutcome = async (req, res) => {
  try {
    const { id } = req.params;
    const { isSuccess, note } = req.body; // isSuccess: boolean

    const request = await Insemination.findById(id).populate("animalId");
    if (!request) return res.status(404).json({ message: "Record not found." });

    assertAIRequestAccess(req.user, request);

    request.isSuccess = isSuccess;
    request.outcome = isSuccess ? "Pregnant" : "Failed (Re-heat)";
    request.technicianNote = note || request.technicianNote;
    await request.save();

    // Update Animal status
    const animal = await Animal.findById(request.animalId);
    if (animal) {
      if (isSuccess) {
        animal.reproductiveStatus = "Pregnant";
        const baseInsemDate = request.inseminationDate || request.createdAt;
        const calvingDate = calculateTargetCalvingDate(
          baseInsemDate,
          animal.species,
          undefined,
          animal.breed,
        );
        animal.expectedCalvingDate = calvingDate;

        // Spawn Pregnancy Record so it appears as PD in the Ledger
        const existingPd = await Pregnancy.findOne({
          inseminationId: request._id,
        });
        if (!existingPd) {
          await Pregnancy.create({
            animalId: animal._id,
            farmerId: req.user._id,
            inseminationId: request._id,
            pregnancyDiagnosis: {
              date: new Date(),
              result: "Pregnant",
            },
            targetCalvingDate: calvingDate,
            technicianNote: "Confirmed pregnant by farmer via mobile app.",
          });
        }

        // Trigger Inngest for Calving Reminder
        try {
          await inngest.send({
            name: "pregnancy/confirmed",
            data: {
              inseminationId: request._id,
              animalId: animal._id,
              farmerId: req.user._id,
            },
          });
        } catch (inngestErr) {
          console.error("[confirmAIOutcome INNGEST ERROR]", inngestErr.message);
        }
      } else {
        animal.reproductiveStatus = "In Heat";
        // Optional: clear expected calving date
        animal.expectedCalvingDate = undefined;

        // Spawn Empty Pregnancy Record so it appears as PD in the Ledger
        const existingPd = await Pregnancy.findOne({
          inseminationId: request._id,
        });
        if (!existingPd) {
          await Pregnancy.create({
            animalId: animal._id,
            farmerId: req.user._id,
            inseminationId: request._id,
            pregnancyDiagnosis: {
              date: new Date(),
              result: "Empty",
            },
            technicianNote:
              "Confirmed reheated (empty) by farmer via mobile app.",
          });
        }
      }

      animal.activityLogs = animal.activityLogs || [];
      animal.activityLogs.push({
        event: "AI Outcome Confirmed",
        date: new Date(),
        description: `Farmer confirmed AI outcome as: ${isSuccess ? "Pregnant" : "Failed (Re-heat)"}. Note: ${note || "None"}`,
      });
      await animal.save();
    }

    res.status(200).json({
      message: isSuccess
        ? "Congratulations! Pregnancy recorded."
        : "Record updated. You can now request a second attempt.",
      request,
      animal,
    });
  } catch (error) {
    console.error("[confirmAIOutcome ERROR]", error.message);
    res.status(500).json({ message: "Failed to confirm outcome." });
  }
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
      const aiDate = request.inseminationDate || request.dateOfAI || request.completedAt || request.createdAt;
      if (aiDate) {
        const daysSinceAI = Math.floor((Date.now() - new Date(aiDate).getTime()) / (1000 * 60 * 60 * 24));
        const minimumDays = reportType === "return_to_heat" ? 18 : 35;
        if (daysSinceAI < minimumDays) {
          return res.status(400).json({
            message: reportType === "return_to_heat"
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

    request.farmerOutcomeReport = reportType;
    request.farmerOutcomeReportedAt = new Date();
    request.farmerObservationSigns = Array.isArray(signs) ? signs : [];
    request.farmerObservationNotes = notes || "";
    request.evidencePhotos = photos;
    request.verificationRequested = Boolean(verificationRequested);
    request.verificationStatus = verificationRequested
      ? "pending"
      : "not_requested";

    let nextAction = "Observation saved.";

    if (reportType === "possible_pregnancy") {
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
      request.isSuccess = false;
      request.outcome = "Failed (Re-heat)";
      nextAction = verificationRequested
        ? "A technician follow-up task was queued for the return-to-heat observation."
        : "Return-to-heat observation saved. The animal is marked In Heat.";
    }

    if (reportType === "unsure") {
      nextAction = verificationRequested
        ? "A technician verification task was queued."
        : "Observation saved. Continue monitoring or request technician verification.";
    }

    let verificationTask = null;
    if (verificationRequested) {
      if (request.verificationTaskId) {
        verificationTask = await Task.findById(request.verificationTaskId);
      }

      if (!verificationTask) {
        verificationTask = await Task.create({
          farmerId: req.user._id,
          animalIds: [animal._id],
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
      note: `Farmer reported ${reportType}${verificationRequested ? " and requested verification" : ""}.`,
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
          verificationRequested: Boolean(verificationRequested),
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
          verificationRequested: Boolean(verificationRequested),
          verificationTaskId: verificationTask?._id,
          animalStatus: animal.reproductiveStatus,
        },
      }),
    ]);

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

    // --- SEND CANCELLED PUSH NOTIFICATION TO TECHNICIANS ---
    try {
      if (
        isOwner &&
        ["pending", "approved", "in-progress"].includes(request.status)
      ) {
        const technicians = await User.find({ role: "technician" });
        for (const t of technicians) {
          if (t.pushToken) {
            await sendPushNotification(
              t.pushToken,
              "❌ AI Request Cancelled",
              `${request.farmerId?.name} has cancelled the AI request for animal ${request.animalId?.earTag || request.animalId?.animalId}.`,
            );
          }
        }
      }
    } catch (notifyErr) {
      console.error("[Notification Trigger Error]", notifyErr.message);
    }

    await Insemination.findByIdAndUpdate(id, {
      $set: { deletedAt: new Date() },
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
    const request = await Insemination.findById(id)
      .populate("farmerId", "name address imageUrl phoneNumber farmLocation")
      .populate(
        "animalId",
        "animalId earTag species breed imageUrl reproductiveStatus birthDate",
      )
      .populate("approvedBy", "name role phoneNumber")
      .populate("technicianId", "name role phoneNumber");

    if (!request) {
      return res.status(404).json({ message: "AI request record not found." });
    }

    const isUnclaimed = !request.approvedBy;
    const isFarmerRole = req.user.role === "farmer";
    const isOwnFarmer = isFarmerRole && request.farmerId?._id?.toString() === req.user._id.toString();

    const requestObj = request.toObject();
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

    return res.status(200).json({ data: requestObj });
  } catch (error) {
    console.error("[getAIRequestDetail ERROR]", error.message);
    return res
      .status(500)
      .json({ message: "Failed to fetch AI request details." });
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
      return res
        .status(403)
        .json({
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
          return res
            .status(400)
            .json({
              message:
                "A reason is required to request cancellation of a scheduled visit.",
            });
        }
        request.cancellationStatus = "requested";
        request.cancellationReason = reason.trim();
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

        // Notify assigned tech
        try {
          if (assignedTech?._id) {
            await Notification.create({
              userId: assignedTech._id,
              title: "AI Cancellation Request",
              message: `${farmer?.name} requested cancellation of AI insemination visit for ${animalTag}${isReadyToday ? " (TODAY)" : ""}. Reason: ${reason.trim()}`,
              type: "cancellation_request",
              relatedId: request._id,
            });
          }
          if (assignedTech?.pushToken) {
            await sendPushNotification(
              assignedTech.pushToken,
              "⚠️ Cancellation Requested",
              `${farmer?.name} has requested to cancel the AI insemination visit for ${animalTag}.${isReadyToday ? " This visit is scheduled for TODAY." : ""} Reason: ${reason.trim()}`,
              { requestId: id, type: "AI" },
            );
          }
          // Notify admins
          const admins = await User.find({
            role: "admin",
            pushToken: { $exists: true, $ne: "" },
          });
          for (const admin of admins) {
            await Notification.create({
              userId: admin._id,
              title: "AI Cancellation Request",
              message: `${farmer?.name} requested cancellation of AI insemination visit for ${animalTag}${isReadyToday ? " (TODAY)" : ""}. Reason: ${reason.trim()}`,
              type: "cancellation_request",
              relatedId: request._id,
            });
          }
        } catch (notifyErr) {
          console.error("[cancelAIRequest notify ERROR]", notifyErr.message);
        }

        return res
          .status(200)
          .json({
            message:
              "Cancellation request submitted. Awaiting technician review.",
            cancellationStatus: "requested",
          });
      }

      // Farmer direct cancel: pending or approved
      if (!["pending", "approved"].includes(status)) {
        return res
          .status(400)
          .json({
            message: `Farmers cannot directly cancel a request with status: ${status}.`,
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
      if (isFarmer && assignedTech?.pushToken) {
        // Farmer cancelled pending/approved → notify assigned tech
        await sendPushNotification(
          assignedTech.pushToken,
          "❌ AI Request Cancelled",
          `${farmer?.name} cancelled the AI insemination request for ${animalTag}.`,
          { requestId: id, type: "AI" },
        );
      } else if (!isFarmer && farmer?.pushToken) {
        // Tech/Admin cancelled → notify farmer
        await sendPushNotification(
          farmer.pushToken,
          "❌ AI Request Cancelled",
          `Your AI insemination request for ${animalTag} was cancelled by the ${role}. ${reason?.trim() ? `Reason: ${reason.trim()}` : ""}`,
          { requestId: id, type: "AI" },
        );
        if (isAdmin && assignedTech?.pushToken) {
          await sendPushNotification(
            assignedTech.pushToken,
            "❌ AI Request Cancelled (Admin Override)",
            `Admin cancelled the AI insemination for ${animalTag}. ${reason?.trim() ? `Reason: ${reason.trim()}` : ""}`,
            { requestId: id, type: "AI" },
          );
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
      return res
        .status(403)
        .json({
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
      return res
        .status(400)
        .json({
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

      // Notify farmer
      if (farmer?.pushToken) {
        await sendPushNotification(
          farmer.pushToken,
          "✅ Cancellation Approved",
          `Your cancellation request for the AI insemination of ${animalTag} has been approved.`,
          { requestId: id, type: "AI" },
        );
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

      // Notify farmer
      if (farmer?.pushToken) {
        await sendPushNotification(
          farmer.pushToken,
          "❌ Cancellation Request Rejected",
          `Your cancellation request for the AI insemination of ${animalTag} was not approved.${reason?.trim() ? ` Reason: ${reason.trim()}` : ""}`,
          { requestId: id, type: "AI" },
        );
      }

      // Reset to "none" so they can request again after a brief rejection
      setTimeout(async () => {
        await Insemination.findByIdAndUpdate(id, {
          cancellationStatus: "none",
        });
      }, 5000);

      return res
        .status(200)
        .json({ message: "Cancellation rejected. Farmer has been notified." });
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

    // Update Insemination fields
    request.verificationStatus =
      verificationResult === "needs_recheck" ? "pending" : "verified";
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    if (Array.isArray(evidencePhotos) && evidencePhotos.length > 0) {
      request.evidencePhotos = [
        ...(request.evidencePhotos || []),
        ...evidencePhotos,
      ];
    }

    let nextAction = "";
    let pregnancyRecordCreated = false;

    // Apply outcomes
    if (verificationResult === "pregnant") {
      request.isSuccess = true;
      request.outcome = "Pregnant";
      animal.reproductiveStatus = "Pregnant";

      const baseInsemDate = request.inseminationDate || request.createdAt;
      const calvingDate = calculateTargetCalvingDate(
        baseInsemDate,
        animal.species,
        undefined,
        animal.breed,
      );
      animal.expectedCalvingDate = calvingDate;

      // Spawn Pregnancy record only if no active pregnancy exists for this insemination
      const existingPd = await Pregnancy.findOne({
        inseminationId: request._id,
        deletedAt: null,
      });

      if (!existingPd) {
        const preg = await Pregnancy.create({
          animalId: animal._id,
          farmerId: request.farmerId,
          inseminationId: request._id,
          pregnancyDiagnosis: {
            date: checkedAt ? new Date(checkedAt) : new Date(),
            result: "Pregnant",
          },
          targetCalvingDate: calvingDate,
          technicianNote:
            technicianNotes || "Confirmed pregnant by technician.",
        });
        request.pregnancyId = preg._id;
        pregnancyRecordCreated = true;
      }

      // Trigger push notification calving reminder workflow
      try {
        await inngest.send({
          name: "pregnancy/confirmed",
          data: {
            inseminationId: request._id,
            animalId: animal._id,
            farmerId: request.farmerId,
          },
        });
      } catch (inngestErr) {
        console.error(
          "[verifyBreedingObservation INNGEST ERROR]",
          inngestErr.message,
        );
      }

      nextAction = "Pregnancy verified and recorded.";
    } else if (verificationResult === "not_pregnant") {
      request.isSuccess = false;
      request.outcome = "Failed (Negative PD)";
      animal.reproductiveStatus = "Normal";
      animal.expectedCalvingDate = undefined;
      nextAction = "Animal confirmed not pregnant. Status reset to Normal.";
    } else if (verificationResult === "return_to_heat") {
      request.isSuccess = false;
      request.outcome = "Failed (Re-heat)";
      animal.reproductiveStatus = "In Heat";
      animal.expectedCalvingDate = undefined;
      nextAction = "Return-to-heat verified. Animal is marked In Heat.";
    } else if (verificationResult === "needs_recheck") {
      // Keep Likely Pregnant status if already set, otherwise don't modify reproductiveStatus
      nextAction = "Recheck required. Follow-up task scheduled.";
    }

    // Task completion / creation
    let task = null;
    if (request.verificationTaskId) {
      task = await Task.findById(request.verificationTaskId);
    }

    if (verificationResult === "needs_recheck") {
      const notesString = `Pregnancy Check Recheck Required. Checked on: ${new Date(checkedAt || Date.now()).toLocaleDateString()}. Notes: ${technicianNotes || "None"}. Next check after: ${nextCheckDate ? new Date(nextCheckDate).toLocaleDateString() : "Not Specified"}`;
      if (task) {
        task.status = "Pending";
        task.notes = notesString;
        await task.save();
      } else {
        task = await Task.create({
          farmerId: request.farmerId,
          animalIds: [animal._id],
          taskType: "PD",
          category: "Follow-up",
          priority: 2,
          notes: notesString,
          status: "Pending",
        });
        request.verificationTaskId = task._id;
      }
    } else {
      // Final result - complete task
      if (task) {
        task.status = "Completed";
        task.notes = `Breeding outcome verified: ${verificationResult.replaceAll("_", " ")}. Checked method: ${checkMethod}. Notes: ${technicianNotes || "None"}`;
        await task.save();
      }
    }

    // Save Insemination & Animal updates
    await Promise.all([request.save(), animal.save()]);

    // Push entry to statusHistory on insemination
    request.statusHistory = request.statusHistory || [];
    request.statusHistory.push({
      status: "technician_verification",
      note: `Technician verified as: ${verificationResult.replaceAll("_", " ")} using ${checkMethod}. ${technicianNotes}`.trim(),
      actorId: req.user._id,
      createdAt: new Date(),
    });
    await request.save();

    // Log animal activity
    animal.activityLogs = animal.activityLogs || [];
    animal.activityLogs.push({
      event: "Pregnancy Verification Completed",
      date: new Date(),
      description:
        `Technician verified breeding observation outcome: ${verificationResult.replaceAll("_", " ")}. Method: ${checkMethod}. Notes: ${technicianNotes}`.trim(),
    });
    await animal.save();

    // Create timeline event
    await createTimelineEvent({
      animalId: animal._id,
      eventType: "technician_breeding_verification_recorded",
      occurredAt: checkedAt ? new Date(checkedAt) : new Date(),
      actorId: req.user._id,
      sourceType: "Insemination",
      sourceId: request._id,
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
    await createAuditLog({
      entityType: "Insemination",
      entityId: request._id,
      action: "verify_breeding_observation",
      actorId: req.user._id,
      before: beforeState,
      after: {
        verificationStatus: request.verificationStatus,
        isSuccess: request.isSuccess,
        outcome: request.outcome,
        animalStatus: animal.reproductiveStatus,
        verificationResult,
      },
      metadata: {
        checkMethod,
        technicianNotes,
      },
    });

    // Notify Farmer
    try {
      const farmer = await User.findById(request.farmerId);
      const title = `Pregnancy Check: ${verificationResult === "pregnant" ? "Pregnant 🍼" : verificationResult === "needs_recheck" ? "Recheck Scheduled ⏱️" : "Empty ❌"}`;
      let body = `Technician ${req.user.name} checked ${animal.earTag || animal.animalId} and determined: ${verificationResult.replaceAll("_", " ").toUpperCase()}.`;
      if (verificationResult === "needs_recheck" && nextCheckDate) {
        body += ` A follow-up recheck is scheduled for ${new Date(nextCheckDate).toLocaleDateString()}.`;
      }

      await Notification.create({
        recipientId: request.farmerId,
        senderId: req.user._id,
        type: "system",
        relatedId: animal._id,
        title,
        message: body,
      });

      if (farmer?.pushToken) {
        await sendPushNotification(farmer.pushToken, title, body, {
          requestId: request._id,
          type: "AI",
        });
      }
    } catch (notifErr) {
      console.error(
        "[verifyFarmerBreedingObservation Notification Error]",
        notifErr.message,
      );
    }

    res.status(200).json({
      message: "Breeding observation verified successfully.",
      data: {
        request,
        animal,
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
