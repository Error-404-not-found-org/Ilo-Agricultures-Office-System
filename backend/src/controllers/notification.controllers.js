import { Notification } from "../models/notification.model.js";
import { Insemination } from "../models/insemination.model.js";
import { HealthRequest } from "../models/health-request.model.js";

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
    const existingNotif = await Notification.findOne({
      recipientId: userId,
      relatedId: request._id,
      title: /Overdue/i
    });
    if (!existingNotif) {
      const title = "⏰ Overdue AI Service Log";
      const body = `Your AI visit scheduled for ${new Date(request.scheduledDate).toLocaleDateString()} for Mr. ${request.farmerId?.name || 'Farmer'}'s cow (${request.animalId?.earTag || request.animalId?.animalId}) is uncompleted. Please mark it complete.`;
      await Notification.create({
        recipientId: userId,
        senderId: "000000000000000000000000",
        type: "ai-request",
        relatedId: request._id,
        title,
        message: body,
      });
    }
  }

  for (const request of pendingHealth) {
    const existingNotif = await Notification.findOne({
      recipientId: userId,
      relatedId: request._id,
      title: /Overdue/i
    });
    if (!existingNotif) {
      const title = "⏰ Overdue Health Visit Log";
      const body = `Your health visit scheduled for ${new Date(request.scheduledDate).toLocaleDateString()} for Mr. ${request.farmerId?.name || 'Farmer'}'s cow (${request.animalId?.earTag || request.animalId?.animalId}) is uncompleted. Please mark it complete.`;
      await Notification.create({
        recipientId: userId,
        senderId: "000000000000000000000000",
        type: "health-request",
        relatedId: request._id,
        title,
        message: body,
      });
    }
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
    const notification = await Notification.findById(id).populate("senderId", "name imageUrl role address");
    
    if (!notification) return res.status(404).json({ message: "Notification not found." });

    let relatedData = null;
    if (notification.type === "ai-request") {
      relatedData = await Insemination.findById(notification.relatedId)
        .populate("animalId", "animalId earTag species breed imageUrl")
        .populate("approvedBy", "name imageUrl role address");
    } else if (notification.type === "health-request") {
      relatedData = await HealthRequest.findById(notification.relatedId)
        .populate("animalId", "animalId earTag species breed imageUrl")
        .populate("handledBy", "name imageUrl role address");
    }

    res.status(200).json({ notification, relatedData });
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
