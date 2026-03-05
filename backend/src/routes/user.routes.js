import { Router } from "express";
import { createInvitedUser, getUsers, syncUser } from "../controllers/user.controllers.js";
import { requireAuth } from "@clerk/express";

import {
  protectedRoute,
  requireRole,
} from "../middleware/auth.middleware.js";

const router = Router();

router.post("/create-invited-user", protectedRoute, requireRole(["admin", "technician"]), createInvitedUser);
router.get("/", protectedRoute, getUsers);
router.post("/sync-manual", requireAuth(), syncUser);

export default router;
