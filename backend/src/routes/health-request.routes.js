import { Router } from "express";
import {
  createHealthRequest,
  getMyHealthRequests,
  getAllHealthRequests,
  updateHealthRequestStatus,
  walkInHealthRequest,
  deleteHealthRequest,
  cancelHealthRequest,
  respondHealthCancellation,
  dismissHealthRequestForFarmer,
} from "../controllers/health-request.controllers.js";
import {
  getHealthRequestDetail,
  provideHealthAdvice,
  provideHealthOfficePickup,
  triageHealthRequest,
  scheduleHealthFollowUp,
} from "../controllers/health-workflow.controllers.js";
import { ClinicalOnly, protectedRoute, TechnicianOnly, AdminOnly } from "../middleware/auth.middleware.js";
import { requestLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

router.post("/", protectedRoute, requestLimiter, createHealthRequest);
router.post("/walk-in", protectedRoute, TechnicianOnly, walkInHealthRequest);
router.get("/my", protectedRoute, getMyHealthRequests);
router.get(
  "/",
  protectedRoute,
  requireRole(["technician", "admin"]),
  getAllHealthRequests,
);
router.get("/:id", protectedRoute, getHealthRequestDetail);
router.patch("/:id/advice", protectedRoute, TechnicianOnly, provideHealthAdvice);
router.patch("/:id/office-pickup", protectedRoute, TechnicianOnly, provideHealthOfficePickup);
router.patch("/:id/triage", protectedRoute, ClinicalOnly, triageHealthRequest);
router.post("/:id/follow-up", protectedRoute, ClinicalOnly, scheduleHealthFollowUp);
router.patch("/:id/status", protectedRoute, ClinicalOnly, updateHealthRequestStatus);

// Farmer/Tech/Admin cancels a request (smart cancel with reason)
router.patch("/:id/cancel", protectedRoute, cancelHealthRequest);

// Technician/Admin approves or rejects a farmer cancellation request
router.patch("/:id/cancel-respond", protectedRoute, respondHealthCancellation);

// Farmer hides a cancelled/rejected request from personal history only.
router.patch("/:id/dismiss", protectedRoute, dismissHealthRequestForFarmer);

// Admin-only emergency cleanup (soft-delete)
router.delete("/:id", protectedRoute, AdminOnly, deleteHealthRequest);

export default router;
