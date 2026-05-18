import { Router } from "express";
import { 
  getMyInseminations, getMyProfile, getMyReInseminations, 
  getMyPregnancyChecks, getMyCalvings, getMyNotifications, 
  walkInInsemination, getTechnicianDashboardData, 
  updateInseminationStatus, getAnimalHistory, registerFarmer, recordPregnancyCheck,
  recordCalving, getDashboardStats, getDashboardFeed, getDashboardRegistry, walkInLivestock,
  toggleFarmerVerification, getTechnicianAnalytics, deleteAnimal,
  deletePregnancyCheck, deleteCalving
} from "../controllers/technician.controllers.js";
import { protectedRoute, requireRole } from "../middleware/auth.middleware.js";
import { getCleanupSurvey, executeCleanup } from "../controllers/maintenance.controllers.js";

const router = Router();

router.use(protectedRoute, requireRole(["admin", "technician"]));

// Maintenance
router.get("/cleanup-survey", getCleanupSurvey);
router.post("/cleanup-execute", executeCleanup);

// Get functions for technician
router.get("/dashboard-data", getTechnicianDashboardData);
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

router.post("/walk-in-insemination", walkInInsemination);
router.post("/walk-in-livestock", walkInLivestock);
router.patch("/inseminations/:id/status", updateInseminationStatus);
router.get("/animal-history/:id", getAnimalHistory);
router.post("/register-farmer", registerFarmer);
router.post("/pregnancy-check", recordPregnancyCheck);
router.post("/record-calving", recordCalving);
router.patch("/farmers/:id/verify", toggleFarmerVerification);
router.delete("/animals/:id", deleteAnimal);
router.delete("/pregnancy-checks/:id", deletePregnancyCheck);
router.delete("/calvings/:id", deleteCalving);

export default router;
