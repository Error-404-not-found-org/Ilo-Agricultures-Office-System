import { Router } from "express";
import {
  createSupportTicket,
  listSupportTickets,
  updateSupportTicketStatus,
} from "../controllers/support-ticket.controllers.js";
import { protectedRoute, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/", protectedRoute, createSupportTicket);
router.get("/", protectedRoute, requireRole(["admin"]), listSupportTickets);
router.patch("/:id/status", protectedRoute, requireRole(["admin"]), updateSupportTicketStatus);

export default router;
