import express from "express";
import {
  askMoowie,
  queryAnimalForVoiceflow,
  getUserSummaryForVoiceflow,
  getActiveTasksForVoiceflow,
  getVoiceflowToken
} from "../controllers/moowie.controllers.js";
import { protectedRoute } from "../middleware/auth.middleware.js";
import { voiceflowAuth } from "../middleware/voiceflowAuth.middleware.js";
import { moowieLimiter, voiceflowLimiter } from "../middleware/rateLimit.middleware.js";

const router = express.Router();

router.post("/ask", protectedRoute, moowieLimiter, askMoowie);
router.post("/voiceflow-token", protectedRoute, getVoiceflowToken);
router.post("/voiceflow", voiceflowAuth, voiceflowLimiter, queryAnimalForVoiceflow);
router.post("/voiceflow/summary", voiceflowAuth, voiceflowLimiter, getUserSummaryForVoiceflow);
router.post("/voiceflow/tasks", voiceflowAuth, voiceflowLimiter, getActiveTasksForVoiceflow);

export default router;
