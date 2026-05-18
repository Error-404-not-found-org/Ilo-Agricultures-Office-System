import { Router } from "express";
import { Insemination } from "../models/insemination.model.js";

import {
  createInsemination,
  updateInsemination,
  getAllInseminations,
  getMyInseminations,
  deleteInsemination,
} from "../controllers/insemination.controllers.js";
import { protectedRoute } from "../middleware/auth.middleware.js";
import { requestLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

router.post("/create-insemination", protectedRoute, requestLimiter, createInsemination);
router.get("/my", protectedRoute, getMyInseminations);
router.get("/test-no-auth", (req, res) => res.json({ message: "Insemination router is ALIVE" }));
router.get("/all", protectedRoute, getAllInseminations);
router.put("/:id", protectedRoute, updateInsemination);
router.delete("/:id", protectedRoute, deleteInsemination);

export default router;
