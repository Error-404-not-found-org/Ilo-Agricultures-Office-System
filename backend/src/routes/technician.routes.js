import { Router } from "express";

import {
  protectedRoute,
  TechnicianOnly,
} from "../middleware/auth.middleware.js";

import { getTechnicianInseminations } from "../controllers/technician.controllers.js";
import { getTechnicianProfile } from "../controllers/technician.controllers.js";
import { getTechnicianReInseminations } from "../controllers/technician.controllers.js";
import { getTechnicianPregnancyChecks } from "../controllers/technician.controllers.js";
import { getTechnicianCalvings } from "../controllers/technician.controllers.js";
import { getTechnicianFarmers } from "../controllers/technician.controllers.js";
import { getTechnicianNotifications } from "../controllers/technician.controllers.js";

import { createFarmerByTechnician } from "../controllers/technician.controllers.js";

const router = Router();

router.use(protectedRoute, TechnicianOnly);

// Get functions for technician
router.get("/technician/inseminations", getTechnicianInseminations);
router.get("/technician/profile", getTechnicianProfile);
router.get("/technician/re-inseminations", getTechnicianReInseminations);
router.get("/technician/pregnancy-checks", getTechnicianPregnancyChecks);
router.get("/technician/calvings", getTechnicianCalvings);
router.get("/technician/farmers", getTechnicianFarmers);
router.get("/technician/notifications", getTechnicianNotifications);

// Post functions for technician

router.post("/technician/create-farmer-profile", createFarmerByTechnician);

// Delete functions for technician

export default router;
