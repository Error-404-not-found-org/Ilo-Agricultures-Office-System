import { MedicalRecord } from "../models/medical-record.model.js";
import { Animal } from "../models/animal.model.js";
import { Notification } from "../models/notification.model.js";

export const addMedicalRecord = async (req, res) => {
  try {
    const { animalId, type, details, note, followUpDate } = req.body;

    const animal = await Animal.findById(animalId);
    if (!animal) return res.status(404).json({ message: "Animal not found" });

    const record = await MedicalRecord.create({
      animalId,
      farmerId: animal.farmerId,
      technicianId: req.user._id,
      type,
      details,
      note,
      followUpDate,
    });

    // Notify Farmer
    await Notification.create({
      recipientId: animal.farmerId,
      senderId: req.user._id,
      type: "system",
      relatedId: animal._id,
      title: `New ${type} Recorded`,
      message: `A new ${type.toLowerCase()} record has been added to the profile of ${animal.earTag || animal.animalId}.`,
    });

    res.status(201).json({ message: "Medical record added successfully", record });
  } catch (error) {
    res.status(500).json({ message: "Error adding medical record", error: error.message });
  }
};

export const getAnimalMedicalHistory = async (req, res) => {
  try {
    const { animalId } = req.params;
    const records = await MedicalRecord.find({ animalId })
      .populate("technicianId", "name")
      .sort({ date: -1 });

    res.status(200).json(records);
  } catch (error) {
    res.status(500).json({ message: "Error fetching medical history", error: error.message });
  }
};
