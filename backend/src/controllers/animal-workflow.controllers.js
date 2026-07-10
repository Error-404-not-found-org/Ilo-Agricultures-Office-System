import { Animal } from "../models/animal.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { MedicalRecord } from "../models/medical-record.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Calving } from "../models/calving.model.js";
import { assertAnimalAccess } from "../policies/animal.policy.js";
import { getReproductionEligibility } from "../domain/reproduction-lifecycle.js";
import { getAnimalTimeline as buildAnimalTimeline, createTimelineEvent } from "../services/animal-timeline.service.js";
import { createAuditLog } from "../services/audit.service.js";
import { AppError } from "../utils/app-error.js";
import { sendDetail, sendList, sendMutation } from "../utils/api-response.js";
import { getPagination, paginateArray } from "../utils/pagination.js";

const getAccessibleAnimal = async (id, user) => {
  const animal = await Animal.findOne({ _id: id, deletedAt: null });
  assertAnimalAccess(user, animal);
  return animal;
};

export const getAnimalTimeline = async (req, res) => {
  try {
    await getAccessibleAnimal(req.params.id, req.user);
    const timeline = await buildAnimalTimeline(req.params.id, {
      type: req.query.type,
      search: req.query.search,
    });

    if (req.query.page || req.query.limit) {
      const pageInfo = getPagination(req.query);
      const paginated = paginateArray(timeline, pageInfo);
      return sendList(res, paginated);
    }

    sendDetail(res, timeline);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message, code: error.code || "TIMELINE_FETCH_FAILED" });
  }
};

export const getAnimalHealthHistory = async (req, res) => {
  try {
    await getAccessibleAnimal(req.params.id, req.user);
    const pageInfo = getPagination(req.query);
    const type = req.query.type;
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
    const toDate = req.query.toDate ? new Date(req.query.toDate) : null;

    const dateFilter = {};
    if (fromDate && !Number.isNaN(fromDate.getTime())) dateFilter.$gte = fromDate;
    if (toDate && !Number.isNaN(toDate.getTime())) dateFilter.$lte = toDate;

    const healthQuery = { animalId: req.params.id, deletedAt: null };
    const medicalQuery = { animalId: req.params.id };
    if (type && type !== "All") {
      healthQuery.requestType = type;
      medicalQuery.type = type;
    }
    if (Object.keys(dateFilter).length) {
      healthQuery.createdAt = dateFilter;
      medicalQuery.date = dateFilter;
    }

    const [healthRequests, medicalRecords] = await Promise.all([
      HealthRequest.find(healthQuery).sort({ createdAt: -1 }).populate("handledBy assignedVeterinarianId", "name role").lean(),
      MedicalRecord.find(medicalQuery).sort({ date: -1 }).populate("technicianId", "name role").lean(),
    ]);

    if (req.query.page || req.query.limit) {
      const combined = [
        ...healthRequests.map((item) => ({ ...item, recordKind: "health_request", recordDate: item.createdAt })),
        ...medicalRecords.map((item) => ({ ...item, recordKind: "medical_record", recordDate: item.date || item.createdAt })),
      ].sort((a, b) => new Date(b.recordDate) - new Date(a.recordDate));

      const paginated = paginateArray(combined, pageInfo);
      return sendList(res, paginated);
    }

    sendDetail(res, { healthRequests, medicalRecords });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message, code: error.code || "HEALTH_HISTORY_FETCH_FAILED" });
  }
};

export const getAnimalRecords = async (req, res) => {
  try {
    await getAccessibleAnimal(req.params.id, req.user);
    const pageInfo = getPagination(req.query);
    const type = req.query.type;
    const search = String(req.query.search || "").trim().toLowerCase();
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
    const toDate = req.query.toDate ? new Date(req.query.toDate) : null;

    const dateFilter = {};
    if (fromDate && !Number.isNaN(fromDate.getTime())) dateFilter.$gte = fromDate;
    if (toDate && !Number.isNaN(toDate.getTime())) dateFilter.$lte = toDate;

    const animalQuery = { animalId: req.params.id, deletedAt: null };
    const medicalQuery = { animalId: req.params.id };
    const healthQuery = { animalId: req.params.id, deletedAt: null };
    if (Object.keys(dateFilter).length) {
      animalQuery.createdAt = dateFilter;
      healthQuery.createdAt = dateFilter;
      medicalQuery.date = dateFilter;
    }

    const [inseminations, pregnancies, calvings, healthRequests, medicalRecords] = await Promise.all([
      Insemination.find(animalQuery).sort({ createdAt: -1 }).populate("technicianId approvedBy", "name role").lean(),
      Pregnancy.find(animalQuery).sort({ createdAt: -1 }).populate("inseminationId").lean(),
      Calving.find({ ...animalQuery, ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}) }).sort({ date: -1 }).populate("technicianId", "name role").lean(),
      HealthRequest.find(healthQuery).sort({ createdAt: -1 }).populate("handledBy assignedVeterinarianId", "name role").lean(),
      MedicalRecord.find(medicalQuery).sort({ date: -1 }).populate("technicianId", "name role").lean(),
    ]);

    const records = [
      ...inseminations.map((item) => ({
        ...item,
        recordKind: "insemination",
        recordDate: item.inseminationDate || item.scheduledDate || item.createdAt,
        title: "A.I. Insemination",
        summary: item.outcome || item.status || "AI service record",
      })),
      ...pregnancies.map((item) => ({
        ...item,
        recordKind: "pregnancy",
        recordDate: item.pregnancyDiagnosis?.date || item.createdAt,
        title: "Pregnancy Check",
        summary: item.pregnancyDiagnosis?.result || "Pregnancy check record",
      })),
      ...calvings.map((item) => ({
        ...item,
        recordKind: "calving",
        recordDate: item.date || item.createdAt,
        title: "Calving / Offspring",
        summary: `${item.numberOfCalves || item.calves?.length || 0} offspring recorded`,
      })),
      ...healthRequests.map((item) => ({
        ...item,
        recordKind: "health_request",
        recordDate: item.createdAt,
        title: "Health Request",
        summary: item.symptoms || item.requestType || "Health assistance request",
      })),
      ...medicalRecords.map((item) => ({
        ...item,
        recordKind: "medical_record",
        recordDate: item.date || item.createdAt,
        title: item.type || "Medical Record",
        summary: item.details?.diagnosis || item.note || "Medical record",
      })),
    ];

    const filtered = records
      .filter((item) => {
        if (!type || type === "All") return true;
        const normalized = String(type).toLowerCase();
        const recordKind = String(item.recordKind || "").toLowerCase();
        const requestType = String(item.requestType || "").toLowerCase();
        const itemType = String(item.type || "").toLowerCase();
        if (normalized === "breeding") return recordKind === "insemination";
        if (normalized === "pregnancy") return recordKind === "pregnancy";
        if (normalized === "calving") return recordKind === "calving";
        if (normalized === "health") return recordKind === "health_request" || recordKind === "medical_record";
        return recordKind.includes(normalized) || requestType.includes(normalized) || itemType.includes(normalized);
      })
      .filter((item) => {
        if (!search) return true;
        return [
          item.title,
          item.summary,
          item.status,
          item.outcome,
          item.requestType,
          item.symptoms,
          item.sireBreed,
          item.sireCode,
          item.technicianNote,
          item.note,
        ].filter(Boolean).some((value) => String(value).toLowerCase().includes(search));
      })
      .sort((a, b) => new Date(b.recordDate || b.createdAt) - new Date(a.recordDate || a.createdAt));

    sendList(res, paginateArray(filtered, pageInfo));
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message, code: error.code || "ANIMAL_RECORDS_FETCH_FAILED" });
  }
};

export const getAnimalReproductionEligibility = async (req, res) => {
  try {
    const animal = await getAccessibleAnimal(req.params.id, req.user);
    const [activeRequest, activePregnancy] = await Promise.all([
      Insemination.findOne({ animalId: animal._id, deletedAt: null, status: { $in: ["pending", "approved", "in-progress"] } }).lean(),
      Pregnancy.findOne({ animalId: animal._id, deletedAt: null, "pregnancyDiagnosis.result": "Pregnant" }).lean(),
    ]);
    sendDetail(res, getReproductionEligibility({ animal, activeRequest, activePregnancy }));
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message, code: error.code || "REPRODUCTION_ELIGIBILITY_FAILED" });
  }
};

export const createFarmerAnimalUpdate = async (req, res) => {
  try {
    const animal = await getAccessibleAnimal(req.params.id, req.user);
    if (req.user.role !== "farmer" && !["technician", "veterinarian", "admin"].includes(req.user.role)) {
      throw new AppError("You cannot submit updates for this animal", { status: 403, code: "UPDATE_ACCESS_DENIED" });
    }

    const { status, note = "", attachments = [] } = req.body;
    if (!status || typeof status !== "string") {
      throw new AppError("A status update is required", { status: 400, code: "STATUS_REQUIRED" });
    }

    animal.activityLogs = animal.activityLogs || [];
    animal.activityLogs.push({ event: "Farmer Status Update", date: new Date(), description: `${status}: ${note}`.trim() });
    await animal.save();

    const timelineEvent = await createTimelineEvent({
      animalId: animal._id,
      eventType: "farmer_status_update",
      actorId: req.user._id,
      sourceType: "Animal",
      sourceId: animal._id,
      title: "Animal status update",
      summary: `${status}${note ? `: ${note}` : ""}`,
      attachments: Array.isArray(attachments) ? attachments : [],
      metadata: { status },
    });
    await createAuditLog({ entityType: "Animal", entityId: animal._id, action: "status_update", actorId: req.user._id, after: { status, note } });
    sendMutation(res, "Animal update saved", { animal, timelineEvent }, 201);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message, code: error.code || "ANIMAL_UPDATE_FAILED" });
  }
};

export const getAnimalAttachments = async (req, res) => {
  try {
    await getAccessibleAnimal(req.params.id, req.user);
    const [healthRequests, medicalRecords] = await Promise.all([
      HealthRequest.find({ animalId: req.params.id, deletedAt: null }).select("imageUrl photos createdAt").lean(),
      MedicalRecord.find({ animalId: req.params.id }).select("imageUrl date").lean(),
    ]);
    const attachments = [
      ...healthRequests.flatMap((request) => request.photos?.length ? request.photos : request.imageUrl ? [request.imageUrl] : []).map((url) => ({ url, source: "health_request" })),
      ...medicalRecords.filter((record) => record.imageUrl).map((record) => ({ url: record.imageUrl, source: "medical_record" })),
    ];
    sendDetail(res, attachments);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message, code: error.code || "ATTACHMENTS_FETCH_FAILED" });
  }
};
