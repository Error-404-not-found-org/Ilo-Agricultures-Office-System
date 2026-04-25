import { Insemination } from "../models/insemination.model.js";
import { Animal } from "../models/animal.model.js";
import { User } from "../models/user.model.js";
import { Notification } from "../models/notification.model.js";

// POST /api/ai-request
// Farmer submits an AI service request for one of their animals
export const createAIRequest = async (req, res) => {
  try {
    const farmerId = req.user._id;
    const { animalId, imageUrl, comment } = req.body;

    if (!animalId) {
      return res.status(400).json({ message: "Please select an animal for the request." });
    }

    // Make sure the animal belongs to this farmer
    const animal = await Animal.findOne({ _id: animalId, farmerId });
    if (!animal) {
      return res.status(404).json({ message: "Animal not found or does not belong to you." });
    }

    // Calculate attempt number
    const lastAttempt = await Insemination.findOne({ animalId }).sort({ attemptNumber: -1 });
    const attemptNumber = lastAttempt ? lastAttempt.attemptNumber + 1 : 1;

    const request = await Insemination.create({
      farmerId,
      animalId,
      imageUrl: imageUrl || "",
      comment: comment || "",
      preferredDate: req.body.preferredDate || new Date(),
      status: "pending",
      attemptNumber,
    });

    console.log(`[Unified AI Request Created] Farmer: ${farmerId} | Animal: ${animal.animalId} | Record: ${request._id}`);

    // --- TRIGGER NOTIFICATIONS ---
    try {
      const technicians = await User.find({ role: "technician" });
      const admins = await User.find({ role: "admin" });

      const techNotifs = technicians.map(t =>
        Notification.create({
          recipientId: t._id,
          senderId: farmerId,
          type: "ai-request",
          relatedId: request._id,
          title: "New AI Request",
          message: `${req.user.name} has requested an AI service for animal ${animal.earTag || animal.animalId}.`,
        })
      );

      const adminNotifs = admins.map(a =>
        Notification.create({
          recipientId: a._id,
          senderId: farmerId,
          type: "ai-request",
          relatedId: request._id,
          title: "[Summary] AI Request Submitted",
          message: `Farmer ${req.user.name} submitted an AI request. A technician has been notified.`,
        })
      );

      await Promise.all([...techNotifs, ...adminNotifs]);
    } catch (notifyErr) {
      console.error("[Notification Trigger Error]", notifyErr.message);
    }

    res.status(201).json({ message: "AI request submitted successfully.", request });
  } catch (error) {
    console.error("[createAIRequest ERROR]", error.message);
    res.status(500).json({ message: error.message || "Failed to submit AI request." });
  }
};

// GET /api/ai-request/my
export const getMyRequests = async (req, res) => {
  try {
    const farmerId = req.user._id;
    const requests = await Insemination.find({ farmerId })
      .populate("animalId", "animalId earTag species breed imageUrl")
      .sort({ createdAt: -1 });

    res.status(200).json(requests);
  } catch (error) {
    console.error("[getMyRequests ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch your AI requests." });
  }
};

// GET /api/ai-request
export const getAllRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};

    const requests = await Insemination.find(query)
      .populate("farmerId", "name address imageUrl")
      .populate("animalId", "animalId earTag species breed imageUrl")
      .populate("approvedBy", "name")
      .sort({ createdAt: -1 });

    res.status(200).json(requests);
  } catch (error) {
    console.error("[getAllRequests ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch AI requests." });
  }
};

// PATCH /api/ai-request/:id/status
export const updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, technicianNote } = req.body;

    const VALID_STATUSES = ["pending", "approved", "rejected", "done", "in-progress"];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const request = await Insemination.findByIdAndUpdate(
      id,
      {
        status,
        approvedBy: req.user._id,
        technicianNote: technicianNote || "",
        scheduledDate: req.body.scheduledDate || undefined,
      },
      { returnDocument: 'after' }
    ).populate("farmerId", "name").populate("animalId", "animalId earTag species");

    if (!request) {
      return res.status(404).json({ message: "AI request record not found." });
    }

    // --- TRIGGER NOTIFICATION TO FARMER ---
    try {
      if (request.farmerId && request.farmerId._id) {
        await Notification.create({
          recipientId: request.farmerId._id,
          senderId: req.user._id,
          type: "ai-request",
          relatedId: request._id,
          title: "AI Request Update",
          message: `Your AI request for ${request.animalId.earTag || request.animalId.animalId} has been marked as ${status}.`,
        });
      }
    } catch (notifyErr) {
      console.error("[Notification Trigger Error]", notifyErr.message);
    }

    res.status(200).json({ message: "Request status updated.", request });
  } catch (error) {
    console.error("[updateRequestStatus ERROR]", error.message);
    res.status(500).json({ message: "Failed to update request status." });
  }
};
