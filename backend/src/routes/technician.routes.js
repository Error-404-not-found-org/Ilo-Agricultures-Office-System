import { Router } from "express";

import {
  protectedRoute,
  TechnicianOnly,
} from "../middleware/auth.middleware.js";

import { getMyInseminations } from "../controllers/technician.controllers.js";
import { getMyProfile } from "../controllers/technician.controllers.js";
import { getMyReInseminations } from "../controllers/technician.controllers.js";
import { getMyPregnancyChecks } from "../controllers/technician.controllers.js";
import { getMyNotifications } from "../controllers/technician.controllers.js";
import { walkInInsemination } from "../controllers/technician.controllers.js";

const router = Router();

router.use(protectedRoute, TechnicianOnly);

// Get functions for technician

router.get("/inseminations", getMyInseminations);
router.get("/re-inseminations", getMyReInseminations);
router.get("/pregnancy-checks", getMyPregnancyChecks);
router.get("/notifications", getMyNotifications);
router.get("/profile", getMyProfile);

router.post("/walk-in-insemination", walkInInsemination);

export default router;
