import { Router } from "express";
import { Insemination } from "../models/insemination.model.js";

import {
  createInsemination,
  updateInsemination,
  getAllInseminations,
  getMyInseminations,
  deleteInsemination,
} from "../controllers/insemination.controllers.js";
import {
  protectedRoute,
  requireRole,
} from "../middleware/auth.middleware.js";
import { requestLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

router.post("/create-insemination", protectedRoute, requestLimiter, createInsemination);
router.get("/my", protectedRoute, getMyInseminations);
router.get(
  "/all",
  protectedRoute,
  requireRole(["technician", "veterinarian", "admin"]),
  getAllInseminations,
);
router.put(
  "/:id",
  protectedRoute,
  requireRole(["technician", "veterinarian", "admin"]),
  updateInsemination,
);
router.delete(
  "/:id",
  protectedRoute,
  requireRole(["technician", "admin"]),
  deleteInsemination,
);

export default router;
