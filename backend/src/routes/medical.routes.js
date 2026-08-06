import { Router } from "express";
import { protectedRoute, requireRole } from "../middleware/auth.middleware.js";
import { addMedicalRecord, getAnimalMedicalHistory } from "../controllers/medical.controllers.js";

const router = Router();

router.get("/:animalId", protectedRoute, getAnimalMedicalHistory);
router.post("/", protectedRoute, requireRole(["technician"]), addMedicalRecord);

export default router;
