import express from "express";
import { askMoowie, queryAnimalForVoiceflow, getUserSummaryForVoiceflow, getActiveTasksForVoiceflow } from "../controllers/moowie.controllers.js";
import { protectedRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/ask", protectedRoute, askMoowie);
router.post("/voiceflow", queryAnimalForVoiceflow);
router.post("/voiceflow/summary", getUserSummaryForVoiceflow);
router.post("/voiceflow/tasks", getActiveTasksForVoiceflow);

export default router;
