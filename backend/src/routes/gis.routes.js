import express from "express";
import {
  getGisHubData,
  getHealthHeatmapData,
} from "../controllers/gis.controllers.js";

const router = express.Router();

router.get("/hub-data", getGisHubData);
router.get("/health-heatmap", getHealthHeatmapData);

export default router;
