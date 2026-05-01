import { Router } from "express";
import { protectedRoute, TechnicianOnly } from "../middleware/auth.middleware.js";
import { addMedicalRecord, getAnimalMedicalHistory } from "../controllers/medical.controllers.js";

const router = Router();

router.get("/:animalId", protectedRoute, getAnimalMedicalHistory);
router.post("/", protectedRoute, TechnicianOnly, addMedicalRecord);

export default router;
