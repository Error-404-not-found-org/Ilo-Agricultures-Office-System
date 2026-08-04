import { HealthRequest } from "../models/health-request.model.js";
import { Animal } from "../models/animal.model.js";
import { assertAnimalAccess, assertClinicalRole } from "../policies/animal.policy.js";
import { assertHealthRequestAccess } from "../policies/request.policy.js";
import { createAuditLog } from "../services/audit.service.js";
import { createTimelineEvent } from "../services/animal-timeline.service.js";
import { AppError } from "../utils/app-error.js";
import { sendDetail, sendMutation } from "../utils/api-response.js";
import { activeHealthCaseKey } from "../services/health-request-creation.service.js";

const ACTIVE_STATUSES = new Set(["pending", "triaged", "assigned", "approved", "scheduled", "in-progress", "in_progress"]);

const getRequest = async (id) => {
  const request = await HealthRequest.findOne({ _id: id, deletedAt: null })
    .populate("farmerId", "name address phoneNumber imageUrl farmLocation")
    .populate("animalId", "animalId earTag species breed imageUrl reproductiveStatus birthDate")
    .populate("handledBy assignedTechnicianId assignedVeterinarianId", "name role phoneNumber")
    .lean();
  if (!request) throw new AppError("Health request not found", { status: 404, code: "HEALTH_REQUEST_NOT_FOUND" });
  return request;
};

export const getHealthRequestDetail = async (req, res) => {
  try {
    const request = await getRequest(req.params.id);
    assertHealthRequestAccess(req.user, request);

    const isUnclaimed = !request.handledBy;
    const isFarmerRole = req.user.role === "farmer";
    const isOwnFarmer = isFarmerRole && request.farmerId?._id?.toString() === req.user._id.toString();

    if (isUnclaimed && !isOwnFarmer && req.user.role !== "admin") {
      if (request.farmerId) {
        request.farmerId.phoneNumber = "";
        if (request.farmerId.address) {
          request.farmerId.address.landmark = "";
          request.farmerId.address.street = "";
          request.farmerId.address.houseNumber = "";
          request.farmerId.address.coordinates = null;
        }
        if (request.farmerId.farmLocation) {
          request.farmerId.farmLocation.landmark = "";
          request.farmerId.farmLocation.directionsNote = "";
          request.farmerId.farmLocation.latitude = null;
          request.farmerId.farmLocation.longitude = null;
        }
      }
    }

    sendDetail(res, request);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message, code: error.code || "HEALTH_REQUEST_FETCH_FAILED" });
  }
};

export const triageHealthRequest = async (req, res) => {
  try {
    assertClinicalRole(req.user);
    const existing = await HealthRequest.findOne({ _id: req.params.id, deletedAt: null });
    if (!existing) throw new AppError("Health request not found", { status: 404, code: "HEALTH_REQUEST_NOT_FOUND" });
    if (!ACTIVE_STATUSES.has(existing.status)) {
      throw new AppError("Only active health requests can be triaged", { status: 409, code: "HEALTH_REQUEST_NOT_ACTIVE" });
    }

    const { urgency, findings = "", technicianNote = "", scheduledDate, assignedTechnicianId, assignedVeterinarianId } = req.body;
    if (urgency && !["low", "medium", "high", "emergency"].includes(urgency)) {
      throw new AppError("Invalid urgency value", { status: 400, code: "INVALID_URGENCY" });
    }
    const nextStatus = scheduledDate ? "scheduled" : assignedTechnicianId || assignedVeterinarianId ? "assigned" : "triaged";
    const before = { status: existing.status, urgency: existing.urgency };
    const update = {
      status: nextStatus,
      activeCaseKey: activeHealthCaseKey(existing.animalId, existing.requestType),
      handledBy: req.user._id,
      urgency: urgency || existing.urgency,
      findings,
      technicianNote,
      ...(scheduledDate ? { scheduledDate: new Date(scheduledDate) } : {}),
      ...(assignedTechnicianId ? { assignedTechnicianId } : {}),
      ...(assignedVeterinarianId ? { assignedVeterinarianId } : {}),
      $push: { statusHistory: { status: nextStatus, note: technicianNote || findings, actorId: req.user._id } },
    };
    const request = await HealthRequest.findByIdAndUpdate(existing._id, update, { new: true });
    await Promise.all([
      createTimelineEvent({ animalId: request.animalId, eventType: "health_triaged", actorId: req.user._id, sourceType: "HealthRequest", sourceId: request._id, title: "Health case triaged", summary: findings || technicianNote, metadata: { urgency: request.urgency, status: request.status } }),
      createAuditLog({ entityType: "HealthRequest", entityId: request._id, action: "triaged", actorId: req.user._id, before, after: { status: request.status, urgency: request.urgency, findings } }),
    ]);
    sendMutation(res, "Health request triaged", request);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message, code: error.code || "HEALTH_TRIAGE_FAILED" });
  }
};

export const scheduleHealthFollowUp = async (req, res) => {
  try {
    assertClinicalRole(req.user);
    const request = await HealthRequest.findOne({ _id: req.params.id, deletedAt: null });
    if (!request) throw new AppError("Health request not found", { status: 404, code: "HEALTH_REQUEST_NOT_FOUND" });
    const { followUpDate, note = "" } = req.body;
    if (!followUpDate || Number.isNaN(new Date(followUpDate).getTime())) {
      throw new AppError("A valid follow-up date is required", { status: 400, code: "FOLLOW_UP_DATE_REQUIRED" });
    }
    request.followUpDate = new Date(followUpDate);
    request.statusHistory.push({ status: request.status, note: `Follow-up scheduled: ${note}`.trim(), actorId: req.user._id });
    await request.save();
    await Promise.all([
      createTimelineEvent({ animalId: request.animalId, eventType: "follow_up_due", actorId: req.user._id, sourceType: "HealthRequest", sourceId: request._id, title: "Health follow-up scheduled", summary: note, metadata: { followUpDate: request.followUpDate } }),
      createAuditLog({ entityType: "HealthRequest", entityId: request._id, action: "follow_up_scheduled", actorId: req.user._id, after: { followUpDate: request.followUpDate, note } }),
    ]);
    sendMutation(res, "Health follow-up scheduled", request);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message, code: error.code || "HEALTH_FOLLOW_UP_FAILED" });
  }
};
