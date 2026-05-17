import express from "express";
import { askMoowie } from "../controllers/moowie.controllers.js";
import { protectedRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/ask", protectedRoute, askMoowie);

export default router;
