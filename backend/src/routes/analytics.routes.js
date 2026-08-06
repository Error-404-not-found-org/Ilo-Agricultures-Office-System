import express from "express";
import { 
  getTechnicianPerformance, 
  getRegionalHeatmap, 
  getGrowthTrends,
  getMyPerformance
} from "../controllers/analytics.controllers.js";
import { protectedRoute, requireRole } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/my-performance", protectedRoute, requireRole(["technician"]), getMyPerformance);
router.get("/performance", protectedRoute, requireRole(["admin"]), getTechnicianPerformance);
router.get("/heatmap", protectedRoute, requireRole(["admin", "technician"]), getRegionalHeatmap);
router.get("/trends", protectedRoute, requireRole(["admin", "technician"]), getGrowthTrends);

export default router;
