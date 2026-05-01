import { Router } from "express";

import {
  registerAnimal,
  getAllAnimals,
  getAnimalById,
  updateAnimalWizard,
  getMyAnimals,
  deleteAnimal,
  updateReproductiveStatus,
  requestReInsemination
} from "../controllers/animals.controllers.js";
import { protectedRoute } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", protectedRoute, registerAnimal);
router.get("/all", protectedRoute, getAllAnimals);
router.get("/my", protectedRoute, getMyAnimals);
router.get("/:id", protectedRoute, getAnimalById);
router.put("/wizard/:id", protectedRoute, updateAnimalWizard);
router.delete("/:id", protectedRoute, deleteAnimal);

// Breeding Lifecycle
router.patch("/:id/reproductive-status", protectedRoute, updateReproductiveStatus);
router.post("/re-inseminate", protectedRoute, requestReInsemination);

export default router;
