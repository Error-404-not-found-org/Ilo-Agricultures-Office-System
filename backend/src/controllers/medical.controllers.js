import { MedicalRecord } from "../models/medical-record.model.js";
import { Animal } from "../models/animal.model.js";
import { User } from "../models/user.model.js";
import { notifyUser } from "../services/notification-delivery.service.js";
import { getPagination } from "../utils/pagination.js";
import { sendList } from "../utils/api-response.js";
import { assertAnimalAccess } from "../policies/animal.policy.js";

export const addMedicalRecord = async (req, res) => {
  try {
    const {
      animalId,
      type,
      details,
      note,
      followUpDate,
      serviceDate,
      isHistoricalEntry = false,
      lateEntryReason,
      performedByName,
    } = req.body;

    const parsedServiceDate = serviceDate ? new Date(serviceDate) : new Date();
    if (Number.isNaN(parsedServiceDate.getTime())) {
      return res.status(400).json({ message: "A valid service date is required" });
    }

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (parsedServiceDate > endOfToday) {
      return res.status(400).json({ message: "Service date cannot be in the future" });
    }

    if (isHistoricalEntry && !String(lateEntryReason || "").trim()) {
      return res.status(400).json({
        message: "Reason for late entry is required for a historical record",
      });
    }

    const animal = await Animal.findById(animalId);
    if (!animal) return res.status(404).json({ message: "Animal not found" });

    const withdrawalDays = req.body.withdrawalPeriodDays || details?.withdrawalPeriodDays;
    let withdrawalEndDate = null;
    if (withdrawalDays && !isNaN(withdrawalDays)) {
      withdrawalEndDate = new Date(
        parsedServiceDate.getTime() + Number(withdrawalDays) * 24 * 60 * 60 * 1000,
      );
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
      date: parsedServiceDate,
      isHistoricalEntry: Boolean(isHistoricalEntry),
      lateEntryReason: isHistoricalEntry ? String(lateEntryReason).trim() : undefined,
      performedByName: String(performedByName || "").trim() || undefined,
      entrySource: isHistoricalEntry ? "historical_entry" : "technician_entry",
      details: finalDetails,
      note,
      followUpDate,
    });

    const farmer = await User.findById(animal.farmerId);

    // Notify the farmer in-app and by push when a device is registered.
    await notifyUser({
      recipient: farmer,
      recipientId: animal.farmerId,
      senderId: req.user._id,
      type: "system",
      relatedId: animal._id,
      category: "health",
      eventType: "medical_record_added",
      linkType: "animal",
      title: `New ${type} Recorded`,
      message: `A new ${type.toLowerCase()} record has been added to the profile of ${animal.earTag || animal.animalId}.`,
      metadata: {
        animalId: animal._id,
        animalTag: animal.earTag || animal.animalId,
        recordId: record._id,
        recordType: type,
      },
    });

    // Send a withdrawal period alert if active
    if (withdrawalDays && Number(withdrawalDays) > 0 && withdrawalEndDate) {
      const formattedDate = withdrawalEndDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      const title = "Active withdrawal warning";
      const body = `Meat and milk from animal Tag #${animal.earTag || animal.animalId} are unsafe for consumption or sale until ${formattedDate} due to recent treatment with ${details?.medicineName || 'medicine'}.`;

      await notifyUser({
        recipient: farmer,
        recipientId: animal.farmerId,
        senderId: req.user._id,
        type: "system",
        relatedId: animal._id,
        category: "health",
        eventType: "withdrawal_safety_active",
        linkType: "animal",
        title,
        message: body,
        metadata: {
          animalId: animal._id,
          animalTag: animal.earTag || animal.animalId,
          recordId: record._id,
          withdrawalEndDate,
          medicineName: details?.medicineName || "medicine",
        },
      });
    }

    res.status(201).json({ message: "Medical record added successfully", record });
  } catch (error) {
    res.status(500).json({ message: "Error adding medical record", error: error.message });
  }
};

export const getAnimalMedicalHistory = async (req, res) => {
  try {
    const { animalId } = req.params;
    const animal = await Animal.findOne({ _id: animalId, deletedAt: null }).select("farmerId");
    if (!animal) return res.status(404).json({ message: "Animal not found" });
    assertAnimalAccess(req.user, animal);
    const { page, limit, skip } = getPagination(req.query);
    const query = { animalId };

    if (req.query.type && req.query.type !== "All") {
      query.type = req.query.type;
    }

    const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
    const toDate = req.query.toDate ? new Date(req.query.toDate) : null;
    const dateFilter = {};
    if (fromDate && !Number.isNaN(fromDate.getTime())) dateFilter.$gte = fromDate;
    if (toDate && !Number.isNaN(toDate.getTime())) dateFilter.$lte = toDate;
    if (Object.keys(dateFilter).length) query.date = dateFilter;

    if (req.query.page || req.query.limit) {
      const [records, total] = await Promise.all([
        MedicalRecord.find(query)
          .populate("technicianId", "name")
          .sort({ date: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        MedicalRecord.countDocuments(query),
      ]);

      return sendList(res, { data: records, page, limit, total });
    }

    const records = await MedicalRecord.find(query)
      .populate("technicianId", "name")
      .sort({ date: -1 });

    res.status(200).json(records);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message, code: error.code });
    }
    res.status(500).json({ message: "Error fetching medical history", error: error.message });
  }
};
