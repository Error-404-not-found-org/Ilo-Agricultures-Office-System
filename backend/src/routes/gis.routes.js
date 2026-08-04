import express from "express";
import {
  getGisHubData,
  getHealthHeatmapData,
} from "../controllers/gis.controllers.js";
import { protectedRoute, requireRole } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protectedRoute, requireRole(["admin", "technician", "veterinarian"]));

router.get("/hub-data", getGisHubData);
router.get("/health-heatmap", getHealthHeatmapData);

export default router;
