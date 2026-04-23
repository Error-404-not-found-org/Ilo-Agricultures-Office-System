import { Router } from "express";
import { getNotifications, markAsRead, getUnreadCount, getNotificationDetails, clearNotifications } from "../controllers/notification.controllers.js";
import { protectedRoute } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", protectedRoute, getNotifications);
router.patch("/mark-read", protectedRoute, markAsRead);
router.delete("/", protectedRoute, clearNotifications);
router.get("/unread-count", protectedRoute, getUnreadCount);
router.get("/:id", protectedRoute, getNotificationDetails);

export default router;
