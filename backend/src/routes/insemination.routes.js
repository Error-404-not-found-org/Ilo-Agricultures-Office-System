import { Router } from "express";

import {
  createInsemination,
  updateInsemination,
  getAllInseminations,
  getMyInseminations,
} from "../controllers/insemination.controllers.js";
import { protectedRoute } from "../middleware/auth.middleware.js";
import { requestLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

router.post("/create-insemination", protectedRoute, requestLimiter, createInsemination);
router.get("/my", protectedRoute, getMyInseminations);
router.get("/all", protectedRoute, getAllInseminations);
router.put("/:id", protectedRoute, updateInsemination);

export default router;
