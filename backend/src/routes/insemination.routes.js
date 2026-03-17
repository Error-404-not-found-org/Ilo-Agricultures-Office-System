import { Router } from "express";

import {
  createInsemination,
  updateInsemination,
  getAllInseminations,
} from "../controllers/insemination.controllers.js";

const router = Router();

router.post("/create-insemination", createInsemination);
router.get("/all", getAllInseminations);
router.put("/:id", updateInsemination);

export default router;
