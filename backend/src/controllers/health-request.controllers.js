import { HealthRequest } from "../models/health-request.model.js";
import { Animal } from "../models/animal.model.js";
import { User } from "../models/user.model.js";
import { Notification } from "../models/notification.model.js";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { MedicalRecord } from "../models/medical-record.model.js";


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

    // --- DOUBLE REQUEST CONFIRMATION / DUPLICATE CHECK ---
    const existingActiveRequest = await HealthRequest.findOne({
      animalId,
      status: { $in: ["pending", "approved", "in-progress"] },
      deletedAt: null
    });

    if (existingActiveRequest) {
      return res.status(400).json({
        message: `There is already an active health checkup request (${existingActiveRequest.status}) for ${animal.earTag || animal.animalId}. Please wait for the current request to be resolved.`,
      });
    }

    const request = await HealthRequest.create({
      farmerId,
      animalId,
      requestType: requestType || "disease",
      symptoms: symptoms.trim(),
      urgency: urgency || "medium",
      imageUrl: imageUrl || "",
      preferredDate: req.body.preferredDate || new Date(),
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
          title: urgency === "high" ? `🚨 Emergency: Tag #${animal.earTag || animal.animalId}` : `📋 Health Request: Tag #${animal.earTag || animal.animalId}`,
          message: `Farmer ${req.user.name} reported ${urgency} urgency symptoms for ${animal.species} (${animal.breed}): ${symptoms}`,
        })
      );

      const adminNotifs = admins.map(a =>
        Notification.create({
          recipientId: a._id,
          senderId: farmerId,
          type: "health-request",
          relatedId: request._id,
          title: urgency === "high" ? "[Summary] 🚨 Urgent Animal Issue" : "[Summary] Health Request Submitted",
          message: `Farmer ${req.user.name} reported a ${urgency} urgency health issue for animal ${animal.earTag || animal.animalId}.`,
        })
      );

      await Promise.all([...techNotifs, ...adminNotifs]);

      // --- MOBILE PUSH NOTIFICATIONS TO TECHNICIANS ---
      for (const t of technicians) {
        if (t.pushToken) {
          const title = urgency === "high" ? `🚨 Emergency: Tag #${animal.earTag || animal.animalId}` : `📋 Health Request: Tag #${animal.earTag || animal.animalId}`;
          const body = `${req.user.name} reported ${urgency} urgency symptoms: ${symptoms.substring(0, 100)}`;
          await sendPushNotification(t.pushToken, title, body);
        }
      }
    } catch (notifyErr) {
      console.error("[Notification Trigger Error]", notifyErr.message);
    }

    // --- TRIGGER SOCKET UPDATE ---
    req.app.get("io").emit("dashboardUpdate", { 
      type: "HEALTH_REQUEST_CREATED", 
      message: "New health request submitted",
      urgency 
    });

    res.status(201).json({ message: "Health request submitted.", request });
  } catch (error) {
    console.error("[createHealthRequest ERROR]", error.message);
    res.status(500).json({ message: error.message || "Failed to submit request." });
  }
};

// GET /api/health-request/my  — farmer's own requests
export const getMyHealthRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const farmerId = req.user._id;

    const query = { farmerId, deletedAt: null };
    if (status && status !== 'all') query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [requests, total] = await Promise.all([
      HealthRequest.find(query)
        .populate("animalId", "animalId earTag species breed imageUrl")
        .populate("handledBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      HealthRequest.countDocuments(query)
    ]);

    res.status(200).json({
      data: requests,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error("[getMyHealthRequests ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch your requests." });
  }
};

// GET /api/health-request  — all requests (technician/admin)
export const getAllHealthRequests = async (req, res) => {
  try {
    const { status, urgency } = req.query;
    const query = { deletedAt: null };
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

import { sendPushNotification } from "../lib/push-notifications.js";

// PATCH /api/health-request/:id/status  — technician/admin updates
export const updateHealthRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, technicianNote } = req.body;

    const VALID = ["pending", "approved", "in-progress", "resolved", "cancelled"];
    if (!VALID.includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const existing = await HealthRequest.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Request not found." });
    }

    // Concurrency guard: check if already assigned to another technician
    if (
      existing.handledBy &&
      existing.handledBy.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      const assignedTech = await User.findById(existing.handledBy);
      return res.status(403).json({
        message: `This health request is already being assisted by technician: ${assignedTech?.name || "another technician"}.`,
      });
    }

    const updateFields = {
      status,
      handledBy: req.user._id,
    };

    if (technicianNote !== undefined) updateFields.technicianNote = technicianNote;
    if (req.body.diagnosis !== undefined) updateFields.diagnosis = req.body.diagnosis;
    if (req.body.treatment !== undefined) updateFields.treatment = req.body.treatment;
    if (req.body.advice !== undefined) updateFields.advice = req.body.advice;
    if (req.body.scheduledDate !== undefined) {
      updateFields.scheduledDate = req.body.scheduledDate ? new Date(req.body.scheduledDate) : undefined;
    }

    const request = await HealthRequest.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { returnDocument: 'after' }
    )
      .populate("farmerId", "name pushToken")
      .populate("animalId", "animalId earTag species");

    if (!request) return res.status(404).json({ message: "Request not found." });

    // --- CREATE MEDICAL RECORD CASCADE IF RESOLVED ---
    if (status === "resolved") {
      try {
        let recordType = "Check-up";
        if (request.requestType === "medicine") recordType = "Treatment";
        else if (request.requestType === "disease") recordType = "Check-up";
        else if (request.requestType === "checkup") recordType = "Check-up";
        else if (request.requestType === "injury") recordType = "Treatment";

        const animalId = request.animalId._id || request.animalId;
        const farmerId = request.farmerId._id || request.farmerId;

        await MedicalRecord.create({
          animalId,
          farmerId,
          technicianId: req.user._id,
          type: recordType,
          date: new Date(),
          details: {
            medicineName: request.treatment || "None",
            diagnosis: request.diagnosis || "No specific diagnosis logged.",
            treatment: request.treatment || "No treatment logged.",
          },
          note: request.technicianNote || "Resolved through health request queue.",
        });
        console.log(`[Medical Record Cascade] Created successfully for Animal: ${animalId}`);
      } catch (medErr) {
        console.error("[Medical Record Cascade Error]", medErr.message);
      }
    }

    // --- TRIGGER NOTIFICATION TO FARMER ---
    try {
      if (request.farmerId && request.farmerId._id) {
        const title = "Health Request Update";
        let message = `Your health request for animal ${request.animalId.earTag || request.animalId.animalId} status has been updated to: ${status}.`;

        if (status === "resolved") {
          message = `Your health request for animal ${request.animalId.earTag || request.animalId.animalId} was successfully resolved by technician ${req.user.name}. Diagnosis: ${request.diagnosis || "N/A"}. Treatment: ${request.treatment || "N/A"}.`;
        } else if (status === "approved" || status === "in-progress") {
          const schedDateStr = request.scheduledDate ? new Date(request.scheduledDate).toLocaleDateString() : "today";
          message = `Your health request for animal ${request.animalId.earTag || request.animalId.animalId} has been approved and scheduled for ${schedDateStr}. Technician: ${req.user.name}.`;
        }

        // 1. Database Notification
        await Notification.create({
          recipientId: request.farmerId._id,
          senderId: req.user._id,
          type: "health-request",
          relatedId: request._id,
          title,
          message,
        });

        // 2. Mobile Push
        if (request.farmerId.pushToken) {
          await sendPushNotification(
            request.farmerId.pushToken,
            title,
            message,
            { requestId: request._id, type: 'health-request' }
          );
        }
      }
    } catch (notifyErr) {
      console.error("[Notification Trigger Error]", notifyErr.message);
    }

    // --- TRIGGER SOCKET UPDATE ---
    req.app.get("io").emit("dashboardUpdate", { 
      type: "HEALTH_REQUEST_UPDATED", 
      message: `Health request marked as ${status}`,
      status 
    });

    console.log(`[Health Request Updated] ${id} → ${status}`);
    res.status(200).json({ message: "Status updated.", request });
  } catch (error) {
    console.error("[updateHealthRequestStatus ERROR]", error.message);
    res.status(500).json({ message: "Failed to update status." });
  }
};

// POST /api/health-request/walk-in — technician recording a done service
export const walkInHealthRequest = async (req, res) => {
  try {
    const {
      farmerId,
      animalId: bodyAnimalId,
      firstName,
      lastName,
      phoneNumber,
      email,
      address,
      animalDetails,
      diagnosis,
      urgency,
      status,
      requestType,
      preferredDate,
      preferredTime,
      treatment,
      advice,
      technicianNote,
    } = req.body;

    if (!farmerId && (!phoneNumber || !animalDetails?.earTag)) {
      return res.status(400).json({ message: "Phone number and Animal Ear Tag are required for manual entry." });
    }

    if (!diagnosis) {
      return res.status(400).json({ message: "Diagnosis/Details required." });
    }

    // 1. Resolve or Create Farmer
    let farmer;
    if (farmerId) {
      farmer = await User.findById(farmerId);
    } else if (phoneNumber) {
      farmer = await User.findOne({ phoneNumber });
      if (!farmer) {
      if (email) {
        try {
          await clerkClient.invitations.createInvitation({
            emailAddress: email,
            publicMetadata: { role: "farmer" },
            redirectUrl: `${process.env.CLIENT_URL || "http://localhost:5173"}/download-app`,
          });
        } catch (clerkError) {
          console.error("[walkInHealth CLERK ERROR]", clerkError.message);
        }
      }

      farmer = await User.create({
        name: `${firstName || ""} ${lastName || ""}`.trim() || "Manual Entry Farmer",
        phoneNumber,
        email: email || undefined,
        address: {
          street: typeof address === 'object' && address?.street ? address.street : "",
          barangay: typeof address === 'string' ? address : (address?.barangay || "Not Provided"),
          city: typeof address === 'object' && address?.city ? address.city : "Oton",
          province: typeof address === 'object' && address?.province ? address.province : "Iloilo"
        },
        role: "farmer",
        isVerified: true, // Technician-verified
      });
    }
  }

  if (!farmer) {
    return res.status(400).json({ message: "Farmer details are required." });
  }

    // 2. Resolve or Create Animal
    let animal;
    if (bodyAnimalId) {
      animal = await Animal.findById(bodyAnimalId);
    } else {
      animal = await Animal.findOne({ earTag: animalDetails.earTag });
      if (!animal) {
        const newAnimalId = `ANM-${Date.now().toString().slice(-6)}`;
        animal = await Animal.create({
          farmerId: farmer._id,
          animalId: newAnimalId,
          earTag: animalDetails.earTag,
          species: animalDetails.species || "Beef",
          breed: animalDetails.breed || "Crossbreed",
          barangay: farmer.address?.barangay || "Not Provided",
          isVerified: true,
        });
      }
    }

    // 3. Create Health Request (Resolved or Pending)
    // Combine date and time into a single timestamp
    const pDateString = preferredDate || new Date().toISOString().split('T')[0];
    const pTimeString = preferredTime || "08:00";
    const pDate = new Date(`${pDateString}T${pTimeString}:00+08:00`);

    const request = await HealthRequest.create({
      farmerId: farmer._id,
      animalId: animal._id,
      requestType: requestType || "disease",
      symptoms: diagnosis,
      urgency: urgency || "low",
      status: status || "resolved",
      handledBy: req.user._id,
      technicianNote: technicianNote || (status === "resolved" ? "Walk-in service recorded by technician." : "Visit scheduled by technician."),
      diagnosis: diagnosis || "",
      treatment: treatment || "",
      advice: advice || "",
      preferredDate: pDate,
      scheduledDate: pDate,
    });

    // --- CREATE MEDICAL RECORD CASCADE IF RESOLVED ---
    if (request.status === "resolved") {
      try {
        let recordType = "Check-up";
        if (request.requestType === "medicine") recordType = "Treatment";
        else if (request.requestType === "disease") recordType = "Check-up";
        else if (request.requestType === "checkup") recordType = "Check-up";
        else if (request.requestType === "injury") recordType = "Treatment";

        await MedicalRecord.create({
          animalId: animal._id,
          farmerId: farmer._id,
          technicianId: req.user._id,
          type: recordType,
          date: pDate || new Date(),
          details: {
            medicineName: treatment || "None",
            diagnosis: diagnosis || "No specific diagnosis logged.",
            treatment: treatment || "No treatment logged.",
          },
          note: technicianNote || "Recorded via walk-in service.",
        });
        console.log(`[Medical Record Cascade] Created successfully for Walk-in Animal: ${animal._id}`);
      } catch (medErr) {
        console.error("[Medical Record Cascade Walk-in Error]", medErr.message);
      }
    }

    const title = status === "resolved" ? "Health Service Recorded" : "Health Visit Scheduled";
    const message = status === "resolved" 
      ? `A walk-in health service for your animal (${animal.earTag}) has been recorded by technician ${req.user.name}.`
      : `A health visit for your animal (${animal.earTag}) has been scheduled for ${pDate.toLocaleDateString()} at ${pDate.toLocaleTimeString()}.`;

    // 1. Database Notification
    await Notification.create({
      recipientId: farmer._id,
      senderId: req.user._id,
      type: "health-request",
      relatedId: request._id,
      title,
      message,
    });

    // 2. Mobile Push
    if (farmer.pushToken) {
      await sendPushNotification(
        farmer.pushToken,
        title,
        message,
        { requestId: request._id, type: 'health-request' }
      );
    }

    // Trigger Socket
    req.app.get("io").emit("dashboardUpdate", { 
      type: status === "resolved" ? "WALKIN_HEALTH_RECORDED" : "HEALTH_REQUEST_CREATED" 
    });

    res.status(201).json({ 
      message: status === "resolved" ? "Walk-in health service recorded." : "Health visit scheduled.", 
      request 
    });
  } catch (error) {
    console.error("[walkInHealthRequest ERROR]", error.message);
    res.status(500).json({ message: "Failed to process health service.", error: error.message });
  }
};

// DELETE /api/health-request/:id
export const deleteHealthRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await HealthRequest.findOne({ _id: id, deletedAt: null })
      .populate("farmerId", "name")
      .populate("animalId", "earTag animalId");

    if (!request) {
      return res.status(404).json({ message: "Health request not found." });
    }

    // Permission Check: Allow owner OR Technician
    const isOwner = request.farmerId && request.farmerId._id.toString() === req.user._id.toString();
    const isTechnician = req.user.role === 'technician';

    if (!isOwner && !isTechnician) {
      return res.status(403).json({ message: "Unauthorized to delete this request." });
    }

    // Status restriction: Only for farmers. Technicians can delete any (for testing/cleanup)
    if (isOwner && !["pending", "approved", "in-progress", "rejected"].includes(request.status)) {
      return res.status(400).json({ message: "Completed requests cannot be cancelled." });
    }

    // --- SEND CANCELLED PUSH NOTIFICATION TO TECHNICIANS ---
    try {
      if (isOwner && ["pending", "approved", "in-progress"].includes(request.status)) {
        const technicians = await User.find({ role: "technician" });
        for (const t of technicians) {
          if (t.pushToken) {
            await sendPushNotification(
              t.pushToken,
              "❌ Health Request Cancelled",
              `${request.farmerId?.name} has cancelled the health request for animal ${request.animalId?.earTag || request.animalId?.animalId}.`
            );
          }
        }
      }
    } catch (notifyErr) {
      console.error("[Notification Trigger Error]", notifyErr.message);
    }

    await HealthRequest.findByIdAndUpdate(id, { $set: { deletedAt: new Date() } });

    // Socket update
    req.app.get("io").emit("dashboardUpdate", {
      type: "HEALTH_REQUEST_DELETED",
      message: "A health request was cancelled by the farmer",
    });

    res.status(200).json({ message: "Health record deleted successfully." });
  } catch (error) {
    console.error("[deleteHealthRequest ERROR]", error.message);
    res.status(500).json({ message: "Failed to delete health record." });
  }
};
