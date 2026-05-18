import express from "express";
import { 
  getTechnicianPerformance, 
  getRegionalHeatmap, 
  getGrowthTrends,
  getMyPerformance
} from "../controllers/analytics.controllers.js";
import { protectedRoute, requireRole } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/my-performance", protectedRoute, requireRole(['technician']), getMyPerformance);
router.get("/performance", protectedRoute, requireRole(['admin']), getTechnicianPerformance);
router.get("/heatmap", getRegionalHeatmap);
router.get("/trends", getGrowthTrends);

export default router;
