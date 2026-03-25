import { AIRequest } from "../models/ai-request.model.js";
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

    const request = await AIRequest.create({
      farmerId,
      animalId,
      imageUrl: imageUrl || "",
      comment: comment || "",
    });

    console.log(`[AI Request Created] Farmer: ${farmerId} | Animal: ${animal.animalId} | Request: ${request._id}`);

    // --- TRIGGER NOTIFICATIONS to all technicians ---
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

      // Admins get a lighter summary notification
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
      // Don't fail the main request if notification fails
    }

    res.status(201).json({ message: "AI request submitted successfully.", request });
  } catch (error) {
    console.error("[createAIRequest ERROR]", error.message);
    res.status(500).json({ message: error.message || "Failed to submit AI request." });
  }
};

// GET /api/ai-request/my
// Farmer gets their own requests (with animal info populated)
export const getMyRequests = async (req, res) => {
  try {
    const farmerId = req.user._id;
    const requests = await AIRequest.find({ farmerId })
      .populate("animalId", "animalId earTag species breed imageUrl")
      .sort({ createdAt: -1 });

    res.status(200).json(requests);
  } catch (error) {
    console.error("[getMyRequests ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch your AI requests." });
  }
};

// GET /api/ai-request
// Technician / Admin gets all requests (with farmer + animal info)
export const getAllRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};

    const requests = await AIRequest.find(query)
      .populate("farmerId", "name address imageUrl")
      .populate("animalId", "animalId earTag species breed imageUrl")
      .populate("handledBy", "name")
      .sort({ createdAt: -1 });

    res.status(200).json(requests);
  } catch (error) {
    console.error("[getAllRequests ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch AI requests." });
  }
};

// PATCH /api/ai-request/:id/status
// Technician / Admin approves, rejects, or marks as done
export const updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, technicianNote } = req.body;

    const VALID_STATUSES = ["pending", "approved", "rejected", "done"];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const request = await AIRequest.findByIdAndUpdate(
      id,
      {
        status,
        handledBy: req.user._id,
        technicianNote: technicianNote || "",
      },
      { new: true }
    ).populate("farmerId", "name").populate("animalId", "animalId earTag species");

    if (!request) {
      return res.status(404).json({ message: "AI request not found." });
    }

    console.log(`[AI Request Updated] ID: ${id} → Status: ${status} by ${req.user._id}`);
    res.status(200).json({ message: "Request status updated.", request });
  } catch (error) {
    console.error("[updateRequestStatus ERROR]", error.message);
    res.status(500).json({ message: "Failed to update request status." });
  }
};
