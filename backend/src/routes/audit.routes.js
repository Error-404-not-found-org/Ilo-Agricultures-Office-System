import { Router } from "express";
import { listAuditLogs } from "../controllers/audit.controllers.js";
import { protectedRoute, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.use(protectedRoute, requireRole(["admin"]));

router.get("/", listAuditLogs);

export default router;
