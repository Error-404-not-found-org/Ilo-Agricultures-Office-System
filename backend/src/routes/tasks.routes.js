import express from "express";
import { protectedRoute, requireRole } from "../middleware/auth.middleware.js";
import { getDashboardStats, getTasks, createTask, completeTask, getTaskById, claimTask } from "../controllers/tasks.controllers.js";

const router = express.Router();

router.use(protectedRoute);
router.use(requireRole(["admin", "technician"]));

router.get("/stats", getDashboardStats);
router.get("/", getTasks);
router.get("/:id", getTaskById);
router.post("/", createTask);
router.put("/:id/complete", requireRole(["technician"]), completeTask);
router.put("/:id/claim", requireRole(["technician"]), claimTask);

export default router;
