import { Router } from "express";

import {
  registerAnimal,
  getAllAnimals,
  getAnimalById,
  updateAnimalWizard
} from "../controllers/animals.controllers.js";
import { protectedRoute } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", protectedRoute, registerAnimal);
router.get("/all", protectedRoute, getAllAnimals);
router.get("/:id", protectedRoute, getAnimalById);
router.put("/wizard/:id", protectedRoute, updateAnimalWizard);

export default router;
