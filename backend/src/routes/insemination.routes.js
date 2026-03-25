import { Router } from "express";

import {
  createInsemination,
  updateInsemination,
  getAllInseminations,
  getMyInseminations,
} from "../controllers/insemination.controllers.js";
import { protectedRoute } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/create-insemination", protectedRoute, createInsemination);
router.get("/my", protectedRoute, getMyInseminations);
router.get("/all", protectedRoute, getAllInseminations);
router.put("/:id", protectedRoute, updateInsemination);

export default router;
