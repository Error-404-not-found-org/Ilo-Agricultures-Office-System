import { MedicalRecord } from "../models/medical-record.model.js";
import { Animal } from "../models/animal.model.js";
import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.model.js";
import { sendPushNotification } from "../lib/push-notifications.js";

export const addMedicalRecord = async (req, res) => {
  try {
    const { animalId, type, details, note, followUpDate } = req.body;

    const animal = await Animal.findById(animalId);
    if (!animal) return res.status(404).json({ message: "Animal not found" });

    const withdrawalDays = req.body.withdrawalPeriodDays || details?.withdrawalPeriodDays;
    let withdrawalEndDate = null;
    if (withdrawalDays && !isNaN(withdrawalDays)) {
      withdrawalEndDate = new Date(Date.now() + Number(withdrawalDays) * 24 * 60 * 60 * 1000);
    }

    const finalDetails = {
      ...details,
      withdrawalPeriodDays: withdrawalDays ? Number(withdrawalDays) : undefined,
      withdrawalEndDate: withdrawalEndDate || undefined,
    };

    const record = await MedicalRecord.create({
      animalId,
      farmerId: animal.farmerId,
      technicianId: req.user._id,
      type,
      details: finalDetails,
      note,
      followUpDate,
    });

    // Notify Farmer of new medical record
    await Notification.create({
      recipientId: animal.farmerId,
      senderId: req.user._id,
      type: "system",
      relatedId: animal._id,
      title: `New ${type} Recorded`,
      message: `A new ${type.toLowerCase()} record has been added to the profile of ${animal.earTag || animal.animalId}.`,
    });

    // Send a withdrawal period alert if active
    if (withdrawalDays && Number(withdrawalDays) > 0 && withdrawalEndDate) {
      const formattedDate = withdrawalEndDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      const title = "⚠️ Active Withdrawal Warning";
      const body = `Meat and milk from animal Tag #${animal.earTag || animal.animalId} are unsafe for consumption or sale until ${formattedDate} due to recent treatment with ${details?.medicineName || 'medicine'}.`;

      await Notification.create({
        recipientId: animal.farmerId,
        senderId: req.user._id,
        type: "system",
        relatedId: animal._id,
        title,
        message: body,
      });

      const farmer = await User.findById(animal.farmerId);
      if (farmer?.pushToken) {
        await sendPushNotification(farmer.pushToken, title, body);
      }
    }

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
