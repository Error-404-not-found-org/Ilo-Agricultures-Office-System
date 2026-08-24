import { Router } from "express";
import {
  getMyInseminations,
  getMyProfile,
  getMyReInseminations,
  getMyPregnancyChecks,
  getMyCalvings,
  getMyNotifications,
  walkInInsemination,
  getTechnicianDashboardData,
  getWorkQueue,
  getAnimalHistory,
  registerFarmer,
  recordPregnancyCheck,
  recordPregnancyContinuation,
  recordCalving,
  getDashboardStats,
  getDashboardFeed,
  getDashboardRegistry,
  walkInLivestock,
  toggleFarmerVerification,
  getTechnicianAnalytics,
  deletePregnancyCheck,
  deleteCalving,
  correctPregnancyCheck,
  correctCalving,
  getFieldNotes,
  createFieldNote,
  getTechnicianFieldNotes,
  deleteFieldNote,
  deleteFieldNoteRecord,
  markCalvingAsSeen,
  getTechnicianRequests,
  declineTechnicianRequest,
  claimRequest,
  getAIServiceContext,
  updateDispatchStatus,
  previousInsemination,
} from "../controllers/technician.controllers.js";
import { deleteAnimal as archiveAnimal } from "../controllers/animals.controllers.js";
import { protectedRoute, requireRole } from "../middleware/auth.middleware.js";
import {
  getCleanupSurvey,
  executeCleanup,
} from "../controllers/maintenance.controllers.js";
import { updateRequestStatus as updateCanonicalAIRequestStatus } from "../controllers/ai-request.controllers.js";

const router = Router();

router.use(
  protectedRoute,
  requireRole(["admin", "technician"]),
);

// Maintenance
router.get("/cleanup-survey", requireRole(["admin"]), getCleanupSurvey);
router.post("/cleanup-execute", requireRole(["admin"]), executeCleanup);

// Get functions for technician
router.get("/dashboard-data", getTechnicianDashboardData);
router.get("/requests", getTechnicianRequests);
router.get("/work-queue", getWorkQueue);
router.patch("/requests/:type/:id/decline", declineTechnicianRequest);
router.patch("/requests/:type/:id/claim", claimRequest);
router.patch("/dispatch-status", updateDispatchStatus);
router.get("/field-notes", getFieldNotes);
router.get("/dashboard-stats", getDashboardStats);
router.get("/dashboard-feed", getDashboardFeed);
router.get("/dashboard-registry", getDashboardRegistry);
router.get("/analytics", getTechnicianAnalytics);
router.get("/inseminations", getMyInseminations);
router.get("/re-inseminations", getMyReInseminations);
router.get("/pregnancy-checks", getMyPregnancyChecks);
router.get("/calvings", getMyCalvings);
router.get("/notifications", getMyNotifications);
router.get("/profile", getMyProfile);

router.get("/ai-service-context", getAIServiceContext);
router.post("/walk-in-insemination", walkInInsemination);
router.post("/previous-insemination", previousInsemination);
router.post("/walk-in-livestock", walkInLivestock);
// Compatibility alias for installed clients and queued offline mutations.
router.patch(
  "/inseminations/:id/status",
  requireRole(["technician", "admin"]),
  updateCanonicalAIRequestStatus,
);
router.get("/animal-history/:id", getAnimalHistory);
router.post("/register-farmer", registerFarmer);
router.post("/pregnancy-check", recordPregnancyCheck);
router.post(
  "/pregnancy-checks/:id/continuation-recheck",
  recordPregnancyContinuation,
);
router.post("/record-calving", recordCalving);
router.patch("/farmers/:id/verify", toggleFarmerVerification);
// Compatibility alias: legacy Technician clients share the canonical archive workflow.
router.delete("/animals/:id", archiveAnimal);
router.delete(
  "/pregnancy-checks/:id",
  requireRole(["admin"]),
  deletePregnancyCheck,
);
router.delete("/calvings/:id", requireRole(["admin"]), deleteCalving);
router.patch(
  "/pregnancy-checks/:id/correct",
  requireRole(["admin"]),
  correctPregnancyCheck,
);
router.patch("/calvings/:id/correct", requireRole(["admin"]), correctCalving);
router.patch("/calvings/:id/seen", markCalvingAsSeen);

// Technician field notes (separate from official service evidence)
router.post("/photo-notes", createFieldNote);
router.get("/photo-notes", getTechnicianFieldNotes);
router.delete("/photo-notes/:id", deleteFieldNote);
router.delete("/field-notes/:id", deleteFieldNoteRecord);

export default router;
