import { Router } from "express";
import {
  createInvitedUser,
  getUsers,
  syncUser,
  getUserById,
  updateUser,
  getMe,
  markVerified,
  resendVerificationCode,
  getBreedingMilestones,
  getMyActivityFeed,
  updatePushToken,
  deleteUser,
} from "../controllers/user.controllers.js";
import { requireAuth } from "@clerk/express";

import { protectedRoute, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.post(
  "/create-invited-user",
  protectedRoute,
  requireRole(["admin", "technician"]),
  createInvitedUser,
);
router.get("/", protectedRoute, getUsers);
router.post("/sync-manual", requireAuth(), syncUser);
router.get("/me", protectedRoute, getMe);
router.get("/milestones", protectedRoute, getBreedingMilestones);
router.get("/activity", protectedRoute, getMyActivityFeed);

router.post("/push-token", protectedRoute, updatePushToken);
router.get("/:id", protectedRoute, getUserById);
router.put("/:id", protectedRoute, updateUser);
router.delete("/:id", protectedRoute, deleteUser);
router.post("/mark-verified", protectedRoute, markVerified);

export default router;
