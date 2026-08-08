import { Router } from "express";

import {
  registerAnimal,
  getAllAnimals,
  getAnimalById,
  updateAnimalWizard,
  getMyAnimals,
  deleteAnimal,
  updateReproductiveStatus,
  getAnimalsByFarmer,
  recordCalving,
  getArchivedAnimals,
  restoreAnimal
} from "../controllers/animals.controllers.js";
import {
  getAnimalAttachments,
  getAnimalHealthHistory,
  getAnimalRecords,
  getOfficialRecords,
  getAnimalReproductionEligibility,
  getAnimalTimeline,
  createFarmerAnimalUpdate,
} from "../controllers/animal-workflow.controllers.js";
import { createLegacyReInseminationRequest } from "../controllers/ai-request.controllers.js";
import { protectedRoute, requireRole } from "../middleware/auth.middleware.js";
import { requestLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

router.post("/register", protectedRoute, registerAnimal);
router.get("/all", protectedRoute, getAllAnimals);
router.get("/farmer/:farmerId", protectedRoute, requireRole(["technician", "admin"]), getAnimalsByFarmer);
router.get("/my", protectedRoute, getMyAnimals);
router.get("/records", protectedRoute, getOfficialRecords);
router.get("/archived", protectedRoute, getArchivedAnimals);
router.get("/:id/timeline", protectedRoute, getAnimalTimeline);
router.get("/:id/history", protectedRoute, getAnimalTimeline);
router.get("/:id/records", protectedRoute, getAnimalRecords);
router.get("/:id/health-history", protectedRoute, getAnimalHealthHistory);
router.get("/:id/reproduction-eligibility", protectedRoute, getAnimalReproductionEligibility);
router.get("/:id/attachments", protectedRoute, getAnimalAttachments);
router.post("/:id/updates", protectedRoute, createFarmerAnimalUpdate);
router.get("/:id", protectedRoute, getAnimalById);
router.put("/wizard/:id", protectedRoute, updateAnimalWizard);
router.delete("/:id", protectedRoute, deleteAnimal);

// Breeding Lifecycle
router.patch("/:id/reproductive-status", protectedRoute, updateReproductiveStatus);
router.post(
  "/re-inseminate",
  protectedRoute,
  requestLimiter,
  createLegacyReInseminationRequest,
);
router.post("/record-calving", protectedRoute, recordCalving);
router.patch("/:id/restore", protectedRoute, restoreAnimal);

export default router;
