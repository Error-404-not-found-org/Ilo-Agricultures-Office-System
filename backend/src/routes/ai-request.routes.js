import { Router } from "express";
import {
  createAIRequest,
  getMyRequests,
  getAllRequests,
  updateRequestStatus,
} from "../controllers/ai-request.controllers.js";
import { protectedRoute } from "../middleware/auth.middleware.js";

const router = Router();

// Farmer submits a new request
router.post("/", protectedRoute, createAIRequest);

// Farmer views their own requests
router.get("/my", protectedRoute, getMyRequests);

// Technician / Admin views all requests (filter by ?status=pending etc.)
router.get("/", protectedRoute, getAllRequests);

// Technician / Admin updates request status
router.patch("/:id/status", protectedRoute, updateRequestStatus);

export default router;
