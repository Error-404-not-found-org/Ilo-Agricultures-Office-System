import { Router } from "express";

import { protectedRoute, AdminOnly } from "../middleware/auth.middleware.js";

import { registerUser } from "../controllers/admin.controllers.js";
import { getAllInseminations } from "../controllers/admin.controllers.js";
import { getAllReInseminations } from "../controllers/admin.controllers.js";
import { getAllPregnancyChecks } from "../controllers/admin.controllers.js";
import { getAllCalvings } from "../controllers/admin.controllers.js";
import { deleteUser } from "../controllers/admin.controllers.js";
import { deleteInsemination } from "../controllers/admin.controllers.js";

const router = Router();

router.use(protectedRoute, AdminOnly);

router.post("/admin/create-user", registerUser);
router.post("/admin/delete-user", deleteUser);
router.get("/admin/inseminations", getAllInseminations);
router.get("/admin/re-inseminations", getAllReInseminations);
router.get("/admin/pregnancy-checks", getAllPregnancyChecks);
router.get("/admin/calvings", getAllCalvings);
router.delete("/admin/delete-insemination/:id", deleteInsemination);

export default router;
