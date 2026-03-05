import { Router } from "express";

import { registerAnimal, getAllAnimals } from "../controllers/animals.controllers.js";

const router = Router();

router.post("/register", registerAnimal);
router.get("/all", getAllAnimals);

export default router;