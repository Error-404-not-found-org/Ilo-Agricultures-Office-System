import { Router } from "express";

import { createInsemination } from "../controllers/insemination.controllers.js";

const router = Router();

router.post("/create-insemination", createInsemination);

export default router;
