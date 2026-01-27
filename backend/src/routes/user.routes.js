import { Router } from "express";

import { createFarmerAccount } from "../controllers/user.controllers.js";

import {
  protectedRoute,
  TechnicianOnly,
  adminOnly,
} from "../middleware/auth.middleware.js";

const router = Router();

router.post("/create-farmer", protectedRoute, adminOnly, createFarmerAccount);

export default router;
