import express from "express";
import { 
  getTechnicianPerformance, 
  getRegionalHeatmap, 
  getGrowthTrends,
  getMyPerformance
} from "../controllers/analytics.controllers.js";
import { protectedRoute, requireRole } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/my-performance", protectedRoute, requireRole(["technician", "veterinarian"]), getMyPerformance);
router.get("/performance", protectedRoute, requireRole(["admin"]), getTechnicianPerformance);
router.get("/heatmap", protectedRoute, requireRole(["admin", "technician", "veterinarian"]), getRegionalHeatmap);
router.get("/trends", protectedRoute, requireRole(["admin", "technician", "veterinarian"]), getGrowthTrends);

export default router;
