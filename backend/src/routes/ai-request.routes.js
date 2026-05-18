import { Router } from "express";
import {
  createAIRequest,
  getMyRequests,
  getAllRequests,
  updateRequestStatus,
  confirmAIOutcome,
  deleteRequest,
} from "../controllers/ai-request.controllers.js";
import { protectedRoute } from "../middleware/auth.middleware.js";
import { requestLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

// Farmer submits a new request
router.post("/", protectedRoute, requestLimiter, createAIRequest);

// Farmer views their own requests
router.get("/my", protectedRoute, getMyRequests);

// Technician / Admin views all requests (filter by ?status=pending etc.)
router.get("/", protectedRoute, getAllRequests);

// Technician / Admin updates request status
router.patch("/:id/status", protectedRoute, updateRequestStatus);

// Farmer confirms AI outcome
router.patch("/:id/outcome", protectedRoute, confirmAIOutcome);

// Farmer removes/cancels a request
router.delete("/:id", protectedRoute, deleteRequest);

export default router;
