import express from "express";
import { askMoowie, queryAnimalForVoiceflow } from "../controllers/moowie.controllers.js";
import { protectedRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/ask", protectedRoute, askMoowie);
router.post("/voiceflow", queryAnimalForVoiceflow);

export default router;
