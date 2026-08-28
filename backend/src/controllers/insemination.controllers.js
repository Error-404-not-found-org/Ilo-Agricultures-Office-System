import { User } from "../models/user.model.js";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { checkInseminationAgeEligibility } from "../utils/cattleCore.js";
import {
  createAIRequestWithGuard,
} from "../services/ai-request-creation.service.js";
import { getAnimalAIEligibility } from "../services/ai-eligibility.service.js";
import {
  normalizeSemenDosesUsed,
  normalizeSireBreed,
  normalizeSireCode,
  normalizeVisitPeriod,
} from "../domain/ai-recording-fields.js";
import { buildFarmerAIRequests } from "../domain/ai-request-presentation.js";

export const createInsemination = async (req, res) => {
  try {
    const {
      farmerId,
      animalId,
      inseminationDate,
      sireBreed,
      sireCode,
      semenDosesUsed,
      estrus,
      visitPeriod,
      previousAttemptId,
    } = req.body;

    const normalizedSireBreed = normalizeSireBreed(sireBreed);
    const normalizedSireCode = normalizeSireCode(sireCode);
    const normalizedSemenDosesUsed = normalizeSemenDosesUsed(semenDosesUsed);
    const normalizedVisitPeriod = normalizeVisitPeriod(visitPeriod);

    if (!req.user || req.user.role !== "technician") {
      return res.status(403).json({
        message: "Use the AI service request form to request this service.",
      });
    }

    // 1. Validate animal exists
    const animal = await Animal.findById(animalId);
    if (!animal) {
      return res.status(404).json({ message: "Animal not found" });
    }
    if (String(animal.farmerId) !== String(farmerId)) {
      return res
        .status(400)
        .json({ message: "Animal does not belong to the selected farmer." });
    }

    const eligibility = await getAnimalAIEligibility({
      animal,
      at: inseminationDate ? new Date(inseminationDate) : new Date(),
    });
    if (!eligibility.eligible) {
      return res.status(400).json({
        code: eligibility.code,
        message: eligibility.reason,
        nextAction: eligibility.nextAction,
        nextActionAt: eligibility.nextActionAt,
      });
    }

    // 3. Create insemination
    const insemination = await createAIRequestWithGuard({
      farmerId,
      animalId,
      inseminationDate,
      sireBreed: normalizedSireBreed,
      sireCode: normalizedSireCode,
      ...(normalizedSemenDosesUsed !== undefined
        ? { semenDosesUsed: normalizedSemenDosesUsed }
        : {}),
      ...(normalizedVisitPeriod !== undefined
        ? { visitPeriod: normalizedVisitPeriod }
        : {}),
      estrus,
      ...(previousAttemptId ? { previousAttemptId } : {}),
      status: "approved",
      approvedBy: req.user._id,
    });

    res.status(201).json({
      message: "Insemination recorded",
      insemination,
    });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({
      message: error.message || "Failed to create insemination",
      code: error.code,
      ...(error.details || {}),
    });
  }
};

export const updateInsemination = async (req, res) => {
  // This legacy endpoint accepted lifecycle-driving and historical clinical
  // fields without an ownership-aware correction boundary. Canonical AI
  // status/completion must be used instead. A future historical correction
  // must have its own audited boundary; keeping this route produces an
  // explicit compatibility response without permitting any record or Animal
  // mutation.
  return res.status(405).json({
    message:
      "Generic AI record editing is not available. Use the canonical AI service workflow; historical corrections require a dedicated audited administrative action.",
    code: "GENERIC_INSEMINATION_MUTATION_DISABLED",
  });
};

export const getAllInseminations = async (req, res) => {
  try {
    const inseminations = await Insemination.find({ deletedAt: null })
      .populate("animalId", "earTag species breed color animalId")
      .populate("farmerId", "name email phoneNumber")
      .populate("approvedBy", "name email")
      .populate("technicianId", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json(inseminations);
  } catch (error) {
    console.error("Error fetching all inseminations:", error);
    res.status(500).json({ message: "Failed to fetch inseminations" });
  }
};

// GET /api/insemination/my — returns insemination records for the logged-in farmer
export const getMyInseminations = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const farmerId = req.user._id;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // FETCH ALL DATA IN PARALLEL FOR MAXIMUM PERFORMANCE
    const [records, total, approved, pending] = await Promise.all([
      Insemination.find({ farmerId, deletedAt: null })
        .populate("animalId", "animalId earTag species breed imageUrl")
        .populate("approvedBy", "name")
        .populate("technicianId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Insemination.countDocuments({ farmerId, deletedAt: null }),
      Insemination.countDocuments({
        farmerId,
        status: "approved",
        deletedAt: null,
      }),
      Insemination.countDocuments({
        farmerId,
        status: "pending",
        deletedAt: null,
      }),
    ]);

    res.status(200).json({
      data: buildFarmerAIRequests(records),
      total,
      stats: { total, approved, pending },
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error("[getMyInseminations ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch your records." });
  }
};

// DELETE /api/insemination/:id
export const deleteInsemination = async (req, res) => {
  // Ordinary Technician deletion and the former generic cascade could erase
  // official Pregnancy/Calving history. Administrative archival remains on
  // the explicit Admin-only route, which owns its audit behavior.
  return res.status(405).json({
    message:
      "Generic AI record deletion is not available. Use the audited administrative archive action.",
    code: "GENERIC_INSEMINATION_MUTATION_DISABLED",
  });
};
