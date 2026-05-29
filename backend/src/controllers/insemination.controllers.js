import { User } from "../models/user.model.js";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Calving } from "../models/calving.model.js";
import { checkInseminationAgeEligibility } from "../utils/cattleCore.js";

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

    // 1. Validate animal exists
    const animal = await Animal.findById(animalId);
    if (!animal) {
      return res.status(404).json({ message: "Animal not found" });
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

    // 2. Get last insemination attempt
    const lastAttempt = await Insemination.findOne({ animalId }).sort({
      attemptNumber: -1,
    });

    const attemptNumber = lastAttempt ? lastAttempt.attemptNumber + 1 : 1;

    // 3. Create insemination
    const insemination = await Insemination.create({
      farmerId,
      animalId,
      inseminationDate,
      sireBreed,
      sireCode,
      estrus,
      attemptNumber,
      status: attemptNumber === 1 ? "approved" : "pending",
      approvedBy: attemptNumber === 1 ? req.user._id : null,
    });

    res.status(201).json({
      message: "Insemination recorded",
      insemination,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create insemination" });
  }
};

export const updateInsemination = async (req, res) => {
  try {
    const { id } = req.params;
    const { inseminationDate, sireBreed, sireCode, estrus, status } = req.body;

    const insemination = await Insemination.findByIdAndUpdate(
      id,
      { $set: { inseminationDate, sireBreed, sireCode, estrus, status } },
      { new: true, runValidators: true }
    );

    if (!insemination) {
      return res.status(404).json({ message: "Insemination record not found" });
    }

    // Sync Animal Status if marked as 'done'
    if (status === "done") {
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
  try {
    const { id } = req.params;
    const deleteTime = new Date();

    // 1. Find and Cascade Delete Children
    const pregnancies = await Pregnancy.find({ inseminationId: id, deletedAt: null });
    const pregIds = pregnancies.map(p => p._id);

    // Soft delete linked pregnancies and any calvings resulting from them
    await Promise.all([
      Pregnancy.updateMany({ inseminationId: id }, { $set: { deletedAt: deleteTime } }),
      Calving.updateMany({ pregnancyId: { $in: pregIds } }, { $set: { deletedAt: deleteTime } })
    ]);

    // 2. Soft delete the Insemination itself
    const record = await Insemination.findByIdAndUpdate(id, { $set: { deletedAt: deleteTime } }, { new: true });

    if (!record) {
      return res.status(404).json({ message: "Insemination record not found." });
    }

    console.log(`[Insemination & Cascade Soft-Deleted] ${id}`);
    res.status(200).json({ message: "Insemination and all linked breeding data soft-deleted successfully." });
  } catch (error) {
    console.error("[deleteInsemination ERROR]", error.message);
    res.status(500).json({ message: "Failed to delete insemination record.", error: error.message });
  }
};
