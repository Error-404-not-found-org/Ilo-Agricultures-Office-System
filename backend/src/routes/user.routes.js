import { Router } from "express";

import { createInvitedUser } from "../controllers/user.controllers.js";

import {
  protectedRoute,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = Router();

router.post("/create-invited-user", protectedRoute, requireRole(["admin", "technician"]), createInvitedUser);

export default router;
