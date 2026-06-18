import { Router } from "express";
import { getMonthlyAccomplishmentReport } from "../controllers/report.controllers.js";
import { protectedRoute, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/monthly-accomplishment", protectedRoute, requireRole(["technician", "admin"]), getMonthlyAccomplishmentReport);

export default router;
