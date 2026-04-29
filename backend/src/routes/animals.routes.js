import { Router } from "express";

import {
  registerAnimal,
  getAllAnimals,
  getAnimalById,
  updateAnimalWizard,
  getMyAnimals,
  deleteAnimal
} from "../controllers/animals.controllers.js";
import { protectedRoute } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", protectedRoute, registerAnimal);
router.get("/all", protectedRoute, getAllAnimals);
router.get("/my", protectedRoute, getMyAnimals);
router.get("/:id", protectedRoute, getAnimalById);
router.put("/wizard/:id", protectedRoute, updateAnimalWizard);
router.delete("/:id", protectedRoute, deleteAnimal);

export default router;
