import { Router } from "express";

import {
  registerAnimal,
  getAllAnimals,
  getAnimalById,
} from "../controllers/animals.controllers.js";

const router = Router();

router.post("/register", registerAnimal);
router.get("/all", getAllAnimals);
router.get("/:id", getAnimalById);

export default router;
