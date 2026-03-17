import { User } from "../models/user.model.js";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";

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

    const insemination = await Insemination.findById(id);

    if (!insemination) {
      return res.status(404).json({ message: "Insemination record not found" });
    }

    if (inseminationDate) insemination.inseminationDate = inseminationDate;
    if (sireBreed) insemination.sireBreed = sireBreed;
    if (sireCode) insemination.sireCode = sireCode;
    if (estrus) insemination.estrus = estrus;
    if (status) insemination.status = status;

    await insemination.save();

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
    const inseminations = await Insemination.find()
      .populate("animalId", "earTag species breed color")
      .populate("farmerId", "name email phoneNumber")
      .populate("approvedBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json(inseminations);
  } catch (error) {
    console.error("Error fetching all inseminations:", error);
    res.status(500).json({ message: "Failed to fetch inseminations" });
  }
};
