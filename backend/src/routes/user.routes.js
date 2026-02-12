import { Router } from "express";

import { createFarmerAccount } from "../controllers/user.controllers.js";

import {
  protectedRoute,
  TechnicianOnly,
  AdminOnly,
} from "../middleware/auth.middleware.js";

const router = Router();

router.post("/create-farmer", protectedRoute, AdminOnly, createFarmerAccount);

export default router;
