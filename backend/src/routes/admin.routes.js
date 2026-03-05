import { Router } from "express";

import { protectedRoute, AdminOnly } from "../middleware/auth.middleware.js";

import { getDashboardStats } from "../controllers/admin.controllers.js";
import { createInvitedUser } from "../controllers/user.controllers.js";
import { getAllInseminations } from "../controllers/admin.controllers.js";
import { getAllReInseminations } from "../controllers/admin.controllers.js";
import { getAllPregnancyChecks } from "../controllers/admin.controllers.js";
import { getAllCalvings } from "../controllers/admin.controllers.js";
import { deleteUser } from "../controllers/admin.controllers.js";
import { deleteInsemination, syncUserMetadata } from "../controllers/admin.controllers.js";

const router = Router();

router.use(protectedRoute, AdminOnly);

router.post("/create-user", createInvitedUser);
router.post("/sync-metadata", syncUserMetadata);
router.post("/delete-user", deleteUser);
router.get("/stats", getDashboardStats);
router.get("/inseminations", getAllInseminations);
router.get("/re-inseminations", getAllReInseminations);
router.get("/pregnancy-checks", getAllPregnancyChecks);
router.get("/calvings", getAllCalvings);
router.delete("/delete-insemination/:id", deleteInsemination);


export default router;
