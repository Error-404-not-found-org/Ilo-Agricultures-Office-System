import { Router } from "express";

import { protectedRoute, AdminOnly } from "../middleware/auth.middleware.js";

import { getDashboardStats, getAdminAnalytics } from "../controllers/admin.controllers.js";
import { createInvitedUser, listAllUsersForAdmin } from "../controllers/user.controllers.js";
import { getAllInseminations } from "../controllers/admin.controllers.js";
import { getAllReInseminations } from "../controllers/admin.controllers.js";
import { getAllPregnancyChecks } from "../controllers/admin.controllers.js";
import { getAllCalvings } from "../controllers/admin.controllers.js";
import { deleteUser } from "../controllers/admin.controllers.js";
import { deleteInsemination, syncUserMetadata, getChartData } from "../controllers/admin.controllers.js";
import { getMunicipalCensusData } from "../controllers/report.controllers.js";

const router = Router();

router.use(protectedRoute, AdminOnly);

router.post("/create-user", createInvitedUser);
router.get("/list-users", listAllUsersForAdmin);
router.post("/sync-metadata", syncUserMetadata);
router.post("/delete-user", deleteUser);
router.get("/stats", getDashboardStats);
router.get("/analytics", getAdminAnalytics);
router.get("/chart-data", getChartData);
router.get("/inseminations", getAllInseminations);
router.get("/re-inseminations", getAllReInseminations);
router.get("/pregnancy-checks", getAllPregnancyChecks);
router.get("/calvings", getAllCalvings);
router.delete("/delete-insemination/:id", deleteInsemination);
router.get("/reports-data", getMunicipalCensusData);


export default router;
