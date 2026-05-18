import { Router } from "express";
import { getMonthlyAccomplishmentReport } from "../controllers/report.controllers.js";
import { protectedRoute, TechnicianOnly } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/monthly-accomplishment", protectedRoute, TechnicianOnly, getMonthlyAccomplishmentReport);

export default router;
