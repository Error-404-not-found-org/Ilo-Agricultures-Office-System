import { Router } from "express";
import { getMyInseminations, getMyProfile, getMyReInseminations, getMyPregnancyChecks, getMyCalvings, getMyNotifications, walkInInsemination } from "../controllers/technician.controllers.js";
import { protectedRoute, TechnicianOnly } from "../middleware/auth.middleware.js";

const router = Router();

router.use(protectedRoute, TechnicianOnly);

// Get functions for technician
router.get("/inseminations", getMyInseminations);
router.get("/re-inseminations", getMyReInseminations);
router.get("/pregnancy-checks", getMyPregnancyChecks);
router.get("/calvings", getMyCalvings);
router.get("/notifications", getMyNotifications);
router.get("/profile", getMyProfile);

router.post("/walk-in-insemination", walkInInsemination);

export default router;
