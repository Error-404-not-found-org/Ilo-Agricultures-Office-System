import { HealthRequest } from "../models/health-request.model.js";
import { Animal } from "../models/animal.model.js";
import { User } from "../models/user.model.js";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { Insemination } from "../models/insemination.model.js";
import cloudinary from "../config/cloudinary.js";
import { assertStatusTransition } from "../domain/livestock-workflow.js";
import { resolveRequestLocation } from "../domain/geographic/municipalityResolver.js";
import {
  createResolvedWalkInHealth,
  resolveHealthRequest,
} from "../services/livestock-transaction.service.js";
import {
  HEALTH_STATUS,
  isActiveHealthRequestStatus,
  normalizeHealthStatus,
} from "../domain/status-vocabulary.js";
import {
  activeHealthCaseKey,
  createHealthRequestWithGuard,
  findActiveHealthCase,
} from "../services/health-request-creation.service.js";
import { notifyUser } from "../services/notification-delivery.service.js";
import { notifyDispatchRequestSubmitted } from "../services/dispatch-request-notification.service.js";
import {
  hasVisitScheduleChanged,
  normalizeVisitPeriod,
  normalizeVisitScheduleDate,
} from "../domain/visit-scheduling.js";

// POST /api/health-request
export const createHealthRequest = async (req, res) => {
  try {
    const farmerId = req.user._id;
    const { animalId, requestType, symptoms, urgency, imageUrl, farmerNotes, photos } = req.body;
    const normalizedUrgency = urgency === "critical" ? "emergency" : (urgency || "medium");
    if (!["low", "medium", "high", "emergency"].includes(normalizedUrgency)) {
      return res.status(400).json({ message: "Invalid health urgency value." });
    }

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

    const normalizedRequestType = requestType || "disease";
    const existingActiveRequest = await findActiveHealthCase(
      animalId,
      normalizedRequestType,
    );

    if (existingActiveRequest) {
      return res.status(409).json({
        code: "ACTIVE_HEALTH_CASE_EXISTS",
        message: `An active ${normalizedRequestType.replaceAll("_", " ")} health case already exists for ${animal.earTag || animal.animalId}. View or update the existing case before submitting another one.`,
        existingRequestId: existingActiveRequest._id,
        existingRequestStatus: existingActiveRequest.status,
        existingRequestType: existingActiveRequest.requestType,
      });
    }

    const dispatchLocation = resolveRequestLocation(req.user);
    const dispatchSnapshot = {
      location: dispatchLocation,
      stage: "local",
      resolutionStatus: dispatchLocation.source === "unresolved" ? "unresolved" : "resolved",
      version: 1,
      resolvedAt: new Date()
    };

    const normalizedFarmerNotes = typeof farmerNotes === "string" ? farmerNotes.trim() : "";

    if (photos !== undefined) {
      if (!Array.isArray(photos) || !photos.every(p => typeof p === "string")) {
        return res.status(400).json({ code: "INVALID_PHOTOS", message: "Photos must be an array of strings." });
      }
      if (photos.length > 5) {
        return res.status(400).json({ code: "TOO_MANY_PHOTOS", message: "Maximum of 5 photos allowed." });
      }
    }
    const normalizedPhotos = (photos || []).map(p => p.trim()).filter(p => p.length > 0);

    const request = await createHealthRequestWithGuard({
      farmerId,
      animalId,
      requestType: normalizedRequestType,
      symptoms: symptoms.trim(),
      urgency: normalizedUrgency,
      imageUrl: imageUrl || "",
      farmerNotes: normalizedFarmerNotes,
      photos: normalizedPhotos,
      dispatch: dispatchSnapshot,
    });

    console.log(`[Health Request Created] Farmer: ${farmerId} | Animal: ${animal.animalId} | Type: ${requestType} | Urgency: ${urgency}`);

    // --- TRIGGER NOTIFICATIONS ---
    try {
      await notifyDispatchRequestSubmitted({
        request,
        requestType: "HEALTH",
        animal,
        farmer: req.user,
      });
    } catch (notifyErr) {
      console.error("[Notification Delivery Error]", notifyErr.message);
    }

    // --- TRIGGER SOCKET UPDATE ---
    req.app.get("io").emit("dashboardUpdate", { 
      type: "HEALTH_REQUEST_CREATED", 
      message: "New health request submitted",
      urgency: normalizedUrgency
    });

    res.status(201).json({ message: "Health request submitted.", request });
  } catch (error) {
    console.error("[createHealthRequest ERROR]", error.message);
    res.status(error.status || 500).json({
      message: error.message || "Failed to submit request.",
      code: error.code,
      ...(error.details || {}),
    });
  }
};

// GET /api/health-request/my  — farmer's own requests
export const getMyHealthRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const farmerId = req.user._id;

    const query = { farmerId, deletedAt: null, farmerDismissedAt: null };
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

// PATCH /api/health-request/:id/dismiss
// Hides a terminal request for its farmer without deleting the official
// clinical and service history.
export const dismissHealthRequestForFarmer = async (req, res) => {
  try {
    if (req.user.role !== "farmer") {
      return res.status(403).json({
        message: "Only the farmer who submitted this request can remove it from their history.",
      });
    }

    const request = await HealthRequest.findOne({
      _id: req.params.id,
      farmerId: req.user._id,
      deletedAt: null,
    }).select("status farmerDismissedAt");

    if (!request) {
      return res.status(404).json({ message: "Health assistance request not found." });
    }
    if (!["cancelled", "rejected"].includes(request.status)) {
      return res.status(409).json({
        message: "Only cancelled or rejected requests can be removed from your history.",
      });
    }

    if (!request.farmerDismissedAt) {
      await HealthRequest.updateOne(
        {
          _id: request._id,
          farmerId: req.user._id,
          status: { $in: ["cancelled", "rejected"] },
          farmerDismissedAt: null,
        },
        { $set: { farmerDismissedAt: new Date() } },
      );
    }

    return res.status(200).json({
      message: "Request removed from your history.",
    });
  } catch (error) {
    console.error("[dismissHealthRequestForFarmer ERROR]", error.message);
    return res.status(500).json({
      message: "Failed to remove the request from your history.",
    });
  }
};

// GET /api/health-request  — all requests (technician/admin)
export const getAllHealthRequests = async (req, res) => {
  try {
    const { status, urgency, page, limit, search, fromDate, toDate } = req.query;
    const query = { deletedAt: null };
    if (status) query.status = status;
    if (urgency) query.urgency = urgency;
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      const [matchedFarmers, matchedAnimals] = await Promise.all([
        User.find({ name: searchRegex, role: "farmer" }).select("_id").lean(),
        Animal.find({
          $or: [
            { animalId: searchRegex },
            { earTag: searchRegex },
            { breed: searchRegex },
            { species: searchRegex },
          ],
        }).select("_id").lean(),
      ]);

      query.$or = [
        { symptoms: searchRegex },
        { requestType: searchRegex },
        { farmerNotes: searchRegex },
        { diagnosis: searchRegex },
        { treatment: searchRegex },
        { farmerId: { $in: matchedFarmers.map((farmer) => farmer._id) } },
        { animalId: { $in: matchedAnimals.map((animal) => animal._id) } },
      ];
    }

    if (page || limit) {
      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
      const skip = (pageNum - 1) * limitNum;

      const [requests, total, summaryRows] = await Promise.all([
        HealthRequest.find(query)
          .populate("farmerId", "name address imageUrl")
          .populate("animalId", "animalId earTag species breed imageUrl")
          .populate("handledBy", "name")
          .sort({ urgency: -1, createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        HealthRequest.countDocuments(query),
        HealthRequest.aggregate([
          { $match: query },
          {
            $group: {
              _id: null,
              highUrgency: {
                $sum: { $cond: [{ $in: ["$urgency", ["high", "emergency"]] }, 1, 0] },
              },
              resolved: {
                $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
              },
              active: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        "$status",
                        ["pending", "triaged", "assigned", "approved", "scheduled", "in-progress", "in_progress"],
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]),
      ]);

      const summary = summaryRows[0] || { highUrgency: 0, resolved: 0, active: 0 };

      return res.status(200).json({
        data: requests,
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        summary: {
          total,
          highUrgency: summary.highUrgency,
          resolved: summary.resolved,
          active: summary.active,
        },
      });
    }

    const requests = await HealthRequest.find(query)
      .populate("farmerId", "name address imageUrl")
      .populate("animalId", "animalId earTag species breed imageUrl")
      .populate("handledBy", "name")
      .sort({ urgency: -1, createdAt: -1 })
      .limit(100);

    res.status(200).json(requests);
  } catch (error) {
    console.error("[getAllHealthRequests ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch requests." });
  }
};

import { createAuditLog } from "../services/audit.service.js";

// PATCH /api/health-request/:id/status  — technician/admin updates
export const updateHealthRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status: requestedStatus, technicianNote } = req.body;
    const status = normalizeHealthStatus(requestedStatus);

    const VALID = Object.values(HEALTH_STATUS).filter(
      (value) => value !== HEALTH_STATUS.IN_PROGRESS_LEGACY,
    );
    if (!VALID.includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const existing = await HealthRequest.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Request not found." });
    }

    let normalizedScheduledDate;
    let normalizedVisitPeriod;

    if (status === "scheduled") {
      try {
        if (!req.body.scheduledDate) {
          return res.status(400).json({
            message: "A visit date is required before scheduling.",
            code: "SCHEDULE_DATE_REQUIRED",
          });
        }
        if (!req.body.visitPeriod) {
          return res.status(400).json({
            message: "A visit period is required before scheduling.",
            code: "VISIT_PERIOD_REQUIRED",
          });
        }
        normalizedScheduledDate = normalizeVisitScheduleDate(req.body.scheduledDate);
        normalizedVisitPeriod = normalizeVisitPeriod(req.body.visitPeriod);
      } catch (err) {
        return res.status(400).json({
          message: err.message,
          code: err.code || "INVALID_SCHEDULE",
        });
      }
    }

    const isRescheduled =
      status === "scheduled" &&
      existing.status === "scheduled" &&
      hasVisitScheduleChanged(
        existing.scheduledDate,
        existing.visitPeriod,
        normalizedScheduledDate,
        normalizedVisitPeriod
      );

    if (status === "in-progress" && !existing.scheduledDate) {
      return res.status(400).json({
        message: "Schedule this visit before starting the service.",
        code: "VISIT_NOT_SCHEDULED",
      });
    }

    assertStatusTransition("health", existing.status, status, { isAdmin: req.user.role === "admin" });

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

    const targetTechId = (req.user.role === "admin" && req.body.handledBy) ? req.body.handledBy : req.user._id;

    const updateFields = {
      status,
      handledBy: targetTechId,
    };
    if (isActiveHealthRequestStatus(status)) {
      updateFields.activeCaseKey = activeHealthCaseKey(
        existing.animalId,
        existing.requestType,
      );
    }

    if (technicianNote !== undefined) updateFields.technicianNote = technicianNote;
    if (req.body.diagnosis !== undefined) updateFields.diagnosis = req.body.diagnosis;
    if (req.body.treatment !== undefined) updateFields.treatment = req.body.treatment;
    if (req.body.advice !== undefined) updateFields.advice = req.body.advice;
    if (status === "scheduled") {
      updateFields.scheduledDate = normalizedScheduledDate;
      updateFields.visitPeriod = normalizedVisitPeriod;
    }
    if (status === "in-progress" && !existing.serviceStartedAt) {
      updateFields.serviceStartedAt = new Date();
    }
    if (req.body.followUpDate !== undefined) {
      updateFields.followUpDate = req.body.followUpDate ? new Date(req.body.followUpDate) : undefined;
    }

    let request;
    if (status === "resolved") {
      const recordTypes = { medicine: "Treatment", disease: "Check-up", checkup: "Check-up", injury: "Treatment", vaccination: "Vaccination", deworming: "Deworming" };
      const withdrawalDays = req.body.withdrawalPeriodDays;
      const withdrawalEndDate = withdrawalDays && !isNaN(withdrawalDays)
        ? new Date(Date.now() + Number(withdrawalDays) * 24 * 60 * 60 * 1000)
        : undefined;
      request = await resolveHealthRequest({
        id,
        updateFields,
        technicianId: req.user._id,
        taskId: req.body.taskId,
        medicalRecord: {
          animalId: existing.animalId,
          farmerId: existing.farmerId,
          type: recordTypes[existing.requestType] || "Check-up",
          date: new Date(),
          details: {
            medicineName: updateFields.treatment || existing.treatment || "None",
            diagnosis: updateFields.diagnosis || existing.diagnosis || "No specific diagnosis logged.",
            treatment: updateFields.treatment || existing.treatment || "No treatment logged.",
            withdrawalPeriodDays: withdrawalDays ? Number(withdrawalDays) : undefined,
            withdrawalEndDate,
          },
          note: updateFields.technicianNote || existing.technicianNote || "Resolved through health request queue.",
          followUpDate: updateFields.followUpDate,
        },
      });
      await request.populate("farmerId", "name pushToken");
      await request.populate("animalId", "animalId earTag species");
    } else {
      const statusUpdate = isActiveHealthRequestStatus(status)
        ? { $set: updateFields }
        : { $set: updateFields, $unset: { activeCaseKey: 1 } };
      request = await HealthRequest.findByIdAndUpdate(id, statusUpdate, { returnDocument: 'after' })
        .populate("farmerId", "name pushToken")
        .populate("animalId", "animalId earTag species");
    }

    if (!request) return res.status(404).json({ message: "Request not found." });

    // The transaction service is the sole medical-record writer. This block
    // only performs the post-commit withdrawal notification side effect.
    if (status === "resolved") {
      try {
        const animalId = request.animalId._id || request.animalId;
        const farmerId = request.farmerId._id || request.farmerId;
        const withdrawalDays = req.body.withdrawalPeriodDays;
        let withdrawalEndDate = null;
        if (withdrawalDays && !isNaN(withdrawalDays)) {
          withdrawalEndDate = new Date(Date.now() + Number(withdrawalDays) * 24 * 60 * 60 * 1000);
        }

        // Send a withdrawal period alert if active
        if (withdrawalDays && Number(withdrawalDays) > 0 && withdrawalEndDate) {
          const formattedDate = withdrawalEndDate.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          });
          const warningTitle = "Active withdrawal warning";
          const warningBody = `Meat and milk from animal Tag #${request.animalId.earTag || request.animalId.animalId} are unsafe for consumption or sale until ${formattedDate} due to treatment with ${request.treatment || 'medicine'}.`;

          await notifyUser({
            recipient: request.farmerId,
            recipientId: farmerId,
            senderId: req.user._id,
            type: "system",
            relatedId: animalId,
            category: "health",
            eventType: "withdrawal_safety_active",
            linkType: "animal",
            title: warningTitle,
            message: warningBody,
            metadata: {
              animalId,
              animalTag: request.animalId.earTag || request.animalId.animalId,
              withdrawalEndDate,
              medicineName: request.treatment || "medicine",
            },
          });
        }
      } catch (withdrawalNotifyErr) {
        console.error("[Withdrawal Notification Error]", withdrawalNotifyErr.message);
      }
    }

    // --- TRIGGER NOTIFICATION TO FARMER ---
    try {
      if (request.farmerId && request.farmerId._id) {
        const eventType =
          status === "resolved"
            ? "service_completed"
            : status === "approved"
              ? "service_request_accepted"
              : status === "in-progress"
                ? "service_started"
                : status === "scheduled"
                  ? isRescheduled
                    ? "service_visit_rescheduled"
                    : "service_visit_scheduled"
                  : status === "rejected"
                    ? "service_request_declined"
                    : "service_status_updated";
        await notifyUser({
          recipient: request.farmerId,
          senderId: req.user._id,
          type: "health-request",
          relatedId: request._id,
          category: "health",
          eventType,
          linkType: "request",
          title: "Health assistance update",
          message: `The health assistance request for ${request.animalId.earTag || request.animalId.animalId} is now ${status}.`,
          metadata: {
            requestId: request._id,
            animalId: request.animalId?._id,
            animalTag: request.animalId.earTag || request.animalId.animalId,
            serviceType: "health",
            technicianName: req.user.name,
            scheduledDate: request.scheduledDate,
            visitPeriod: request.visitPeriod,
            reason: technicianNote || "",
          },
        });
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
    const transactionUnavailable = /Transaction numbers are only allowed|replica set|mongos/i.test(error.message);
    res.status(transactionUnavailable ? 503 : error.status || 500).json({
      message: transactionUnavailable ? "This operation requires a transaction-capable database." : error.message || "Failed to update status.",
      code: transactionUnavailable ? "TRANSACTION_UNAVAILABLE" : error.code,
    });
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
          const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").trim();
          const normalizedClientUrl = /^https?:\/\//i.test(clientUrl) ? clientUrl : `https://${clientUrl}`;
          const finalRedirectUrl = `${normalizedClientUrl.replace(/\/$/, "")}/download-app`;

          await clerkClient.invitations.createInvitation({
            emailAddress: email,
            publicMetadata: { role: "farmer" },
            redirectUrl: finalRedirectUrl,
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
        let animalImageUrl = "";
        if (animalDetails.imageUrl && animalDetails.imageUrl.startsWith("data:image")) {
          try {
            const uploadResponse = await cloudinary.uploader.upload(animalDetails.imageUrl, {
              folder: "livestock_profiles",
            });
            animalImageUrl = uploadResponse.secure_url;
          } catch (err) {
            console.error("Cloudinary animal image upload failed", err);
          }
        }

        const newAnimalId = `ANM-${Date.now().toString().slice(-6)}`;
        animal = await Animal.create({
          farmerId: farmer._id,
          animalId: newAnimalId,
          earTag: animalDetails.earTag,
          species: animalDetails.species || "Beef",
          breed: animalDetails.breed || "Crossbreed",
          gender: animalDetails.gender || "Female",
          color: animalDetails.color || "Brown",
          dob: animalDetails.dob || new Date().toISOString().split('T')[0],
          imageUrl: animalImageUrl || undefined,
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

    const requestedStatus = status || "resolved";
    const normalizedRequestType = requestType || "disease";
    const requestData = {
      farmerId: farmer._id,
      animalId: animal._id,
      requestType: normalizedRequestType,
      symptoms: diagnosis,
      urgency: urgency || "low",
      status: requestedStatus,
      handledBy: req.user._id,
      technicianNote: technicianNote || (requestedStatus === "resolved" ? "Walk-in service recorded by technician." : "Visit scheduled by technician."),
      diagnosis: diagnosis || "",
      treatment: treatment || "",
      advice: advice || "",
      preferredDate: pDate,
      scheduledDate: pDate,
    };

    let recordType = "Check-up";
    if (normalizedRequestType === "medicine") recordType = "Treatment";
    else if (normalizedRequestType === "injury") recordType = "Treatment";
    else if (normalizedRequestType === "vaccination") recordType = "Vaccination";
    else if (normalizedRequestType === "deworming") recordType = "Deworming";

    const withdrawalDays = req.body.withdrawalPeriodDays;
    const withdrawalEndDate = withdrawalDays && !isNaN(withdrawalDays)
      ? new Date(Date.now() + Number(withdrawalDays) * 24 * 60 * 60 * 1000)
      : null;

    let request;
    if (requestedStatus === "resolved") {
      const created = await createResolvedWalkInHealth({
        requestData,
        taskId: req.body.taskId,
        medicalRecord: {
          animalId: animal._id,
          farmerId: farmer._id,
          technicianId: req.user._id,
          type: recordType,
          date: pDate,
          details: {
            medicineName: treatment || "None",
            diagnosis: diagnosis || "No specific diagnosis logged.",
            treatment: treatment || "No treatment logged.",
            withdrawalPeriodDays: withdrawalDays ? Number(withdrawalDays) : undefined,
            withdrawalEndDate: withdrawalEndDate || undefined,
          },
          note: technicianNote || "Recorded via walk-in service.",
          followUpDate: req.body.followUpDate ? new Date(req.body.followUpDate) : undefined,
        },
      });
      request = created.request;
    } else {
      request = await createHealthRequestWithGuard(requestData);
    }

    // --- CREATE MEDICAL RECORD CASCADE IF RESOLVED ---
    if (request.status === "resolved") {
      try {
        console.log(`[Medical Record Transaction] Created successfully for Walk-in Animal: ${animal._id}`);

        // Send a withdrawal period alert if active
        if (withdrawalDays && Number(withdrawalDays) > 0 && withdrawalEndDate) {
          const formattedDate = withdrawalEndDate.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          });
          const warningTitle = "Active withdrawal warning";
          const warningBody = `Meat and milk from animal Tag #${animal.earTag} are unsafe for consumption or sale until ${formattedDate} due to treatment with ${treatment || 'medicine'}.`;

          await notifyUser({
            recipient: farmer,
            senderId: req.user._id,
            type: "system",
            relatedId: animal._id,
            category: "health",
            eventType: "withdrawal_safety_active",
            linkType: "animal",
            title: warningTitle,
            message: warningBody,
            metadata: {
              animalId: animal._id,
              animalTag: animal.earTag,
              withdrawalEndDate,
              medicineName: treatment || "medicine",
            },
          });
        }
      } catch (medErr) {
        console.error("[Medical Record Cascade Walk-in Error]", medErr.message);
      }
    }

    const title = requestedStatus === "resolved" ? "Health Service Recorded" : "Health Visit Scheduled";
    const message = requestedStatus === "resolved" 
      ? `A walk-in health service for your animal (${animal.earTag}) has been recorded by technician ${req.user.name}.`
      : `A health visit for your animal (${animal.earTag}) has been scheduled for ${pDate.toLocaleDateString()} at ${pDate.toLocaleTimeString()}.`;

    await notifyUser({
      recipient: farmer,
      senderId: req.user._id,
      type: "health-request",
      relatedId: request._id,
      category: "health",
      eventType:
        requestedStatus === "resolved"
          ? "service_completed"
          : "service_visit_scheduled",
      linkType: "request",
      title,
      message,
      metadata: {
        requestId: request._id,
        animalId: animal._id,
        animalTag: animal.earTag || animal.animalId,
        serviceType: "health",
        technicianName: req.user.name,
        scheduledDate: request.scheduledDate || pDate,
      },
    });

    // Trigger Socket
    req.app.get("io").emit("dashboardUpdate", { 
      type: requestedStatus === "resolved" ? "WALKIN_HEALTH_RECORDED" : "HEALTH_REQUEST_CREATED" 
    });

    res.status(201).json({ 
      message: requestedStatus === "resolved" ? "Walk-in health service recorded." : "Health visit scheduled.", 
      request 
    });
  } catch (error) {
    console.error("[walkInHealthRequest ERROR]", error.message);
    res.status(error.status || 500).json({
      message: error.message || "Failed to process health service.",
      code: error.code,
      ...(error.details || {}),
    });
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

    // Notify technicians in-app and by push when the farmer removes an active request.
    try {
      if (isOwner && ["pending", "approved", "in-progress"].includes(request.status)) {
        const technicians = await User.find({ role: "technician" });
        for (const t of technicians) {
          await notifyUser({
            recipient: t,
            senderId: req.user._id,
            type: "health-request",
            relatedId: request._id,
            category: "cancellation",
            eventType: "request_cancelled",
            linkType: "request",
            dedupeKey: `health-request-removed:${request._id}:${t._id}`,
            title: "Health assistance request cancelled",
            message: `${request.farmerId?.name} cancelled the health assistance request for ${request.animalId?.earTag || request.animalId?.animalId}.`,
            metadata: {
              requestId: request._id,
              animalId: request.animalId?._id,
              animalTag: request.animalId?.earTag || request.animalId?.animalId,
              farmerName: request.farmerId?.name,
              actorName: request.farmerId?.name,
              serviceType: "health",
            },
          });
        }
      }
    } catch (notifyErr) {
      console.error("[Notification Trigger Error]", notifyErr.message);
    }

    await HealthRequest.findByIdAndUpdate(id, {
      $set: { deletedAt: new Date() },
      $unset: { activeCaseKey: 1 },
    });

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

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/health-request/:id/cancel
// Smart cancellation — respects role + status rules
// ─────────────────────────────────────────────────────────────────────────────
export const cancelHealthRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const actor = req.user;
    const role = actor.role;

    const request = await HealthRequest.findOne({ _id: id, deletedAt: null })
      .populate("farmerId", "name pushToken")
      .populate("animalId", "earTag animalId")
      .populate("handledBy", "name pushToken");

    if (!request) {
      return res.status(404).json({ message: "Health request not found." });
    }

    const status = request.status;
    const isFarmer = role === "farmer";
    const isTechnician = role === "technician";
    const isAdmin = role === "admin";
    const isOwner = request.farmerId?._id.toString() === actor._id.toString();

    if (isFarmer && !isOwner) {
      return res.status(403).json({ message: "You do not own this request." });
    }

    // Block terminal states
    if (["cancelled", "resolved", "rejected"].includes(status)) {
      return res.status(400).json({ message: `Request is already ${status}. Cannot cancel.` });
    }

    // Block farmer and technician from cancelling in-progress
    if (status === "in-progress" && !isAdmin) {
      return res.status(403).json({ message: "This request is currently in progress and cannot be cancelled." });
    }

    const previousStatus = status;
    const assignedTech = request.handledBy;
    const farmer = request.farmerId;
    const animal = request.animalId;
    const animalTag = animal?.earTag || animal?.animalId || "the animal";
    const now = new Date();

    // Determine scheduled / Ready Today
    const isScheduled = status === "scheduled";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduledDay = request.scheduledDate ? new Date(request.scheduledDate) : null;
    if (scheduledDay) scheduledDay.setHours(0, 0, 0, 0);
    const isReadyToday = isScheduled && scheduledDay && scheduledDay.getTime() === today.getTime();

    // ─── FARMER path ──────────────────────────────────────────────────────────
    if (isFarmer) {
      if (isScheduled) {
        if (!reason || reason.trim() === "") {
          return res.status(400).json({ message: "A reason is required to request cancellation of a scheduled visit." });
        }
        request.cancellationStatus = "requested";
        request.cancellationReason = reason.trim();
        request.cancellationResponseReason = "";
        request.cancellationRespondedAt = undefined;
        request.cancelledBy = actor._id;
        request.cancellationRequestedAt = now;
        request.statusHistory = request.statusHistory || [];
        request.statusHistory.push({ status: "cancellation_requested", note: reason.trim(), actorId: actor._id });
        await request.save();

        await createAuditLog({
          entityType: "HealthRequest",
          entityId: request._id,
          action: "CANCEL_REQUEST",
          actorId: actor._id,
          before: { status: previousStatus, cancellationStatus: "none" },
          after: { cancellationStatus: "requested" },
          metadata: { role, reason: reason.trim(), isReadyToday },
        });

        try {
          if (assignedTech?._id) {
            await notifyUser({
              recipient: assignedTech,
              senderId: actor._id,
              type: "health-request",
              relatedId: request._id,
              category: "cancellations",
              eventType: "cancellation_requested",
              linkType: "request",
              metadata: {
                requestId: request._id,
                animalId: animal?._id,
                animalTag,
                serviceType: "health",
                farmerName: farmer?.name,
                reason: reason.trim(),
                isToday: Boolean(isReadyToday),
              },
            });
          }
          const admins = await User.find({ role: "admin" });
          for (const admin of admins) {
            await notifyUser({
              recipient: admin,
              senderId: actor._id,
              type: "health-request",
              relatedId: request._id,
              category: "cancellations",
              eventType: "cancellation_requested",
              linkType: "request",
              metadata: {
                requestId: request._id,
                animalId: animal?._id,
                animalTag,
                serviceType: "health",
                farmerName: farmer?.name,
                reason: reason.trim(),
                isToday: Boolean(isReadyToday),
              },
            });
          }
        } catch (notifyErr) {
          console.error("[cancelHealthRequest notify ERROR]", notifyErr.message);
        }

        return res.status(200).json({ message: "Cancellation request submitted. Awaiting technician review.", cancellationStatus: "requested" });
      }

      if (!["pending", "approved"].includes(status)) {
        return res.status(400).json({ message: `Farmers cannot directly cancel a request with status: ${status}.` });
      }

      if (status === "approved" && !reason?.trim()) {
        return res.status(400).json({
          message: "A cancellation reason is required after a technician has accepted the request.",
          code: "CANCELLATION_REASON_REQUIRED",
        });
      }
    }

    // ─── TECHNICIAN / ADMIN direct cancel ─────────────────────────────────────
    if ((isTechnician || isAdmin) && !reason?.trim()) {
      return res.status(400).json({ message: "A cancellation reason is required." });
    }

    request.status = "cancelled";
    request.cancellationReason = reason?.trim() || "";
    request.cancelledBy = actor._id;
    request.cancellationRequestedAt = now;
    request.cancellationStatus = "approved";
    request.statusHistory = request.statusHistory || [];
    request.statusHistory.push({
      status: "cancelled",
      note: reason?.trim() || `Cancelled by ${role}`,
      actorId: actor._id,
    });
    await request.save();

    await createAuditLog({
      entityType: "HealthRequest",
      entityId: request._id,
      action: "CANCEL",
      actorId: actor._id,
      before: { status: previousStatus },
      after: { status: "cancelled" },
      metadata: { role, reason: reason?.trim() || "" },
    });

    try {
      const cancellationMetadata = {
        requestId: request._id,
        animalId: animal?._id,
        animalTag,
        serviceType: "health",
        actorName: isFarmer ? farmer?.name : actor.name || role,
        reason: reason?.trim() || "",
      };
      if (isFarmer && assignedTech?._id) {
        await notifyUser({
          recipient: assignedTech,
          senderId: actor._id,
          type: "health-request",
          relatedId: request._id,
          category: "cancellations",
          eventType: "request_cancelled",
          linkType: "request",
          metadata: cancellationMetadata,
        });
      } else if (!isFarmer && farmer?._id) {
        await notifyUser({
          recipient: farmer,
          senderId: actor._id,
          type: "health-request",
          relatedId: request._id,
          category: "cancellations",
          eventType: "request_cancelled",
          linkType: "request",
          metadata: cancellationMetadata,
        });
        if (isAdmin && assignedTech?._id) {
          await notifyUser({
            recipient: assignedTech,
            senderId: actor._id,
            type: "health-request",
            relatedId: request._id,
            category: "cancellations",
            eventType: "request_cancelled",
            linkType: "request",
            metadata: cancellationMetadata,
          });
        }
      }
    } catch (notifyErr) {
      console.error("[cancelHealthRequest notify ERROR]", notifyErr.message);
    }

    req.app.get("io").emit("requestCancelled", {
      type: "HEALTH",
      requestId: request._id,
      technicianId: assignedTech?._id,
      scheduledDate: request.scheduledDate,
      farmerId: farmer?._id,
    });

    return res.status(200).json({ message: "Health request cancelled successfully." });
  } catch (error) {
    console.error("[cancelHealthRequest ERROR]", error.message);
    return res.status(500).json({ message: "Failed to cancel health request." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/health-request/:id/cancel-respond
// Technician or Admin approves or rejects a farmer's cancellation request
// ─────────────────────────────────────────────────────────────────────────────
export const respondHealthCancellation = async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, reason } = req.body;
    const actor = req.user;
    const role = actor.role;

    if (!["technician", "admin"].includes(role)) {
      return res.status(403).json({ message: "Only technicians or admins can respond to cancellation requests." });
    }

    const request = await HealthRequest.findOne({ _id: id, deletedAt: null })
      .populate("farmerId", "name pushToken")
      .populate("animalId", "earTag animalId")
      .populate("handledBy", "name pushToken");

    if (!request) {
      return res.status(404).json({ message: "Health request not found." });
    }

    if (request.cancellationStatus !== "requested") {
      return res.status(400).json({ message: "This request does not have a pending cancellation request." });
    }

    const farmer = request.farmerId;
    const animal = request.animalId;
    const animalTag = animal?.earTag || animal?.animalId || "the animal";
    const previousStatus = request.status;

    if (approved) {
      request.status = "cancelled";
      request.cancellationStatus = "approved";
      request.cancellationResponseReason = reason?.trim() || "";
      request.cancellationRespondedAt = new Date();
      request.statusHistory = request.statusHistory || [];
      request.statusHistory.push({
        status: "cancelled",
        note: reason?.trim() || `Cancellation approved by ${role}`,
        actorId: actor._id,
      });
      await request.save();

      await createAuditLog({
        entityType: "HealthRequest",
        entityId: request._id,
        action: "CANCEL_APPROVED",
        actorId: actor._id,
        before: { status: previousStatus, cancellationStatus: "requested" },
        after: { status: "cancelled", cancellationStatus: "approved" },
        metadata: { role, reason: reason?.trim() || "" },
      });

      if (farmer?._id) {
        await notifyUser({
          recipient: farmer,
          senderId: actor._id,
          type: "health-request",
          relatedId: request._id,
          category: "cancellations",
          eventType: "cancellation_approved",
          linkType: "request",
          metadata: {
            requestId: request._id,
            animalId: animal?._id,
            animalTag,
            serviceType: "health",
          },
        });
      }

      req.app.get("io").emit("requestCancelled", {
        type: "HEALTH",
        requestId: request._id,
        technicianId: request.handledBy?._id,
        scheduledDate: request.scheduledDate,
        farmerId: farmer?._id,
      });

      return res.status(200).json({ message: "Cancellation approved." });
    } else {
      request.cancellationStatus = "rejected";
      request.cancellationResponseReason = reason?.trim() || "";
      request.cancellationRespondedAt = new Date();
      request.statusHistory = request.statusHistory || [];
      request.statusHistory.push({
        status: "cancellation_rejected",
        note: reason?.trim() || `Cancellation rejected by ${role}`,
        actorId: actor._id,
      });
      await request.save();

      await createAuditLog({
        entityType: "HealthRequest",
        entityId: request._id,
        action: "CANCEL_REJECTED",
        actorId: actor._id,
        before: { cancellationStatus: "requested" },
        after: { cancellationStatus: "rejected" },
        metadata: { role, reason: reason?.trim() || "" },
      });

      if (farmer?._id) {
        await notifyUser({
          recipient: farmer,
          senderId: actor._id,
          type: "health-request",
          relatedId: request._id,
          category: "cancellations",
          eventType: "cancellation_rejected",
          linkType: "request",
          metadata: {
            requestId: request._id,
            animalId: animal?._id,
            animalTag,
            serviceType: "health",
            reason: reason?.trim() || "",
          },
        });
      }

      return res.status(200).json({
        message: "Cancellation rejected. Farmer has been notified.",
        cancellationStatus: "rejected",
        cancellationResponseReason: request.cancellationResponseReason,
        cancellationRespondedAt: request.cancellationRespondedAt,
      });
    }
  } catch (error) {
    console.error("[respondHealthCancellation ERROR]", error.message);
    return res.status(500).json({ message: "Failed to respond to cancellation request." });
  }
};
