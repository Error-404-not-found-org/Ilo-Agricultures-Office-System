import { Animal } from "../models/animal.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { MedicalRecord } from "../models/medical-record.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Calving } from "../models/calving.model.js";
import { Task } from "../models/task.model.js";
import {
  ACTIVE_AI_REQUEST_STATUSES,
  AI_STATUS,
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
import { buildFarmerHealthRequest } from "../domain/health-request-presentation.js";

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

const executeOfficialRecordQuery = async (query, sort, windowLimit) => {
  let boundedQuery = query.sort(sort);
  if (windowLimit && typeof boundedQuery.limit === "function") {
    boundedQuery = boundedQuery.limit(windowLimit);
  }
  return boundedQuery.lean();
};

const OFFICIAL_RECORD_KINDS = new Set([
  "insemination",
  "pregnancy",
  "calving",
  "medical_record",
]);

const idOf = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value?.toHexString === "function") {
    return value.toHexString();
  }
  if (
    typeof value === "object" &&
    value._id !== undefined &&
    value._id !== value
  ) {
    return idOf(value._id);
  }
  return String(value);
};

const personSummary = (value) => {
  if (!value) return null;
  if (typeof value !== "object") return { id: idOf(value), name: "" };
  return {
    id: idOf(value),
    name: value.name || "",
  };
};

const uniqueRecordAttachments = (items = []) => {
  const seen = new Set();
  return items.reduce((attachments, item) => {
    const url = String(item?.url || "").trim();
    if (!url || seen.has(url)) return attachments;
    seen.add(url);
    attachments.push({ ...item, url });
    return attachments;
  }, []);
};

const animalSummary = (recordAnimal, fallbackAnimal) => {
  const hasPopulatedAnimal =
    recordAnimal &&
    typeof recordAnimal === "object" &&
    (recordAnimal.earTag || recordAnimal.animalId || recordAnimal.species);
  const animal =
    hasPopulatedAnimal ? recordAnimal : fallbackAnimal;
  return {
    _id: idOf(animal),
    animalId: animal?.animalId || "",
    earTag: animal?.earTag || "",
    breed: animal?.breed || "",
    species: animal?.species || "",
    imageUrl: animal?.imageUrl || "",
    reproductiveStatus: animal?.reproductiveStatus || "",
  };
};

const officialRecordDetail = ({ recordKind, record, animal }) => {
  const sourceId = idOf(record);
  const subject = animalSummary(record.animalId, animal);
  const common = {
    id: sourceId,
    sourceId,
    sourceKind: recordKind,
    animalId: subject,
    farmerId: personSummary(record.farmerId),
  };

  if (recordKind === "insemination") {
    const technician = record.technicianId || record.approvedBy || null;
    const eventDate =
      record.inseminationDate || record.scheduledDate || record.createdAt;
    const dateLabel = record.inseminationDate
      ? "AI performed at"
      : record.scheduledDate
        ? "AI scheduled for"
        : "AI request submitted at";
    const attachments = uniqueRecordAttachments([
      ...(record.imageUrl
        ? [{
            url: record.imageUrl,
            category: "request_evidence",
            label: "AI request photo",
          }]
        : []),
      ...(record.evidencePhotos || []).map((url, index) => ({
        url,
        category: "follow_up_evidence",
        label: `Follow-up evidence ${index + 1}`,
      })),
    ]);
    return {
      ...common,
      type: "ai",
      title: `AI Attempt #${record.attemptNumber || 1}`,
      description: record.outcome || "Artificial insemination completed",
      date: eventDate,
      dateLabel,
      datePrecision: "datetime",
      attachments,
      technician: personSummary(technician),
      details: {
        serviceDate: eventDate,
        serviceDateLabel: dateLabel,
        entryDate: record.completedAt || null,
        entryDateLabel: "Record completed at",
        requestedAt: record.createdAt,
        requestedAtLabel: "Workflow created at",
        completedAt: record.completedAt || null,
        completedAtLabel: "Record completed at",
        status: record.status,
        scheduledDate: record.scheduledDate,
        visitPeriod: record.visitPeriod || null,
        serviceStartedAt: record.serviceStartedAt || null,
        earlyStartMinutes: record.earlyStartMinutes,
        sireBreed: record.sireBreed,
        sireCode: record.sireCode,
        semenDosesUsed: record.semenDosesUsed,
        attemptNumber: record.attemptNumber,
        previousAttemptNumber: record.previousAttemptId?.attemptNumber,
        previousAttemptDate: record.previousAttemptId?.inseminationDate,
        previousAttemptOutcome: record.previousAttemptId?.outcome,
        previousAttemptFailureReason: record.previousAttemptId?.failureReason,
        estrus: record.estrus,
        outcome: record.outcome,
        failureReason: record.failureReason,
        outcomeVerificationStatus: record.outcomeVerificationStatus,
        outcomeConfirmationSource: record.outcomeConfirmationSource,
        outcomeConfirmedBy: record.outcomeConfirmedBy?.name || "",
        outcomeConfirmedAt: record.outcomeConfirmedAt,
        farmerOutcomeReport: record.farmerOutcomeReport,
        farmerOutcomeReportedAt: record.farmerOutcomeReportedAt,
        farmerObservationSigns: record.farmerObservationSigns || [],
        farmerObservationNotes: record.farmerObservationNotes,
        pregnancyLinked: Boolean(record.pregnancyId),
        pregnancyResult: record.pregnancyId?.pregnancyDiagnosis?.result,
        pregnancyDiagnosisDate: record.pregnancyId?.pregnancyDiagnosis?.date,
        pregnancyConfirmationMethod:
          record.pregnancyId?.confirmation?.methodCode,
        technician: technician?.name || "",
        technicianNote: record.technicianNote,
      },
      actions: {
        reportPreviewAvailable: record.status === "done",
        reportId: sourceId,
        pregnancyTrackerAvailable: false,
      },
    };
  }

  if (recordKind === "pregnancy") {
    const technician =
      record.confirmation?.confirmedBy || record.technicianId || null;
    const pregnant = record.pregnancyDiagnosis?.result === "Pregnant";
    return {
      ...common,
      type: "pregnancy",
      title: "Pregnancy Diagnosis",
      description:
        record.pregnancyDiagnosis?.result || "Pregnancy diagnosis recorded",
      date: record.pregnancyDiagnosis?.date || record.createdAt,
      dateLabel: "Pregnancy diagnosis performed on",
      datePrecision: "date",
      attachments: [],
      technician: personSummary(technician),
      details: {
        serviceDate: record.pregnancyDiagnosis?.date,
        serviceDateLabel: "Pregnancy diagnosis performed on",
        entryDate: record.createdAt,
        entryDateLabel: "Recorded in BreedSmart at",
        outcome: record.pregnancyDiagnosis?.result,
        diagnosticMethod: record.confirmation?.methodCode,
        confirmationStage: record.confirmation?.stage,
        confirmedAt: record.confirmation?.confirmedAt,
        policyVersion: record.confirmation?.policyVersion,
        relatedAttempt: record.inseminationId?.attemptNumber,
        targetCalvingDate: record.targetCalvingDate,
        recheckRequired: Boolean(record.confirmation?.recheckRequired),
        recheckDueAt: record.confirmation?.recheckDueAt,
        recheckStatus: record.recheckStatus,
        technician: technician?.name || "",
        technicianNote: record.technicianNote,
      },
      actions: {
        reportPreviewAvailable: false,
        reportId: null,
        pregnancyTrackerAvailable: pregnant,
      },
    };
  }

  if (recordKind === "calving") {
    const technician = record.technicianId || null;
    const calves = (record.calves || []).map((calf) => {
      const linkedAnimal =
        calf.animalId && typeof calf.animalId === "object"
          ? calf.animalId
          : null;
      return {
        sex: calf.sex,
        earTag: calf.earTag || linkedAnimal?.earTag || "",
        animalId: idOf(linkedAnimal || calf.animalId),
        imageUrl: linkedAnimal?.imageUrl || "",
      };
    });
    const attachments = uniqueRecordAttachments(
      calves
        .filter((calf) => calf.imageUrl)
        .map((calf, index) => ({
          url: calf.imageUrl,
          category: "offspring_identity",
          label: calf.earTag
            ? `Calf ${calf.earTag}`
            : `Living calf ${index + 1}`,
          animalId: calf.animalId,
        })),
    );
    return {
      ...common,
      type: "calving",
      title: "Calving Record",
      description: record.outcome || "Calving outcome recorded",
      date: record.date || record.createdAt,
      dateLabel: "Calving occurred on",
      datePrecision: "date",
      attachments,
      technician: personSummary(technician),
      details: {
        serviceDate: record.date,
        serviceDateLabel: "Calving occurred on",
        entryDate: record.createdAt,
        entryDateLabel: "Recorded in BreedSmart at",
        calvingOutcome: record.outcome,
        calvingEase: record.calvingEase,
        numberOfCalves:
          record.numberOfCalves ??
          record.totalDelivered ??
          (record.calves?.length || 0) + (record.nonLivingCalves?.length || 0),
        livingCalfCount: record.livingCalfCount,
        stillbornCount: record.stillbornCount,
        calves,
        nonLivingCalves: record.nonLivingCalves || [],
        relatedPregnancyId: idOf(record.pregnancyId),
        relatedInseminationId: idOf(record.inseminationId),
        technician: technician?.name || "",
        technicianNote: record.technicianNote,
      },
      actions: {
        reportPreviewAvailable: false,
        reportId: null,
        pregnancyTrackerAvailable: false,
      },
    };
  }

  const linkedRequest =
    record.healthRequestId && typeof record.healthRequestId === "object"
      ? record.healthRequestId
      : null;
  const technician = record.technicianId || null;
  const attachments = uniqueRecordAttachments([
    ...(linkedRequest?.photos || []).map((url, index) => ({
      url,
      category: "farmer_evidence",
      label: `Health evidence ${index + 1}`,
    })),
    ...(linkedRequest?.imageUrl
      ? [{
          url: linkedRequest.imageUrl,
          category: "farmer_evidence",
          label: "Health evidence",
        }]
      : []),
    ...(record.imageUrl
      ? [{
          url: record.imageUrl,
          category: "medical_record_evidence",
          label: "Medical record evidence",
        }]
      : []),
  ]);
  return {
    ...common,
    type: "health",
    title: record.type || "Health Assistance",
    description:
      record.details?.diagnosis ||
      record.details?.treatment ||
      record.note ||
      "Health record completed",
    date: record.date || record.createdAt,
    dateLabel: "Health service record date",
    datePrecision: record.isHistoricalEntry ? "date" : "datetime",
    attachments,
    technician: personSummary(technician),
    details: {
      serviceDate: record.date,
      serviceDateLabel: "Health service record date",
      entryDate: record.createdAt,
      entryDateLabel: "Recorded in BreedSmart at",
      status: "completed",
      requestType: linkedRequest?.requestType || record.type,
      requestDetails: linkedRequest?.requestDetails,
      symptoms: linkedRequest?.symptoms,
      farmerNotes: linkedRequest?.farmerNotes,
      urgency: linkedRequest?.urgency,
      diagnosis: record.details?.diagnosis,
      treatment: record.details?.treatment,
      medicine: record.details?.medicineName,
      dosage: record.details?.dosage,
      advice:
        linkedRequest?.advice || linkedRequest?.resolutionNotes || record.note,
      followUpDate: record.followUpDate || linkedRequest?.followUpDate,
      withdrawalPeriodDays: record.details?.withdrawalPeriodDays,
      withdrawalEndDate: record.details?.withdrawalEndDate,
      isHistoricalEntry: Boolean(record.isHistoricalEntry),
      performedByName: record.performedByName,
      lateEntryReason: record.lateEntryReason,
      technician: technician?.name || "",
      technicianNote: record.note,
    },
    actions: {
      reportPreviewAvailable: record.type !== "General Note",
      reportId: record.type !== "General Note" ? sourceId : null,
      pregnancyTrackerAvailable: false,
    },
  };
};

export const getOfficialRecordDetail = async (req, res) => {
  try {
    const { id: animalId, recordKind, recordId } = req.params;
    if (!OFFICIAL_RECORD_KINDS.has(recordKind)) {
      throw new AppError("Unsupported official record type.", {
        status: 400,
        code: "OFFICIAL_RECORD_KIND_INVALID",
      });
    }

    const animal = await getAccessibleAnimal(animalId, req.user);
    const scope = { _id: recordId, animalId: animal._id };
    let query;

    if (recordKind === "insemination") {
      query = Insemination.findOne({ ...scope, deletedAt: null })
        .populate("technicianId approvedBy outcomeConfirmedBy", "name role")
        .populate(
          "previousAttemptId",
          "attemptNumber inseminationDate outcome failureReason outcomeVerificationStatus",
        )
        .populate(
          "pregnancyId",
          "pregnancyDiagnosis confirmation targetCalvingDate",
        );
    } else if (recordKind === "pregnancy") {
      query = Pregnancy.findOne({ ...scope, deletedAt: null })
        .populate("confirmation.confirmedBy", "name role")
        .populate("inseminationId", "attemptNumber sireBreed sireCode");
    } else if (recordKind === "calving") {
      query = Calving.findOne({ ...scope, deletedAt: null })
        .populate("technicianId", "name role")
        .populate("calves.animalId", "animalId earTag imageUrl");
    } else {
      query = MedicalRecord.findOne(scope)
        .populate("technicianId", "name role")
        .populate("farmerId", "name")
        .populate(
          "healthRequestId",
          "requestType requestDetails symptoms urgency farmerNotes advice followUpDate resolutionNotes imageUrl photos",
        );
    }

    const record = await query.lean();
    if (!record) {
      throw new AppError("Official record not found.", {
        status: 404,
        code: "OFFICIAL_RECORD_NOT_FOUND",
      });
    }

    return sendDetail(
      res,
      officialRecordDetail({ recordKind, record, animal }),
    );
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Failed to load the official record.",
      code: error.code || "OFFICIAL_RECORD_DETAIL_FETCH_FAILED",
    });
  }
};

export const getOfficialRecords = async (req, res) => {
  try {
    const allowedRoles = ["farmer", "technician", "admin"];
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
    const windowLimit = search ? null : pageInfo.skip + pageInfo.limit;
    const inseminationFilter = {
      ...scope,
      status: "done",
      deletedAt: null,
      ...(hasDateRange ? { inseminationDate: dateRange } : {}),
    };
    const pregnancyFilter = {
      ...scope,
      deletedAt: null,
      ...(hasDateRange ? { "pregnancyDiagnosis.date": dateRange } : {}),
    };
    const calvingFilter = {
      ...scope,
      deletedAt: null,
      ...(hasDateRange ? { date: dateRange } : {}),
    };
    const medicalRecordFilter = {
      ...scope,
      ...(hasDateRange ? { date: dateRange } : {}),
      ...(!includeHealth && includeNotes
        ? { type: "General Note" }
        : includeHealth && !includeNotes
          ? { type: { $ne: "General Note" } }
          : {}),
    };

    const [
      inseminations,
      pregnancies,
      calvings,
      medicalRecords,
      inseminationCount,
      pregnancyCount,
      calvingCount,
      medicalRecordCount,
    ] =
      await Promise.all([
        includeAI
          ? executeOfficialRecordQuery(
              Insemination.find(inseminationFilter)
              .populate(
                "animalId",
                "animalId earTag brand color breed species imageUrl reproductiveStatus",
              )
              .populate("farmerId", "name phoneNumber address")
              .populate("technicianId approvedBy", "name role"),
              { inseminationDate: -1, createdAt: -1 },
              windowLimit,
            )
          : [],
        includePregnancy
          ? executeOfficialRecordQuery(
              Pregnancy.find(pregnancyFilter)
              .populate(
                "animalId",
                "animalId earTag brand color breed species imageUrl reproductiveStatus",
              )
              .populate("farmerId", "name phoneNumber address")
              .populate("inseminationId", "attemptNumber sireBreed sireCode")
              .populate("confirmation.confirmedBy", "name role"),
              { "pregnancyDiagnosis.date": -1, createdAt: -1 },
              windowLimit,
            )
          : [],
        includeCalving
          ? executeOfficialRecordQuery(
              Calving.find(calvingFilter)
              .populate(
                "animalId",
                "animalId earTag brand color breed species imageUrl reproductiveStatus",
              )
              .populate("farmerId", "name phoneNumber address")
              .populate("technicianId", "name role"),
              { date: -1, createdAt: -1 },
              windowLimit,
            )
          : [],
        includeHealth || includeNotes
          ? executeOfficialRecordQuery(
              MedicalRecord.find(medicalRecordFilter)
              .populate(
                "animalId",
                "animalId earTag brand color breed species imageUrl reproductiveStatus",
              )
              .populate("farmerId", "name phoneNumber address")
              .populate("technicianId", "name role")
              .populate(
                "healthRequestId",
                "requestType requestDetails symptoms urgency farmerNotes advice followUpDate resolutionNotes",
              ),
              { date: -1, createdAt: -1 },
              windowLimit,
            )
          : [],
        !search && includeAI
          ? Insemination.countDocuments(inseminationFilter)
          : 0,
        !search && includePregnancy
          ? Pregnancy.countDocuments(pregnancyFilter)
          : 0,
        !search && includeCalving ? Calving.countDocuments(calvingFilter) : 0,
        !search && (includeHealth || includeNotes)
          ? MedicalRecord.countDocuments(medicalRecordFilter)
          : 0,
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
        technicianId: item.confirmation?.confirmedBy || item.technicianId,
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

    if (search) {
      return sendList(res, paginateArray(records, pageInfo));
    }

    return sendList(res, {
      data: records.slice(pageInfo.skip, pageInfo.skip + pageInfo.limit),
      page: pageInfo.page,
      limit: pageInfo.limit,
      total:
        inseminationCount + pregnancyCount + calvingCount + medicalRecordCount,
    });
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
        .populate("handledBy assignedTechnicianId", "name role")
        .lean(),
      MedicalRecord.find(medicalQuery)
        .sort({ date: -1 })
        .populate("technicianId", "name role")
        .populate(
          "healthRequestId",
          "requestType symptoms urgency farmerNotes advice followUpDate resolutionNotes",
        )
        .lean(),
    ]);
    const visibleHealthRequests = excludeRequestsWithOfficialMedicalRecords(
      healthRequests,
      medicalRecords,
    ).map((request) =>
      req.user.role === "farmer"
        ? buildFarmerHealthRequest(request)
        : request,
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
    if (Object.keys(dateFilter).length) {
      animalQuery.createdAt = dateFilter;
      medicalQuery.date = dateFilter;
    }
    const completedInseminationQuery = {
      ...animalQuery,
      status: AI_STATUS.DONE,
    };

    const [
      inseminations,
      pregnancies,
      calvings,
      medicalRecords,
    ] = await Promise.all([
      Insemination.find(completedInseminationQuery)
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
      MedicalRecord.find(medicalQuery)
        .sort({ date: -1 })
        .populate("technicianId", "name role")
        .populate(
          "healthRequestId",
          "requestType requestDetails symptoms urgency farmerNotes advice followUpDate resolutionNotes",
        )
        .lean(),
    ]);

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
        const itemType = String(item.type || "").toLowerCase();
        if (normalized === "breeding") return recordKind === "insemination";
        if (normalized === "reproduction") {
          return recordKind === "insemination" || recordKind === "pregnancy";
        }
        if (normalized === "pregnancy") return recordKind === "pregnancy";
        if (normalized === "calving") return recordKind === "calving";
        if (normalized === "health") return recordKind === "medical_record";
        return (
          recordKind.includes(normalized) ||
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
      !["technician", "admin"].includes(req.user.role)
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
