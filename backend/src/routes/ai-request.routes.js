import { Router } from "express";
import {
  createAIRequest,
  createReInseminationRequest,
  getMyRequests,
  getAllRequests,
  updateRequestStatus,
  confirmAIOutcome,
  submitFarmerBreedingObservation,
  verifyFarmerBreedingObservation,
  deleteRequest,
  getAIRequestDetail,
  cancelAIRequest,
  respondAICancellation,
} from "../controllers/ai-request.controllers.js";
import { protectedRoute, AdminOnly } from "../middleware/auth.middleware.js";
import { requestLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

// Farmer submits a new request
router.post("/", protectedRoute, requestLimiter, createAIRequest);
router.post("/:id/re-insemination", protectedRoute, requestLimiter, createReInseminationRequest);

// Farmer views their own requests
router.get("/my", protectedRoute, getMyRequests);

// Get single AI request detail
router.get("/:id", protectedRoute, getAIRequestDetail);

// Technician / Admin views all requests (filter by ?status=pending etc.)
router.get("/", protectedRoute, getAllRequests);

// Technician / Admin updates request status
router.patch("/:id/status", protectedRoute, updateRequestStatus);

// Farmer confirms AI outcome
router.patch("/:id/outcome", protectedRoute, confirmAIOutcome);

// Farmer submits an observation that may need technician verification.
router.post("/:id/farmer-observation", protectedRoute, submitFarmerBreedingObservation);

// Technician/Admin verifies a breeding observation / records PD check
router.post("/:id/verify-breeding-observation", protectedRoute, verifyFarmerBreedingObservation);

// Farmer/Tech/Admin cancels a request (smart cancel with reason)
router.patch("/:id/cancel", protectedRoute, cancelAIRequest);

// Technician/Admin approves or rejects a farmer cancellation request
router.patch("/:id/cancel-respond", protectedRoute, respondAICancellation);

// Admin-only emergency cleanup (soft-delete)
router.delete("/:id", protectedRoute, AdminOnly, deleteRequest);

export default router;
