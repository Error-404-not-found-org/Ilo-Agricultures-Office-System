import { Insemination } from "../models/insemination.model.js";
import { Animal } from "../models/animal.model.js";
import { User } from "../models/user.model.js";
import { Notification } from "../models/notification.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { inngest } from "../config/inngest.js";
import { calculateTargetCalvingDate } from "../utils/cattleCore.js";

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

    // --- DOUBLE REQUEST CONFIRMATION / DUPLICATE CHECK ---
    const existingActiveRequest = await Insemination.findOne({
      animalId,
      status: { $in: ["pending", "approved", "in-progress"] },
      deletedAt: null,
    });

    if (existingActiveRequest) {
      return res.status(400).json({
        message: `There is already an active request (${existingActiveRequest.status}) for ${animal.earTag || animal.animalId}. Please wait for the current visit to be completed.`,
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
    const { status } = req.query;
    const query = status ? { status, deletedAt: null } : { deletedAt: null };

    const requests = await Insemination.find(query)
      .populate("farmerId", "name address imageUrl")
      .populate("animalId", "animalId earTag species breed imageUrl")
      .populate("approvedBy", "name")
      .populate("technicianId", "name")
      .sort({ createdAt: -1 });

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
    const { status, technicianNote } = req.body;

    const VALID_STATUSES = [
      "pending",
      "approved",
      "rejected",
      "done",
      "in-progress",
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

    const isRescheduled =
      (existing.status === "approved" || existing.status === "in-progress") &&
      req.body.scheduledDate &&
      existing.scheduledDate &&
      new Date(existing.scheduledDate).getTime() !==
        new Date(req.body.scheduledDate).getTime();

    const updateData = {
      status,
      approvedBy: req.user._id,
      technicianNote: technicianNote || "",
      scheduledDate: req.body.scheduledDate || undefined,
    };

    if (status === "done") {
      updateData.inseminationDate = new Date();
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
        } else if (status === "approved" || status === "in-progress") {
          const schedDateStr = request.scheduledDate
            ? new Date(request.scheduledDate).toLocaleDateString()
            : "today";
          if (isRescheduled) {
            message = `you artificial insemination request for animal ${request.animalId.earTag || request.animalId.animalId} is rescheduled to ${schedDateStr} by technician : ${req.user.name}`;
          } else {
            message = `you artificial insemination request for animal ${request.animalId.earTag || request.animalId.animalId} is accepted by technician : ${req.user.name}`;
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

    // Permission check
    if (request.farmerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized." });
    }

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

    // Permission Check: Allow owner OR Technician
    const isOwner =
      request.farmerId &&
      request.farmerId._id.toString() === req.user._id.toString();
    const isTechnician = req.user.role === "technician";

    if (!isOwner && !isTechnician) {
      return res
        .status(403)
        .json({ message: "Unauthorized to delete this request." });
    }

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
