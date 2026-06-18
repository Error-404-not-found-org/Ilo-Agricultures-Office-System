import { Router } from "express";
import { getConfig, toggleHoliday, getConfigSettings, updateConfigSettings } from "../controllers/config.controllers.js";
import { protectedRoute, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

// Publicly accessible for farmers to check status
router.get("/", getConfig);

// Only technicians and admins can change holiday mode
router.post("/holiday", protectedRoute, requireRole(["technician", "admin"]), toggleHoliday);

// Get settings parameters (admins/technicians)
router.get("/settings", protectedRoute, requireRole(["technician", "admin"]), getConfigSettings);

// Update settings parameters (admins only)
router.post("/settings", protectedRoute, requireRole(["admin"]), updateConfigSettings);

export default router;
