import { Router } from "express";

import { registerAnimal } from "../controllers/animals.controllers";

const router = Router();

router.post("/register", registerAnimal);

export default router;