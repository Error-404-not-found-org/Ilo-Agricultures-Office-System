import { Router } from "express";

import {
  registerAnimal,
  getAllAnimals,
  getAnimalById,
  updateAnimalWizard,
  getMyAnimals,
  deleteAnimal,
  updateReproductiveStatus,
  requestReInsemination,
  getAnimalsByFarmer,
  recordCalving,
  getArchivedAnimals,
  restoreAnimal
} from "../controllers/animals.controllers.js";
import { protectedRoute, TechnicianOnly } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", protectedRoute, registerAnimal);
router.get("/all", protectedRoute, getAllAnimals);
router.get("/farmer/:farmerId", protectedRoute, TechnicianOnly, getAnimalsByFarmer);
router.get("/my", protectedRoute, getMyAnimals);
router.get("/archived", protectedRoute, getArchivedAnimals);
router.get("/:id", protectedRoute, getAnimalById);
router.put("/wizard/:id", protectedRoute, updateAnimalWizard);
router.delete("/:id", protectedRoute, deleteAnimal);

// Breeding Lifecycle
router.patch("/:id/reproductive-status", protectedRoute, updateReproductiveStatus);
router.post("/re-inseminate", protectedRoute, requestReInsemination);
router.post("/record-calving", protectedRoute, recordCalving);
router.patch("/:id/restore", protectedRoute, restoreAnimal);

export default router;
