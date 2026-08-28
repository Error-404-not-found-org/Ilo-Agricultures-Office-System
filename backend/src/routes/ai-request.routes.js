import { Router } from "express";
import {
  createAIRequest,
  createReInseminationRequest,
  getMyRequests,
  getAllRequests,
  updateRequestStatus,
  claimAndScheduleAIRequest,
  confirmAIOutcome,
  submitFarmerBreedingObservation,
  verifyFarmerBreedingObservation,
  recordTechnicianBreedingObservation,
  deleteRequest,
  getAIRequestDetail,
  cancelAIRequest,
  respondAICancellation,
  dismissAIRequestForFarmer,
  submitFarmerPregnancyReport,
  verifyFarmerPregnancyReport,
  getUpcomingVisits,
} from "../controllers/ai-request.controllers.js";
import {
  protectedRoute,
  AdminOnly,
  requireRole,
} from "../middleware/auth.middleware.js";
import { requestLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

// Farmer submits a new request
router.post("/", protectedRoute, requestLimiter, createAIRequest);
router.post("/:id/re-insemination", protectedRoute, requestLimiter, createReInseminationRequest);

// Farmer views their own requests
router.get("/my", protectedRoute, getMyRequests);

// Farmer dashboard: canonical scheduled AI + Health visits in one request.
router.get("/upcoming", protectedRoute, requireRole(["farmer"]), getUpcomingVisits);

// Get single AI request detail
router.get("/:id", protectedRoute, getAIRequestDetail);

// Technician / Admin views all requests (filter by ?status=pending etc.)
router.get(
  "/",
  protectedRoute,
  requireRole(["technician", "admin"]),
  getAllRequests,
);

// Technician / Admin updates request status
router.patch(
  "/:id/status",
  protectedRoute,
  requireRole(["technician"]),
  updateRequestStatus,
);

// Atomic confirmed workflow: claim and set the date-only visit window.
router.patch(
  "/:id/claim-and-schedule",
  protectedRoute,
  requireRole(["technician"]),
  claimAndScheduleAIRequest,
);

// Farmer confirms AI outcome
router.patch("/:id/outcome", protectedRoute, confirmAIOutcome);

// Farmer submits an observation that may need technician verification.
router.post("/:id/farmer-observation", protectedRoute, submitFarmerBreedingObservation);

// Technician/Admin verifies a breeding observation / records PD check
router.post(
  "/:id/verify-breeding-observation",
  protectedRoute,
  requireRole(["technician"]),
  verifyFarmerBreedingObservation,
);

// Technician records a breeding observation via phone call or field visit
router.post("/:id/technician-observation", protectedRoute, requireRole(["technician"]), recordTechnicianBreedingObservation);

// Farmer submits a pregnancy report with evidence
router.post("/:id/farmer-pregnancy-report", protectedRoute, submitFarmerPregnancyReport);

// Technician reviews a farmer pregnancy report (Request More Info or Accept)
router.post(
  "/:id/verify-pregnancy-report",
  protectedRoute,
  requireRole(["technician"]),
  verifyFarmerPregnancyReport,
);

// Farmer/Tech/Admin cancels a request (smart cancel with reason)
router.patch("/:id/cancel", protectedRoute, cancelAIRequest);

// Technician/Admin approves or rejects a farmer cancellation request
router.patch("/:id/cancel-respond", protectedRoute, respondAICancellation);

// Farmer hides a cancelled/rejected request from personal history only.
router.patch("/:id/dismiss", protectedRoute, dismissAIRequestForFarmer);

// Admin-only emergency cleanup (soft-delete)
router.delete("/:id", protectedRoute, AdminOnly, deleteRequest);

export default router;
