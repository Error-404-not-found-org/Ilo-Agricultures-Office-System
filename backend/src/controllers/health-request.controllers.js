import { HealthRequest } from "../models/health-request.model.js";
import { Animal } from "../models/animal.model.js";
import { User } from "../models/user.model.js";
import { Notification } from "../models/notification.model.js";

// POST /api/health-request
export const createHealthRequest = async (req, res) => {
  try {
    const farmerId = req.user._id;
    const { animalId, requestType, symptoms, urgency, imageUrl } = req.body;

    if (!animalId) {
      return res.status(400).json({ message: "Please select an animal." });
    }
    if (!symptoms || symptoms.trim() === "") {
      return res.status(400).json({ message: "Please describe the symptoms or issue." });
    }

    // Verify the animal belongs to this farmer
    const animal = await Animal.findOne({ _id: animalId, farmerId });
    if (!animal) {
      return res.status(404).json({ message: "Animal not found or does not belong to you." });
    }

    const request = await HealthRequest.create({
      farmerId,
      animalId,
      requestType: requestType || "disease",
      symptoms: symptoms.trim(),
      urgency: urgency || "medium",
      imageUrl: imageUrl || "",
    });

    console.log(`[Health Request Created] Farmer: ${farmerId} | Animal: ${animal.animalId} | Type: ${requestType} | Urgency: ${urgency}`);

    // --- TRIGGER NOTIFICATIONS to all technicians + summary to admin ---
    try {
      const technicians = await User.find({ role: "technician" });
      const admins = await User.find({ role: "admin" });

      const techNotifs = technicians.map(t =>
        Notification.create({
          recipientId: t._id,
          senderId: farmerId,
          type: "health-request",
          relatedId: request._id,
          title: urgency === "high" ? "🚨 Emergency Health Request" : "New Health Request",
          message: `${req.user.name} reported ${urgency} urgency symptoms for animal ${animal.earTag || animal.animalId}: ${symptoms.substring(0, 60)}...`,
        })
      );

      const adminNotifs = admins.map(a =>
        Notification.create({
          recipientId: a._id,
          senderId: farmerId,
          type: "health-request",
          relatedId: request._id,
          title: urgency === "high" ? "[Summary] 🚨 Urgent Animal Issue" : "[Summary] Health Request Submitted",
          message: `Farmer ${req.user.name} reported a ${urgency} urgency issue. A technician has been notified.`,
        })
      );

      await Promise.all([...techNotifs, ...adminNotifs]);
    } catch (notifyErr) {
      console.error("[Notification Trigger Error]", notifyErr.message);
    }

    res.status(201).json({ message: "Health request submitted.", request });
  } catch (error) {
    console.error("[createHealthRequest ERROR]", error.message);
    res.status(500).json({ message: error.message || "Failed to submit request." });
  }
};

// GET /api/health-request/my  — farmer's own requests
export const getMyHealthRequests = async (req, res) => {
  try {
    const requests = await HealthRequest.find({ farmerId: req.user._id })
      .populate("animalId", "animalId earTag species breed")
      .sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    console.error("[getMyHealthRequests ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch your requests." });
  }
};

// GET /api/health-request  — all requests (technician/admin)
export const getAllHealthRequests = async (req, res) => {
  try {
    const { status, urgency } = req.query;
    const query = {};
    if (status) query.status = status;
    if (urgency) query.urgency = urgency;

    const requests = await HealthRequest.find(query)
      .populate("farmerId", "name address imageUrl")
      .populate("animalId", "animalId earTag species breed imageUrl")
      .populate("handledBy", "name")
      .sort({ urgency: -1, createdAt: -1 });

    res.status(200).json(requests);
  } catch (error) {
    console.error("[getAllHealthRequests ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch requests." });
  }
};

// PATCH /api/health-request/:id/status  — technician/admin updates
export const updateHealthRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, technicianNote } = req.body;

    const VALID = ["pending", "in-progress", "resolved", "cancelled"];
    if (!VALID.includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const request = await HealthRequest.findByIdAndUpdate(
      id,
      { 
        status, 
        handledBy: req.user._id, 
        technicianNote: technicianNote || "",
        scheduledDate: req.body.scheduledDate || undefined
      },
      { new: true }
    )
      .populate("farmerId", "name")
      .populate("animalId", "animalId earTag species");

    if (!request) return res.status(404).json({ message: "Request not found." });

    console.log(`[Health Request Updated] ${id} → ${status}`);
    res.status(200).json({ message: "Status updated.", request });
  } catch (error) {
    console.error("[updateHealthRequestStatus ERROR]", error.message);
    res.status(500).json({ message: "Failed to update status." });
  }
};
