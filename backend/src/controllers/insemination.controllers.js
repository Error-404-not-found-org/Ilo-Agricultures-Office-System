import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Calving } from "../models/calving.model.js";
import { checkInseminationAgeEligibility } from "../utils/cattleCore.js";
import {
  activeRequestKeyForAnimal,
  createAIRequestWithGuard,
} from "../services/ai-request-creation.service.js";
import { isActiveAIRequestStatus } from "../domain/status-vocabulary.js";
import { createAuditLog } from "../services/audit.service.js";

export const createInsemination = async (req, res) => {
  try {
    const {
      farmerId,
      animalId,
      inseminationDate,
      sireBreed,
      sireCode,
      estrus,
    } = req.body;

    if (!req.user || !["technician", "admin"].includes(req.user.role)) {
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
      return res.status(400).json({ message: "Animal does not belong to the selected farmer." });
    }

    // Gender check
    if (animal.gender !== "Female") {
      return res.status(400).json({ message: "Insemination is restricted to female animals only. This animal is registered as Male." });
    }

    // Age Check Check
    const ageCheck = checkInseminationAgeEligibility(animal.birthDate, animal.species);
    if (!ageCheck.isEligible) {
        return res.status(400).json({ message: ageCheck.reason });
    }

    // 3. Create insemination
    const insemination = await createAIRequestWithGuard({
      farmerId,
      animalId,
      inseminationDate,
      sireBreed,
      sireCode,
      estrus,
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
  try {
    const { id } = req.params;
    const { inseminationDate, sireBreed, sireCode, estrus, status } = req.body;

    const existingRecord = await Insemination.findById(id);
    if (!existingRecord) {
      return res.status(404).json({ message: "Insemination record not found" });
    }

    const nextStatus = status || existingRecord.status;
    const activeStatus = isActiveAIRequestStatus(nextStatus);
    const insemination = await Insemination.findByIdAndUpdate(
      id,
      {
        $set: {
          inseminationDate,
          sireBreed,
          sireCode,
          estrus,
          status: nextStatus,
          ...(activeStatus
            ? { activeRequestKey: activeRequestKeyForAnimal(existingRecord.animalId) }
            : {}),
        },
        ...(!activeStatus ? { $unset: { activeRequestKey: 1 } } : {}),
      },
      { new: true, runValidators: true }
    );

    if (!insemination) {
      return res.status(404).json({ message: "Insemination record not found" });
    }

    // Sync Animal Status if marked as 'done'
    if (nextStatus === "done") {
      await Animal.findByIdAndUpdate(insemination.animalId, {
        reproductiveStatus: "Inseminated"
      });
      console.log(`[Status Sync] Animal ${insemination.animalId} set to Inseminated via updateInsemination.`);
    }

    res.status(200).json({
      message: "Insemination updated successfully",
      insemination,
    });
  } catch (error) {
    console.error("Error updating insemination:", error);
    res.status(500).json({ message: "Failed to update insemination" });
  }
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
      Insemination.countDocuments({ farmerId, status: "approved", deletedAt: null }),
      Insemination.countDocuments({ farmerId, status: "pending", deletedAt: null }),
    ]);

    res.status(200).json({
      data: records,
      total,
      stats: { total, approved, pending },
      page: pageNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    console.error("[getMyInseminations ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch your records." });
  }
};

// DELETE /api/insemination/:id
export const deleteInsemination = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;
    const reason = String(req.body?.reason || "Administrative record correction").trim();
    const deleteTime = new Date();

    let record;
    await session.withTransaction(async () => {
      record = await Insemination.findOne({ _id: id, deletedAt: null }).session(
        session,
      );
      if (!record) {
        const notFound = new Error("Insemination record not found.");
        notFound.status = 404;
        throw notFound;
      }

      const pregnancies = await Pregnancy.find({
        inseminationId: id,
        deletedAt: null,
      }).session(session);
      const pregIds = pregnancies.map((pregnancy) => pregnancy._id);

      await Promise.all([
        Pregnancy.updateMany(
          { inseminationId: id, deletedAt: null },
          { $set: { deletedAt: deleteTime } },
          { session },
        ),
        Calving.updateMany(
          { pregnancyId: { $in: pregIds }, deletedAt: null },
          { $set: { deletedAt: deleteTime } },
          { session },
        ),
        Insemination.updateOne(
          { _id: id, deletedAt: null },
          {
            $set: { deletedAt: deleteTime },
            $unset: { activeRequestKey: 1 },
          },
          { session },
        ),
      ]);

      await createAuditLog(
        {
          entityType: "Insemination",
          entityId: record._id,
          action: "soft_delete_with_breeding_cascade",
          actorId: req.user._id,
          before: {
            status: record.status,
            deletedAt: record.deletedAt,
            pregnancyCount: pregnancies.length,
          },
          after: { deletedAt: deleteTime },
          metadata: { reason, role: req.user.role },
        },
        { session },
      );
    });

    console.log(`[Insemination & Cascade Soft-Deleted] ${id}`);
    res.status(200).json({ message: "Insemination and all linked breeding data soft-deleted successfully." });
  } catch (error) {
    console.error("[deleteInsemination ERROR]", error.message);
    res.status(error.status || 500).json({
      message: error.message || "Failed to delete insemination record.",
    });
  } finally {
    await session.endSession();
  }
};
