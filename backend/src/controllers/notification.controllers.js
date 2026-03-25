import { Notification } from "../models/notification.model.js";
import { AIRequest } from "../models/ai-request.model.js";
import { HealthRequest } from "../models/health-request.model.js";

// GET /api/notifications
export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipientId: req.user._id })
      .populate("senderId", "name imageUrl role")
      .sort({ createdAt: -1 })
      .limit(50);
    res.status(200).json(notifications);
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
      await Notification.findByIdAndUpdate(notificationId, { isRead: true });
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
    const notification = await Notification.findById(id).populate("senderId", "name imageUrl role address");
    
    if (!notification) return res.status(404).json({ message: "Notification not found." });

    let relatedData = null;
    if (notification.type === "ai-request") {
      relatedData = await AIRequest.findById(notification.relatedId)
        .populate("animalId", "animalId earTag species breed imageUrl");
    } else if (notification.type === "health-request") {
      relatedData = await HealthRequest.findById(notification.relatedId)
        .populate("animalId", "animalId earTag species breed imageUrl");
    }

    res.status(200).json({ notification, relatedData });
  } catch (error) {
    console.error("[getNotificationDetails ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch notification details." });
  }
};
