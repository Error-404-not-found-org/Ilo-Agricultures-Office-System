import { Notification } from "../models/notification.model.js";
import { Insemination } from "../models/insemination.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { Animal } from "../models/animal.model.js";
import {
  presentNotificationCopy,
  presentNotificationDocument,
} from "../domain/notification-presentation.js";
import { buildFarmerHealthRequest } from "../domain/health-request-presentation.js";
import { evaluateTechnicianDispatchEligibility } from "../domain/geographic/eligibilityEvaluator.js";
import {
  notificationAuthorityId,
  resolveReproductiveNotificationTechnicians,
} from "../services/notification-recipient-authority.service.js";

const uniqueOwnerIds = (values) =>
  [...new Set(values.map(notificationAuthorityId).filter(Boolean))];

export const isRequestDetailAuthorized = ({ user, request, requestType }) => {
  if (!user || !request) return false;
  if (user.role === "admin") return true;
  if (user.role === "farmer") {
    return notificationAuthorityId(request.farmerId) === notificationAuthorityId(user._id);
  }
  if (user.role !== "technician") return false;

  const ownerValues =
    requestType === "HEALTH"
      ? [request.handledBy, request.assignedTechnicianId]
      : [request.approvedBy, request.technicianId];
  const ownerIds = uniqueOwnerIds(ownerValues);
  if (ownerIds.length > 0) {
    return (
      ownerIds.length === 1 &&
      ownerIds[0] === notificationAuthorityId(user._id)
    );
  }

  if (request.status !== "pending") return false;
  return evaluateTechnicianDispatchEligibility({
    technician: user,
    requestType,
    dispatchLocation: request.dispatch?.location || {},
    dispatchStage: request.dispatch?.stage || "local",
  }).eligible;
};

const farmerSafeAIRequest = (request) => {
  const source = request?.toObject ? request.toObject() : { ...(request || {}) };
  for (const key of [
    "technicianNote",
    "statusHistory",
    "dispatch",
    "activeRequestKey",
    "declinedByTechnicianIds",
  ]) {
    delete source[key];
  }
  return source;
};

const syncOverdueNotifications = async (userId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [pendingAI, pendingHealth] = await Promise.all([
    Insemination.find({
      status: { $in: ["approved", "in-progress"] },
      approvedBy: userId,
      scheduledDate: { $lt: today }
    }).populate("farmerId", "name").populate("animalId", "earTag animalId"),
    HealthRequest.find({
      status: { $in: ["approved", "in-progress"] },
      handledBy: userId,
      scheduledDate: { $lt: today }
    }).populate("farmerId", "name").populate("animalId", "earTag animalId")
  ]);

  for (const request of pendingAI) {
    const { title, message } = presentNotificationCopy({
      title: "AI service record overdue",
      message: `The AI visit scheduled for ${new Date(request.scheduledDate).toLocaleDateString()} for ${request.farmerId?.name || "the farmer"}'s animal (${request.animalId?.earTag || request.animalId?.animalId}) is not yet completed. Open the visit to record the result.`,
    });
    const dedupeKey = `overdue:ai:${request._id}:${userId}`;
    await Notification.findOneAndUpdate(
      { dedupeKey },
      {
        $setOnInsert: {
        recipientId: userId,
        senderId: "000000000000000000000000",
        type: "ai-request",
        relatedId: request._id,
        title,
        message,
        category: "reminder",
        eventType: "service_overdue",
        linkType: "request",
        dedupeKey,
        metadata: {
          requestId: request._id,
          serviceType: "ai",
          animalTag: request.animalId?.earTag || request.animalId?.animalId,
        },
        },
      },
      { upsert: true, returnDocument: "after" },
    );
  }

  for (const request of pendingHealth) {
    const { title, message } = presentNotificationCopy({
      title: "Health assistance record overdue",
      message: `The health visit scheduled for ${new Date(request.scheduledDate).toLocaleDateString()} for ${request.farmerId?.name || "the farmer"}'s animal (${request.animalId?.earTag || request.animalId?.animalId}) is not yet completed. Open the visit to record the result.`,
    });
    const dedupeKey = `overdue:health:${request._id}:${userId}`;
    await Notification.findOneAndUpdate(
      { dedupeKey },
      {
        $setOnInsert: {
        recipientId: userId,
        senderId: "000000000000000000000000",
        type: "health-request",
        relatedId: request._id,
        title,
        message,
        category: "reminder",
        eventType: "service_overdue",
        linkType: "request",
        dedupeKey,
        metadata: {
          requestId: request._id,
          serviceType: "health",
          animalTag: request.animalId?.earTag || request.animalId?.animalId,
        },
        },
      },
      { upsert: true, returnDocument: "after" },
    );
  }
};

// GET /api/notifications
export const getNotifications = async (req, res) => {
  try {
    // Only generate reminders for technicians
    if (req.user.role === "technician") {
      await syncOverdueNotifications(req.user._id);
    }

    const notifications = await Notification.find({ recipientId: req.user._id })
      .populate("senderId", "name imageUrl role")
      .sort({ createdAt: -1 })
      .limit(50);
    res.status(200).json(notifications.map(presentNotificationDocument));
  } catch (error) {
    console.error("[getNotifications ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch notifications." });
  }
};

// PATCH /api/notifications/mark-read
export const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.body || {};
    
    if (notificationId) {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, recipientId: req.user._id },
        { $set: { isRead: true } },
        { returnDocument: "after" },
      );
      if (!notification) {
        return res.status(404).json({
          message: "Notification not found.",
          code: "NOTIFICATION_NOT_FOUND",
        });
      }
    } else {
      // Mark all as read for the current user
      await Notification.updateMany({ recipientId: req.user._id }, { isRead: true });
    }
    
    res.status(200).json({ message: "Notifications marked as read." });
  } catch (error) {
    console.error("[markAsRead ERROR]", error.message);
    res.status(500).json({ message: "Failed to update notifications." });
  }
};

// GET /api/notifications/unread-count
export const getUnreadCount = async (req, res) => {
  try {
    if (req.user.role === "technician") {
      await syncOverdueNotifications(req.user._id);
    }
    const count = await Notification.countDocuments({ 
      recipientId: req.user._id, 
      isRead: false 
    });
    res.status(200).json({ count });
  } catch (error) {
    console.error("[getUnreadCount ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch unread count." });
  }
};

// GET /api/notifications/:id
export const getNotificationDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOne({
      _id: id,
      recipientId: req.user._id,
    }).populate(
      "senderId",
      req.user.role === "farmer" ? "name imageUrl role" : "name imageUrl role address",
    );
    
    if (!notification) return res.status(404).json({ message: "Notification not found." });

    let relatedData = null;
    let relatedDataUnavailable = false;
    if (notification.type === "ai-request") {
      const requestId =
        notification.metadata?.requestId ||
        notification.metadata?.observationId ||
        notification.relatedId;
      const request = await Insemination.findById(requestId)
        .populate("farmerId", "name imageUrl role")
        .populate("animalId", "animalId earTag species breed imageUrl")
        .populate(
          "approvedBy technicianId",
          req.user.role === "farmer"
            ? "name imageUrl role"
            : "name imageUrl role address",
        );
      if (isRequestDetailAuthorized({
        user: req.user,
        request,
        requestType: "AI",
      })) {
        relatedData = req.user.role === "farmer"
          ? farmerSafeAIRequest(request)
          : request;
      } else if (request) {
        relatedDataUnavailable = true;
      }
    } else if (notification.type === "health-request") {
      const requestId = notification.metadata?.requestId || notification.relatedId;
      const request = await HealthRequest.findById(requestId)
        .populate("farmerId", "name imageUrl role")
        .populate("animalId", "animalId earTag species breed imageUrl")
        .populate(
          "handledBy assignedTechnicianId",
          req.user.role === "farmer"
            ? "name imageUrl role"
            : "name imageUrl role address",
        );
      if (isRequestDetailAuthorized({
        user: req.user,
        request,
        requestType: "HEALTH",
      })) {
        relatedData = req.user.role === "farmer"
          ? buildFarmerHealthRequest(request)
          : request;
      } else if (request) {
        relatedDataUnavailable = true;
      }
    } else if (notification.type === "system" && notification.linkType === "animal") {
      const animal = await Animal.findById(notification.relatedId)
        .select("animalId earTag species breed imageUrl farmerId");
      if (
        req.user.role === "admin" ||
        (req.user.role === "farmer" &&
          notificationAuthorityId(animal?.farmerId) ===
            notificationAuthorityId(req.user._id))
      ) {
        relatedData = animal;
      } else if (req.user.role === "technician" && animal) {
        const technicians = await resolveReproductiveNotificationTechnicians({
          pregnancyId: notification.metadata?.pregnancyId,
          inseminationId: notification.metadata?.inseminationId,
          calvingId: notification.metadata?.calvingId,
        });
        if (
          technicians.some(
            (technician) =>
              notificationAuthorityId(technician) ===
              notificationAuthorityId(req.user._id),
          )
        ) {
          relatedData = animal;
        } else {
          relatedDataUnavailable = true;
        }
      } else if (animal) {
        relatedDataUnavailable = true;
      }
    }

    res.status(200).json({
      notification: presentNotificationDocument(notification),
      relatedData,
      relatedDataUnavailable,
    });
  } catch (error) {
    console.error("[getNotificationDetails ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch notification details." });
  }
};

// DELETE /api/notifications
export const clearNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ recipientId: req.user._id });
    res.status(200).json({ message: "All notifications cleared." });
  } catch (error) {
    console.error("[clearNotifications ERROR]", error.message);
    res.status(500).json({ message: "Failed to clear notifications." });
  }
};
