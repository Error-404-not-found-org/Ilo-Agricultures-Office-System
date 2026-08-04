import { Animal } from "../models/animal.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { MedicalRecord } from "../models/medical-record.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Calving } from "../models/calving.model.js";
import { Task } from "../models/task.model.js";
import {
  ACTIVE_AI_REQUEST_STATUSES,
  ANIMAL_REPRODUCTIVE_STATUS,
  TASK_STATUS,
} from "../domain/status-vocabulary.js";
import { assertAnimalAccess } from "../policies/animal.policy.js";
import { getReproductionEligibility } from "../domain/reproduction-lifecycle.js";
import {
  getAnimalTimeline as buildAnimalTimeline,
  createTimelineEvent,
} from "../services/animal-timeline.service.js";
import { createAuditLog } from "../services/audit.service.js";
import { AppError } from "../utils/app-error.js";
import { isPregnancyCycleActive } from "../domain/pregnancy-lifecycle.js";
import { sendDetail, sendList, sendMutation } from "../utils/api-response.js";
import { getPagination, paginateArray } from "../utils/pagination.js";
import { excludeRequestsWithOfficialMedicalRecords } from "../utils/health-records.js";

const getAccessibleAnimal = async (id, user) => {
  const animal = await Animal.findOne({ _id: id, deletedAt: null });
  assertAnimalAccess(user, animal);
  return animal;
};

const parseRecordDate = (value, fieldName) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`Invalid ${fieldName}.`, {
      status: 400,
      code: "RECORD_DATE_FILTER_INVALID",
    });
  }
  return date;
};

const recordMatchesSearch = (record, search) => {
  if (!search) return true;
  const values = [
    record.title,
    record.summary,
    record.status,
    record.animalId?.animalId,
    record.animalId?.earTag,
    record.animalId?.breed,
    record.animalId?.species,
    record.farmerId?.name,
    record.farmerId?.phoneNumber,
    record.technicianId?.name,
    record.source?.sireBreed,
    record.source?.sireCode,
    record.source?.technicianNote,
    record.source?.note,
    record.source?.details?.diagnosis,
    record.source?.details?.treatment,
  ];
  return values
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(search));
};

export const getOfficialRecords = async (req, res) => {
  try {
    const allowedRoles = ["farmer", "technician", "veterinarian", "admin"];
    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError("You cannot access official animal records.", {
        status: 403,
        code: "OFFICIAL_RECORDS_ACCESS_DENIED",
      });
    }

    const pageInfo = getPagination(req.query, {
      defaultLimit: 25,
      maxLimit: 100,
    });
    const requestedFarmerId = req.query.farmerId;
    const animalId = req.query.animalId;
    const requestedType = String(req.query.type || "All")
      .trim()
      .toLowerCase();
    const search = String(req.query.search || "")
      .trim()
      .toLowerCase();
    const fromDate = parseRecordDate(req.query.fromDate, "from date");
    const toDate = parseRecordDate(req.query.toDate, "to date");
    if (fromDate && toDate && fromDate > toDate) {
      throw new AppError("From date cannot be later than to date.", {
        status: 400,
        code: "RECORD_DATE_RANGE_INVALID",
      });
    }

    const farmerId =
      req.user.role === "farmer" ? req.user._id : requestedFarmerId;
    const scope = {
      ...(farmerId ? { farmerId } : {}),
      ...(animalId ? { animalId } : {}),
    };
    const dateRange = {
      ...(fromDate ? { $gte: fromDate } : {}),
      ...(toDate ? { $lte: toDate } : {}),
    };
    const hasDateRange = Object.keys(dateRange).length > 0;

    const includeAI = ["all", "ai", "insemination", "breeding"].includes(
      requestedType,
    );
    const includePregnancy = ["all", "pregnancy", "pd"].includes(requestedType);
    const includeCalving = ["all", "calving"].includes(requestedType);
    const includeHealth = ["all", "health", "medical"].includes(requestedType);
    const includeNotes = ["all", "note", "notes", "general note"].includes(
      requestedType,
    );

    const [inseminations, pregnancies, calvings, medicalRecords] =
      await Promise.all([
        includeAI
          ? Insemination.find({
              ...scope,
              status: "done",
              deletedAt: null,
              ...(hasDateRange ? { inseminationDate: dateRange } : {}),
            })
              .populate(
                "animalId",
                "animalId earTag brand color breed species imageUrl reproductiveStatus",
              )
              .populate("farmerId", "name phoneNumber address")
              .populate("technicianId approvedBy", "name role")
              .lean()
          : [],
        includePregnancy
          ? Pregnancy.find({
              ...scope,
              deletedAt: null,
              ...(hasDateRange ? { "pregnancyDiagnosis.date": dateRange } : {}),
            })
              .populate(
                "animalId",
                "animalId earTag brand color breed species imageUrl reproductiveStatus",
              )
              .populate("farmerId", "name phoneNumber address")
              .populate("inseminationId", "attemptNumber sireBreed sireCode")
              .lean()
          : [],
        includeCalving
          ? Calving.find({
              ...scope,
              deletedAt: null,
              ...(hasDateRange ? { date: dateRange } : {}),
            })
              .populate(
                "animalId",
                "animalId earTag brand color breed species imageUrl reproductiveStatus",
              )
              .populate("farmerId", "name phoneNumber address")
              .populate("technicianId", "name role")
              .lean()
          : [],
        includeHealth || includeNotes
          ? MedicalRecord.find({
              ...scope,
              ...(hasDateRange ? { date: dateRange } : {}),
              ...(!includeHealth && includeNotes
                ? { type: "General Note" }
                : includeHealth && !includeNotes
                  ? { type: { $ne: "General Note" } }
                  : {}),
            })
              .populate(
                "animalId",
                "animalId earTag brand color breed species imageUrl reproductiveStatus",
              )
              .populate("farmerId", "name phoneNumber address")
              .populate("technicianId", "name role")
              .lean()
          : [],
      ]);

    const records = [
      ...inseminations.map((item) => ({
        id: item._id,
        recordKind: "insemination",
        category: "AI",
        recordDate: item.inseminationDate,
        enteredAt: item.createdAt,
        title: `AI Attempt #${item.attemptNumber || 1}`,
        summary: item.outcome || "Artificial insemination completed",
        status: "completed",
        farmerId: item.farmerId,
        animalId: item.animalId,
        technicianId: item.technicianId || item.approvedBy,
        source: item,
      })),
      ...pregnancies.map((item) => ({
        id: item._id,
        recordKind: "pregnancy",
        category: "Pregnancy",
        recordDate: item.pregnancyDiagnosis?.date || item.createdAt,
        enteredAt: item.createdAt,
        title: "Pregnancy Diagnosis",
        summary:
          item.pregnancyDiagnosis?.result || "Pregnancy diagnosis recorded",
        status: "completed",
        farmerId: item.farmerId,
        animalId: item.animalId,
        technicianId: item.technicianId,
        source: item,
      })),
      ...calvings.map((item) => ({
        id: item._id,
        recordKind: "calving",
        category: "Calving",
        recordDate: item.date || item.createdAt,
        enteredAt: item.createdAt,
        title: "Calving Record",
        summary: `${item.numberOfCalves || item.calves?.length || 0} offspring recorded`,
        status: "completed",
        farmerId: item.farmerId,
        animalId: item.animalId,
        technicianId: item.technicianId,
        source: item,
      })),
      ...medicalRecords.map((item) => {
        const isGeneralNote = item.type === "General Note";
        return {
          id: item._id,
          recordKind: "medical_record",
          category: isGeneralNote ? "General Note" : "Health",
          recordDate: item.date || item.createdAt,
          enteredAt: item.createdAt,
          title: item.type || "Health Record",
          summary:
            item.details?.diagnosis ||
            item.details?.treatment ||
            item.note ||
            (isGeneralNote ? "General animal note" : "Health record completed"),
          status: "completed",
          farmerId: item.farmerId,
          animalId: item.animalId,
          technicianId: item.technicianId,
          source: item,
        };
      }),
    ]
      .filter((record) => recordMatchesSearch(record, search))
      .sort(
        (a, b) =>
          new Date(b.recordDate || b.enteredAt || 0) -
          new Date(a.recordDate || a.enteredAt || 0),
      );

    return sendList(res, paginateArray(records, pageInfo));
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Failed to load official records.",
      code: error.code || "OFFICIAL_RECORDS_FETCH_FAILED",
    });
  }
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
    res
      .status(error.status || 500)
      .json({
        message: error.message,
        code: error.code || "TIMELINE_FETCH_FAILED",
      });
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
    if (fromDate && !Number.isNaN(fromDate.getTime()))
      dateFilter.$gte = fromDate;
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
      HealthRequest.find(healthQuery)
        .sort({ createdAt: -1 })
        .populate("handledBy assignedVeterinarianId", "name role")
        .lean(),
      MedicalRecord.find(medicalQuery)
        .sort({ date: -1 })
        .populate("technicianId", "name role")
        .lean(),
    ]);
    const visibleHealthRequests = excludeRequestsWithOfficialMedicalRecords(
      healthRequests,
      medicalRecords,
    );

    if (req.query.page || req.query.limit) {
      const combined = [
        ...visibleHealthRequests.map((item) => ({
          ...item,
          recordKind: "health_request",
          recordDate: item.createdAt,
        })),
        ...medicalRecords.map((item) => ({
          ...item,
          recordKind: "medical_record",
          recordDate: item.date || item.createdAt,
        })),
      ].sort((a, b) => new Date(b.recordDate) - new Date(a.recordDate));

      const paginated = paginateArray(combined, pageInfo);
      return sendList(res, paginated);
    }

    sendDetail(res, {
      healthRequests: visibleHealthRequests,
      medicalRecords,
    });
  } catch (error) {
    res
      .status(error.status || 500)
      .json({
        message: error.message,
        code: error.code || "HEALTH_HISTORY_FETCH_FAILED",
      });
  }
};

export const getAnimalRecords = async (req, res) => {
  try {
    await getAccessibleAnimal(req.params.id, req.user);
    const pageInfo = getPagination(req.query);
    const type = req.query.type;
    const search = String(req.query.search || "")
      .trim()
      .toLowerCase();
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
    const toDate = req.query.toDate ? new Date(req.query.toDate) : null;

    const dateFilter = {};
    if (fromDate && !Number.isNaN(fromDate.getTime()))
      dateFilter.$gte = fromDate;
    if (toDate && !Number.isNaN(toDate.getTime())) dateFilter.$lte = toDate;

    const animalQuery = { animalId: req.params.id, deletedAt: null };
    const medicalQuery = { animalId: req.params.id };
    const healthQuery = { animalId: req.params.id, deletedAt: null };
    if (Object.keys(dateFilter).length) {
      animalQuery.createdAt = dateFilter;
      healthQuery.createdAt = dateFilter;
      medicalQuery.date = dateFilter;
    }

    const [
      inseminations,
      pregnancies,
      calvings,
      healthRequests,
      medicalRecords,
    ] = await Promise.all([
      Insemination.find(animalQuery)
        .sort({ createdAt: -1 })
        .populate("technicianId approvedBy", "name role")
        .populate("previousAttemptId", "attemptNumber")
        .lean(),
      Pregnancy.find(animalQuery)
        .sort({ createdAt: -1 })
        .populate("inseminationId", "attemptNumber")
        .populate("confirmation.confirmedBy", "name role")
        .lean(),
      Calving.find({
        ...animalQuery,
        ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
      })
        .sort({ date: -1 })
        .populate("technicianId", "name role")
        .lean(),
      HealthRequest.find(healthQuery)
        .sort({ createdAt: -1 })
        .populate("handledBy assignedVeterinarianId", "name role")
        .lean(),
      MedicalRecord.find(medicalQuery)
        .sort({ date: -1 })
        .populate("technicianId", "name role")
        .lean(),
    ]);
    const visibleHealthRequests = excludeRequestsWithOfficialMedicalRecords(
      healthRequests,
      medicalRecords,
    );

    const nextAttemptByPreviousId = new Map(
      inseminations
        .filter((item) => item.previousAttemptId)
        .map((item) => [
          String(item.previousAttemptId?._id || item.previousAttemptId),
          item.attemptNumber,
        ]),
    );

    const records = [
      ...inseminations.map((item) => ({
        ...item,
        recordKind: "insemination",
        recordDate:
          item.inseminationDate || item.scheduledDate || item.createdAt,
        title: "A.I. Insemination",
        summary: item.outcome || item.status || "AI service record",
        previousAttemptReference: item.previousAttemptId?.attemptNumber || null,
        nextAttemptReference:
          nextAttemptByPreviousId.get(String(item._id)) || null,
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
      ...visibleHealthRequests.map((item) => ({
        ...item,
        recordKind: "health_request",
        recordDate: item.createdAt,
        title: "Health Request",
        summary:
          item.symptoms || item.requestType || "Health assistance request",
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
        if (normalized === "reproduction") {
          return recordKind === "insemination" || recordKind === "pregnancy";
        }
        if (normalized === "pregnancy") return recordKind === "pregnancy";
        if (normalized === "calving") return recordKind === "calving";
        if (normalized === "health")
          return (
            recordKind === "health_request" || recordKind === "medical_record"
          );
        return (
          recordKind.includes(normalized) ||
          requestType.includes(normalized) ||
          itemType.includes(normalized)
        );
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
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      })
      .sort(
        (a, b) =>
          new Date(b.recordDate || b.createdAt) -
          new Date(a.recordDate || a.createdAt),
      );

    sendList(res, paginateArray(filtered, pageInfo));
  } catch (error) {
    res
      .status(error.status || 500)
      .json({
        message: error.message,
        code: error.code || "ANIMAL_RECORDS_FETCH_FAILED",
      });
  }
};

export const getAnimalReproductionEligibility = async (req, res) => {
  try {
    const animal = await getAccessibleAnimal(req.params.id, req.user);

    const [activeRequest, candidatePregnancy, reproductiveTasks] =
      await Promise.all([
        Insemination.findOne({
          animalId: animal._id,
          deletedAt: null,
          status: {
            $in: ACTIVE_AI_REQUEST_STATUSES,
          },
        })
          .sort({
            createdAt: -1,
          })
          .lean(),

        Pregnancy.findOne({
          animalId: animal._id,
          deletedAt: null,
          "pregnancyDiagnosis.result": "Pregnant",
          cycleStatus: { $nin: ["completed", "lost"] },
        })
          .sort({
            createdAt: -1,
          })
          .lean(),

        Task.find({
          animalIds: animal._id,
          taskType: {
            $in: ["AI", "PD", "Calving", "CD"],
          },
          status: {
            $in: [TASK_STATUS.PENDING, TASK_STATUS.IN_PROGRESS],
          },
        })
          .sort({
            dueDate: 1,
            createdAt: 1,
          })
          .lean(),
      ]);

    const historicalCalving = candidatePregnancy
      ? await Calving.exists({
          pregnancyId: candidatePregnancy._id,
          deletedAt: null,
        })
      : null;
    const activePregnancy = isPregnancyCycleActive(
      candidatePregnancy,
      Boolean(historicalCalving),
    )
      ? candidatePregnancy
      : null;
    const effectiveAnimal = historicalCalving
      ? {
          ...animal.toObject(),
          reproductiveStatus: "Post-partum",
          expectedCalvingDate: undefined,
        }
      : animal;
    const eligibility = getReproductionEligibility({
      animal: effectiveAnimal,
      activeRequest,
      activePregnancy: ["Pregnant", "Dry"].includes(animal.reproductiveStatus)
        ? activePregnancy
        : null,
      tasks: reproductiveTasks,
    });

    return sendDetail(res, eligibility);
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Failed to evaluate reproductive eligibility.",
      code: error.code || "REPRODUCTION_ELIGIBILITY_FAILED",
    });
  }
};

export const createFarmerAnimalUpdate = async (req, res) => {
  try {
    const animal = await getAccessibleAnimal(req.params.id, req.user);
    if (
      req.user.role !== "farmer" &&
      !["technician", "veterinarian", "admin"].includes(req.user.role)
    ) {
      throw new AppError("You cannot submit updates for this animal", {
        status: 403,
        code: "UPDATE_ACCESS_DENIED",
      });
    }

    const { status, note = "", attachments = [] } = req.body;
    if (!status || typeof status !== "string") {
      throw new AppError("A status update is required", {
        status: 400,
        code: "STATUS_REQUIRED",
      });
    }

    animal.activityLogs = animal.activityLogs || [];
    animal.activityLogs.push({
      event: "Farmer Status Update",
      date: new Date(),
      description: `${status}: ${note}`.trim(),
    });
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
    await createAuditLog({
      entityType: "Animal",
      entityId: animal._id,
      action: "status_update",
      actorId: req.user._id,
      after: { status, note },
    });
    sendMutation(res, "Animal update saved", { animal, timelineEvent }, 201);
  } catch (error) {
    res
      .status(error.status || 500)
      .json({
        message: error.message,
        code: error.code || "ANIMAL_UPDATE_FAILED",
      });
  }
};

export const getAnimalAttachments = async (req, res) => {
  try {
    await getAccessibleAnimal(req.params.id, req.user);
    const [healthRequests, medicalRecords] = await Promise.all([
      HealthRequest.find({ animalId: req.params.id, deletedAt: null })
        .select("imageUrl photos createdAt")
        .lean(),
      MedicalRecord.find({ animalId: req.params.id })
        .select("imageUrl date")
        .lean(),
    ]);
    const attachments = [
      ...healthRequests
        .flatMap((request) =>
          request.photos?.length
            ? request.photos
            : request.imageUrl
              ? [request.imageUrl]
              : [],
        )
        .map((url) => ({ url, source: "health_request" })),
      ...medicalRecords
        .filter((record) => record.imageUrl)
        .map((record) => ({ url: record.imageUrl, source: "medical_record" })),
    ];
    sendDetail(res, attachments);
  } catch (error) {
    res
      .status(error.status || 500)
      .json({
        message: error.message,
        code: error.code || "ATTACHMENTS_FETCH_FAILED",
      });
  }
};
