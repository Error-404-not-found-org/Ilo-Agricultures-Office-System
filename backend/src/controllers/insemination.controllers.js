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
