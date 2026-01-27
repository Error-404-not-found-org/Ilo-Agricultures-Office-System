import { Router } from "express";

import { createInsemination } from "../controllers/insemination.controllers";

const router = Router();

router.post("/create-insemination", createInsemination);

export default router;
