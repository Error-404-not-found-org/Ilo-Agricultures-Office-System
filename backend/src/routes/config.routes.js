import { Router } from "express";
import { getConfig, toggleHoliday } from "../controllers/config.controllers.js";
import { protectedRoute, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

// Publicly accessible for farmers to check status
router.get("/", getConfig);

// Only technicians and admins can change holiday mode
router.post("/holiday", protectedRoute, requireRole(["technician", "admin"]), toggleHoliday);

export default router;
