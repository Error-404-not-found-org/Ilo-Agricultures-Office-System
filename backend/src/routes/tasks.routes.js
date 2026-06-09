import express from "express";
import { protectedRoute, TechnicianOnly } from "../middleware/auth.middleware.js";
import { getDashboardStats, getTasks, createTask, completeTask, getTaskById } from "../controllers/tasks.controllers.js";

const router = express.Router();

router.use(protectedRoute);
router.use(TechnicianOnly);

router.get("/stats", getDashboardStats);
router.get("/", getTasks);
router.get("/:id", getTaskById);
router.post("/", createTask);
router.put("/:id/complete", completeTask);

export default router;
