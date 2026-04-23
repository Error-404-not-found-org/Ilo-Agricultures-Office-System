import { Router } from "express";
import {
  createHealthRequest,
  getMyHealthRequests,
  getAllHealthRequests,
  updateHealthRequestStatus,
} from "../controllers/health-request.controllers.js";
import { protectedRoute } from "../middleware/auth.middleware.js";
import { requestLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

router.post("/", protectedRoute, requestLimiter, createHealthRequest);
router.get("/my", protectedRoute, getMyHealthRequests);
router.get("/", protectedRoute, getAllHealthRequests);
router.patch("/:id/status", protectedRoute, updateHealthRequestStatus);

export default router;
