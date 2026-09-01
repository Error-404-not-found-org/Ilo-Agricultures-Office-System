import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import cloudinary from "../config/cloudinary.js";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { MedicalRecord } from "../models/medical-record.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Calving } from "../models/calving.model.js";
import { Notification } from "../models/notification.model.js";

import { Config } from "../models/config.model.js";
import { FieldNote } from "../models/field-note.model.js";
import { Task } from "../models/task.model.js";
import { inngest } from "../config/inngest.js";
import {
  confirmPregnancyDiagnosis,
  recordPregnancyContinuationRecheck,
} from "../services/pregnancy-confirmation.service.js";
import {
  getCalvingReadiness,
  persistCalving,
} from "../services/calving.service.js";
import {
  correctCalvingRecord,
  correctPregnancyRecord,
} from "../services/breeding-correction.service.js";
import {
  activeRequestKeyForAnimal,
  createAIRequestWithGuard,
  findActiveAIRequest,
  isVerifiedFailedAIAttempt,
  isVerifiedReturnToHeatAIAttempt,
} from "../services/ai-request-creation.service.js";
import { getAnimalAIEligibility } from "../services/ai-eligibility.service.js";
import { buildAIServiceContext } from "../domain/ai-service-context.js";
import { getPregnancyCheckReadiness } from "../domain/pregnancy-readiness.js";
import { loadPregnancyConfirmationPolicy } from "../services/pregnancy-policy.service.js";
import { withPregnancyConfirmationMetadata } from "../domain/pregnancy-confirmation-metadata.js";
import { activeHealthCaseKey } from "../services/health-request-creation.service.js";
import {
  verifyPostpartumWindow,
  calculateTargetCalvingDate,
  checkInseminationAgeEligibility,
} from "../utils/cattleCore.js";
import { recordTechnicianAIService } from "../services/livestock-transaction.service.js";
import { recordPreviousInsemination } from "../services/previous-insemination.service.js";
import {
  notifyUser,
  notifyUserBestEffort,
  sendNotificationPush,
} from "../services/notification-delivery.service.js";
import { presentNotificationDocument } from "../domain/notification-presentation.js";
import {
  buildAIRequestAssignmentGuard,
  buildAIRequestMutationOwnershipGuard,
} from "../policies/request.policy.js";
import { normalizeTechnicianNoteInput } from "../domain/ai-recording-fields.js";
import { combineManilaServiceDateTime } from "../domain/service-date-time.js";
import {
  AI_STATUS,
  normalizeAIStatus,
} from "../domain/status-vocabulary.js";
import {
  assertTechnicianEligibleForNewRequest,
  buildNewRequestDispatchFilter,
} from "../services/dispatch-eligibility.service.js";
import {
  getFarmerInvitationRedirectUrl,
  resolveOrCreateAssistedFarmer,
} from "../services/farmer-profile-resolution.service.js";
import { PREGNANCY_TASK_STAGE } from "../domain/pregnancy-task-workflow.js";
import {
  buildActiveAIWorkFilter,
  buildActiveHealthWorkFilter,
  buildActiveStandaloneTaskFilter,
  buildCompletedAIWorkFilter,
  buildCompletedHealthWorkFilter,
  buildCompletedStandaloneTaskFilter,
} from "../services/technician-workload-summary.service.js";
import { getAIRequestPhotos } from "../domain/ai-request-attachments.js";

const combineMongoFilters = (baseFilter, ...conditions) => {
  const { $and: baseAnd = [], ...base } = baseFilter;
  const activeConditions = conditions.filter(
    (condition) => condition && Object.keys(condition).length > 0,
  );
  return activeConditions.length || baseAnd.length
    ? { ...base, $and: [...baseAnd, ...activeConditions] }
    : base;
};

const appendMongoCondition = (query, condition) => {
  if (!condition || Object.keys(condition).length === 0) return;
  query.$and = [...(query.$and || []), condition];
};

export const getHealthRequestAttachmentUrls = (request = {}) => [
  ...new Set(
    [
      ...(Array.isArray(request.photos) ? request.photos : []),
      request.imageUrl,
    ]
      .filter((url) => typeof url === "string")
      .map((url) => url.trim())
      .filter(Boolean),
  ),
];

const fetchBoundedPartitions = async ({
  Model,
  baseFilter,
  partitions,
  windowLimit,
  populate,
}) => {
  const batches = await Promise.all(
    partitions.map(async ({ filter = {}, sort }) => {
      let query = Model.find(combineMongoFilters(baseFilter, filter));
      if (populate) query = populate(query);
      query = query.sort(sort);
      if (typeof query.limit === "function") query = query.limit(windowLimit);
      return query.lean();
    }),
  );
  const byId = new Map();
  for (const document of batches.flat()) {
    byId.set(String(document._id), document);
  }
  return [...byId.values()];
};

const fieldMissing = (field) => ({ [field]: null });
const fieldPresent = (field) => ({ [field]: { $ne: null } });

const effectiveDatePartitions = (fields, direction = 1) => [
  ...fields.map((field, index) => ({
    filter: combineMongoFilters(
      {},
      ...fields.slice(0, index).map(fieldMissing),
      fieldPresent(field),
    ),
    sort: { [field]: direction, _id: direction },
  })),
  {
    filter: combineMongoFilters({}, ...fields.map(fieldMissing)),
    sort: { _id: direction },
  },
];

const workQueueDatePartitions = (fields, workState, todayStart) => {
  if (workState === "completed") return effectiveDatePartitions(fields, 1);
  const [scheduledField, ...fallbackFields] = fields;
  return [
    {
      filter: {
        [scheduledField]: { $ne: null, $lt: todayStart },
      },
      sort: { [scheduledField]: 1, _id: 1 },
    },
    {
      filter: { [scheduledField]: { $gte: todayStart } },
      sort: { [scheduledField]: 1, _id: 1 },
    },
    ...fallbackFields.map((field, index) => ({
      filter: combineMongoFilters(
        {},
        fieldMissing(scheduledField),
        ...fallbackFields.slice(0, index).map(fieldMissing),
        fieldPresent(field),
      ),
      sort: { [field]: 1, _id: 1 },
    })),
    {
      filter: combineMongoFilters(
        {},
        fieldMissing(scheduledField),
        ...fallbackFields.map(fieldMissing),
      ),
      sort: { _id: 1 },
    },
  ];
};

const crossPartitions = (left, right) =>
  left.flatMap((leftPartition) =>
    right.map((rightPartition) => ({
      filter: combineMongoFilters(
        {},
        leftPartition.filter,
        rightPartition.filter,
      ),
      sort: rightPartition.sort,
    })),
  );

export const getTechnicianDashboardData = async (req, res) => {
  try {
    const { fullAgenda, includeFutureDateBoundTasks } = req.query;
    const isFull = fullAgenda === "true";
    const isDateBoundSchedule =
      isFull && includeFutureDateBoundTasks === "true";

    const now = new Date();
    const PHT_OFFSET = 8 * 60 * 60 * 1000;
    const todayStart = new Date(now.getTime() + PHT_OFFSET);
    todayStart.setUTCHours(0, 0, 0, 0);
    todayStart.setTime(todayStart.getTime() - PHT_OFFSET);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const isAdmin = req.user?.role === "admin";
    const aiDispatch = isAdmin
      ? null
      : buildNewRequestDispatchFilter({
          technician: req.user,
          requestType: "AI",
        });
    const healthDispatch = isAdmin
      ? null
      : buildNewRequestDispatchFilter({
          technician: req.user,
          requestType: "HEALTH",
        });
    const eligibleUnassignedAI = {
      approvedBy: null,
      technicianId: null,
      declinedByTechnicianIds: { $ne: req.user?._id },
      ...(aiDispatch?.filter || {}),
    };
    const eligibleUnassignedHealth = {
      handledBy: null,
      assignedTechnicianId: null,
      declinedByTechnicianIds: { $ne: req.user?._id },
      ...(healthDispatch?.filter || {}),
    };
    const dashboardAIVisibility = isAdmin
      ? {}
      : {
          $or: [
            { approvedBy: req.user._id },
            { technicianId: req.user._id },
            eligibleUnassignedAI,
          ],
        };
    const dashboardHealthVisibility = isAdmin
      ? {}
      : {
          $or: [
            { handledBy: req.user._id },
            { assignedTechnicianId: req.user._id },
            eligibleUnassignedHealth,
          ],
        };
    const assigneeFilterAI = isAdmin
      ? {}
      : {
          $or: [{ approvedBy: req.user._id }, { technicianId: req.user._id }],
        };
    const healthAssigneeField = "assignedTechnicianId";
    const assigneeFilterHealth = isAdmin
      ? {}
      : {
          $or: [
            { handledBy: req.user._id },
            { [healthAssigneeField]: req.user._id },
          ],
        };

    // 1. FETCH ALL STATS & DATA STREAMS IN PARALLEL
    const [
      totalInseminationsRecordToday,
      totalHealthPending,
      totalAI_90,
      totalPreg_90,
      todayVisitsArr,
      completedTodayArr,
      inseminations,
      healthReqs,
      animalRegistryData,
      totalInsemMonth,
      totalPregnancyCheckupMonth,
      totalCalvingMonth,
      scheduledTasks,
    ] = await Promise.all([
      // Stats
      Insemination.countDocuments({
        $or: [
          { scheduledDate: { $gte: todayStart, $lt: todayEnd } },
          { inseminationDate: { $gte: todayStart, $lt: todayEnd } },
        ],
        ...assigneeFilterAI,
      }),
      HealthRequest.countDocuments({
        status: "pending",
        deletedAt: null,
        ...(isAdmin ? {} : eligibleUnassignedHealth),
      }),
      Insemination.countDocuments({
        inseminationDate: { $gte: ninetyDaysAgo },
        ...assigneeFilterAI,
      }),
      Pregnancy.countDocuments({
        createdAt: { $gte: ninetyDaysAgo },
        "pregnancyDiagnosis.result": "Pregnant",
        // Should pregnancy be scoped? Usually technicianId is on pregnancy, but the model might just be global. We'll leave as is or add if exists.
        ...(isAdmin ? {} : { "confirmation.confirmedBy": req.user._id }),
      }),
      // 5. Total Visits Scheduled for Today (AI + Health)
      Promise.all([
        Insemination.countDocuments({
          scheduledDate: { $gte: todayStart, $lt: todayEnd },
          ...assigneeFilterAI,
        }),
        HealthRequest.countDocuments({
          scheduledDate: { $gte: todayStart, $lt: todayEnd },
          ...assigneeFilterHealth,
        }),
      ]),
      // 6. Total Completed Today
      Promise.all([
        Insemination.countDocuments({
          ...buildCompletedAIWorkFilter({
            technicianId: isAdmin ? null : req.user._id,
          }),
          updatedAt: { $gte: todayStart, $lt: todayEnd },
        }),
        HealthRequest.countDocuments(
          combineMongoFilters(
            buildCompletedHealthWorkFilter({
              technicianId: isAdmin ? null : req.user._id,
            }),
            {
              $or: [
                { resolvedAt: { $gte: todayStart, $lt: todayEnd } },
                {
                  resolvedAt: null,
                  updatedAt: { $gte: todayStart, $lt: todayEnd },
                },
              ],
            },
          ),
        ),
        Task.countDocuments(
          combineMongoFilters(
            buildCompletedStandaloneTaskFilter({
              technicianId: isAdmin ? null : req.user._id,
            }),
            {
              $or: [
                { completedAt: { $gte: todayStart, $lt: todayEnd } },
                {
                  completedAt: null,
                  updatedAt: { $gte: todayStart, $lt: todayEnd },
                },
              ],
            },
          ),
        ),
      ]),
      // Data Streams (Using .lean() for performance)
      Insemination.find({
        status: { $in: ["pending", "approved", "scheduled", "in-progress"] },
        deletedAt: null,
        ...dashboardAIVisibility,
      })
        .populate(
          "farmerId",
          "name phoneNumber phone address farmLocation imageUrl",
        )
        .populate("animalId", "animalId earTag imageUrl breed species")
        .populate("approvedBy", "name")
        .sort({ createdAt: -1 })
        .lean(),

      HealthRequest.find({
        status: {
          $in: [
            "pending",
            "triaged",
            "assigned",
            "approved",
            "scheduled",
            "in-progress",
            "in_progress",
          ],
        },
        deletedAt: null,
        ...dashboardHealthVisibility,
      })
        .populate(
          "farmerId",
          "name phoneNumber phone address farmLocation imageUrl",
        )
        .populate("animalId", "animalId earTag imageUrl breed species")
        .populate("handledBy", "name")
        .sort({ urgency: -1, createdAt: -1 })
        .lean(),

      // Animal Registry (Fully Optimized Aggregation)
      Animal.aggregate([
        { $match: { deletedAt: null } },
        { $sort: { createdAt: -1 } },
        { $limit: 100 }, // Fetch a slightly larger pool for sorting

        {
          $lookup: {
            from: "users",
            localField: "farmerId",
            foreignField: "_id",
            as: "farmer",
          },
        },
        { $unwind: { path: "$farmer", preserveNullAndEmptyArrays: true } },

        {
          $lookup: {
            from: "inseminations",
            let: { animalId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$animalId", "$$animalId"] } } },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
            ],
            as: "lastIns",
          },
        },
        { $unwind: { path: "$lastIns", preserveNullAndEmptyArrays: true } },

        {
          $lookup: {
            from: "pregnancies",
            let: { animalId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$animalId", "$$animalId"] } } },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
            ],
            as: "lastPregnancy",
          },
        },
        {
          $unwind: { path: "$lastPregnancy", preserveNullAndEmptyArrays: true },
        },

        {
          $addFields: {
            lastActivityDate: {
              $max: [
                "$createdAt",
                { $ifNull: ["$lastIns.createdAt", new Date(0)] },
                { $ifNull: ["$lastPregnancy.createdAt", new Date(0)] },
              ],
            },
          },
        },
        { $sort: { lastActivityDate: -1 } },
        { $limit: 50 },
      ]),
      // 7. Total AI Month
      Insemination.countDocuments({
        inseminationDate: { $gte: monthStart },
        ...assigneeFilterAI,
      }),
      Pregnancy.countDocuments({
        createdAt: { $gte: monthStart },
        deletedAt: null,
        ...(isAdmin ? {} : { "confirmation.confirmedBy": req.user._id }),
      }),
      Calving.countDocuments({
        createdAt: { $gte: monthStart },
        deletedAt: null,
        ...(isAdmin ? {} : { technicianId: req.user._id }),
      }),
      // 8. Tasks (Claimed/Scheduled tasks)
      Task.find({
        status: { $in: ["Pending", "In Progress"] },
        $and: [
          isDateBoundSchedule
            ? { dueDate: { $ne: null } }
            : {
                $or: [
                  {
                    taskType: { $nin: ["PD", "BreedingFollowUp"] },
                    dueDate: { $ne: null },
                  },
                  {
                    taskType: { $in: ["PD", "BreedingFollowUp"] },
                    $or: [
                      {
                        status: "Pending",
                        dueDate: { $ne: null, $lte: new Date() },
                      },
                      { status: "In Progress", dueDate: { $ne: null } },
                    ],
                  },
                ],
              },
        ],
        ...(req.user.role !== "admin" ? { technicianId: req.user._id } : {}),
      })
        .populate("farmerId", "name phoneNumber phone address farmLocation")
        .populate("animalIds", "animalId earTag imageUrl breed species")
        .sort({ dueDate: 1, createdAt: -1 })
        .lean(),
    ]);

    // 2. Fetch Success Rate from Cache or Calculate
    const totalInsem_90 = await Insemination.countDocuments({
      inseminationDate: { $gte: ninetyDaysAgo },
      ...assigneeFilterAI,
    });
    const successRate =
      totalInsem_90 > 0
        ? Math.min(100, (totalPreg_90 / totalInsem_90) * 100).toFixed(1) + "%"
        : "0%";

    // 2. FORMAT DATA
    const cleanAddressPart = (value) => {
      const normalized = String(value || "").trim();
      return normalized &&
        !["n/a", "na", "none", "null", "undefined"].includes(
          normalized.toLowerCase(),
        )
        ? normalized
        : "";
    };

    const formatAddress = (addr) => {
      if (!addr) return "Unknown Location";
      if (typeof addr === "string") return addr;
      if (Array.isArray(addr) && addr.length > 0) {
        const first = addr[0];
        return (
          [first.barangay, first.city || first.municipality]
            .map(cleanAddressPart)
            .filter(Boolean)
            .join(", ") || "Unknown Location"
        );
      }
      if (typeof addr === "object") {
        return (
          [addr.barangay, addr.city || addr.municipality]
            .map(cleanAddressPart)
            .filter(Boolean)
            .join(", ") || "Unknown Location"
        );
      }
      return "Unknown Location";
    };

    const formatTime = (date) => {
      if (!date) return "Not Set";
      return new Date(date).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Manila",
      });
    };

    const getFarmLocationDetails = (farmer) => {
      const farmLocation = farmer?.farmLocation || null;
      const hasCoordinates =
        Number.isFinite(farmLocation?.latitude) &&
        Number.isFinite(farmLocation?.longitude);
      const label =
        farmLocation?.detectedAddress?.trim() ||
        farmLocation?.landmark?.trim() ||
        (hasCoordinates ? "Farm pin saved" : formatAddress(farmer?.address));

      return {
        farmLocation,
        farmLocationLabel: label,
        hasFarmPin: hasCoordinates,
        navigationTarget: hasCoordinates
          ? `${farmLocation.latitude},${farmLocation.longitude}`
          : null,
      };
    };

    const pendingRequests = [];
    const agendaItems = [];

    // Process Inseminations
    inseminations.forEach((ins) => {
      const farmLocationDetails = getFarmLocationDetails(ins.farmerId);
      const isMobileRequest = !ins.sireCode && ins.status === "pending";
      const hasScheduledVisit = Boolean(ins.scheduledDate);
      const hasCancellationRequest =
        ins.cancellationStatus === "requested";
      const itemDisplayDate =
        ins.status === "done" || ins.status === "resolved"
          ? ins.inseminationDate ||
            ins.scheduledDate ||
            ins.preferredDate ||
            ins.createdAt
          : ins.scheduledDate ||
            ins.preferredDate ||
            ins.inseminationDate ||
            ins.createdAt;

      const isOverdue =
        ["pending", "approved", "scheduled", "in-progress"].includes(
          ins.status,
        ) && new Date(itemDisplayDate) < todayStart;
      const isReadyToday =
        ["approved", "scheduled"].includes(ins.status) &&
        new Date(itemDisplayDate) >= todayStart &&
        new Date(itemDisplayDate) < todayEnd;

      const item = {
        id: ins._id,
        scheduledDate: ins.scheduledDate || null,
        type: "insemination",
        taskType: "AI",
        serviceType: "Artificial Insemination",
        status: ins.status,
        isReadyToday,
        time: formatTime(itemDisplayDate),
        preferredTime: formatTime(itemDisplayDate),
        displayDate: itemDisplayDate,
        visitPeriod: ins.visitPeriod || null,
        farmer: ins.farmerId?.name || "Unknown Farmer",
        farmerName: ins.farmerId?.name || "Unknown Farmer",
        farmerPhone: ins.farmerId?.phoneNumber || ins.farmerId?.phone || null,
        farmerImageUrl:
          ins.farmerId?.imageUrl ||
          ins.farmerId?.avatarUrl ||
          ins.farmerId?.profilePicture ||
          ins.farmerId?.avatar ||
          "",
        location: formatAddress(ins.farmerId?.address),
        ...farmLocationDetails,
        animalTag: ins.animalId?.earTag || ins.animalId?.animalId || null,
        displayStatus: hasCancellationRequest
          ? "Cancellation requested"
          : isReadyToday
            ? "Ready Today"
            : ins.status,
        task: isMobileRequest
          ? `AI Request (Attempt #${ins.attemptNumber || 1}) - ${ins.animalId?.animalId || ins.animalId?.earTag || "Unknown"}`
          : `AI Service (Attempt #${ins.attemptNumber || 1}) - ${ins.animalId?.animalId || ins.animalId?.earTag || "Unknown"}`,
        urgent: isMobileRequest,
        overdue: isOverdue,
        sentTime: formatTime(ins.createdAt),
        createdAt: ins.createdAt,
        raw: ins,
      };

      const assignedToMeAI =
        req.user?.role === "admin" ||
        ins.approvedBy?._id?.toString() === req.user?._id?.toString() ||
        ins.technicianId?.toString() === req.user?._id?.toString();

      const isUnassignedAI = !ins.approvedBy && !ins.technicianId;

      if (
        ["pending", "approved", "scheduled", "in-progress"].includes(ins.status)
      ) {
        if (isUnassignedAI) {
          const candidateItem = {
            id: ins._id,
            type: "insemination",
            status: ins.status,
            isReadyToday,
            time: formatTime(itemDisplayDate),
            preferredTime: formatTime(itemDisplayDate),
            displayDate: itemDisplayDate,
            farmer: ins.farmerId?.name || "Unknown Farmer",
            animalTag: ins.animalId?.earTag || ins.animalId?.animalId || null,
            municipality:
              ins.farmerId?.address?.city ||
              ins.farmerId?.address?.municipality ||
              "",
            barangay: ins.farmerId?.address?.barangay || "",
            displayStatus: isReadyToday ? "Ready Today" : ins.status,
            task: isMobileRequest
              ? `AI Request (Attempt #${ins.attemptNumber || 1}) - ${ins.animalId?.animalId || ins.animalId?.earTag || "Unknown"}`
              : `AI Service (Attempt #${ins.attemptNumber || 1}) - ${ins.animalId?.animalId || ins.animalId?.earTag || "Unknown"}`,
            urgent: isMobileRequest,
            overdue: isOverdue,
            sentTime: formatTime(ins.createdAt),
            createdAt: ins.createdAt,
            farmerImageUrl:
              ins.farmerId?.imageUrl ||
              ins.farmerId?.avatarUrl ||
              ins.farmerId?.profilePicture ||
              ins.farmerId?.avatar ||
              "",
          };
          pendingRequests.push(candidateItem);
        }
      }

      if (
        isFull ||
        (itemDisplayDate >= todayStart && itemDisplayDate < todayEnd) ||
        isOverdue
      ) {
        if (
          hasScheduledVisit &&
          ins.status !== "pending" &&
          assignedToMeAI
        ) {
          agendaItems.push(item);
        }
      }
    });

    // Process Health Requests
    healthReqs.forEach((healthRequest) => {
      const farmLocationDetails = getFarmLocationDetails(
        healthRequest.farmerId,
      );
      const hasScheduledVisit = Boolean(healthRequest.scheduledDate);
      const hasCancellationRequest =
        healthRequest.cancellationStatus === "requested";
      const itemDisplayDate =
        healthRequest.status === "resolved" || healthRequest.status === "done"
          ? healthRequest.scheduledDate ||
            healthRequest.preferredDate ||
            healthRequest.createdAt // Health doesn't have inseminationDate
          : healthRequest.scheduledDate ||
            healthRequest.preferredDate ||
            healthRequest.createdAt;

      const isOverdue =
        [
          "pending",
          "triaged",
          "assigned",
          "approved",
          "scheduled",
          "in-progress",
          "in_progress",
        ].includes(healthRequest.status) &&
        new Date(itemDisplayDate) < todayStart;
      const isReadyToday =
        ["approved", "scheduled"].includes(healthRequest.status) &&
        new Date(itemDisplayDate) >= todayStart &&
        new Date(itemDisplayDate) < todayEnd;

      const item = {
        id: healthRequest._id,
        scheduledDate: healthRequest.scheduledDate || null,
        type: "health",
        taskType: "Health",
        serviceType: healthRequest.requestType || "Health Assistance",
        status: healthRequest.status,
        isReadyToday,
        time: formatTime(itemDisplayDate),
        preferredTime: formatTime(itemDisplayDate),
        displayDate: itemDisplayDate,
        visitPeriod: healthRequest.visitPeriod || null,
        handlingMethod: healthRequest.handlingMethod || null,
        farmer: healthRequest.farmerId?.name || "Unknown Farmer",
        farmerName: healthRequest.farmerId?.name || "Unknown Farmer",
        farmerPhone:
          healthRequest.farmerId?.phoneNumber ||
          healthRequest.farmerId?.phone ||
          null,
        farmerImageUrl:
          healthRequest.farmerId?.imageUrl ||
          healthRequest.farmerId?.avatarUrl ||
          healthRequest.farmerId?.profilePicture ||
          healthRequest.farmerId?.avatar ||
          "",
        location: formatAddress(healthRequest.farmerId?.address),
        ...farmLocationDetails,
        animalTag:
          healthRequest.animalId?.earTag ||
          healthRequest.animalId?.animalId ||
          null,
        displayStatus: hasCancellationRequest
          ? "Cancellation requested"
          : isReadyToday
            ? "Ready Today"
            : healthRequest.status,
        task: `Health Check - ${healthRequest.animalId?.animalId || healthRequest.animalId?.earTag || "Unknown"}`,
        urgent: ["high", "emergency"].includes(healthRequest.urgency),
        overdue: isOverdue,
        sentTime: formatTime(healthRequest.createdAt),
        createdAt: healthRequest.createdAt,
        raw: healthRequest,
      };

      const assignedToMeHealth =
        req.user?.role === "admin" ||
        healthRequest.handledBy?._id?.toString() ===
          req.user?._id?.toString() ||
        healthRequest.assignedTechnicianId?.toString() ===
          req.user?._id?.toString();

      const isUnassignedHealth =
        !healthRequest.handledBy && !healthRequest.assignedTechnicianId;

      if (
        [
          "pending",
          "triaged",
          "assigned",
          "approved",
          "scheduled",
          "in-progress",
          "in_progress",
        ].includes(healthRequest.status)
      ) {
        if (isUnassignedHealth) {
          const candidateItem = {
            id: healthRequest._id,
            type: "health",
            taskType: "Health",
            serviceType: healthRequest.requestType || "Health Assistance",
            status: healthRequest.status,
            isReadyToday,
            time: formatTime(itemDisplayDate),
            preferredTime: formatTime(itemDisplayDate),
            displayDate: itemDisplayDate,
            farmer: healthRequest.farmerId?.name || "Unknown Farmer",
            animalTag:
              healthRequest.animalId?.earTag ||
              healthRequest.animalId?.animalId ||
              null,
            municipality:
              healthRequest.farmerId?.address?.city ||
              healthRequest.farmerId?.address?.municipality ||
              "",
            barangay: healthRequest.farmerId?.address?.barangay || "",
            displayStatus: isReadyToday ? "Ready Today" : healthRequest.status,
            task: `Health Check - ${healthRequest.animalId?.animalId || healthRequest.animalId?.earTag || "Unknown"}`,
            urgent: ["high", "emergency"].includes(healthRequest.urgency),
            overdue: isOverdue,
            sentTime: formatTime(healthRequest.createdAt),
            createdAt: healthRequest.createdAt,
            farmerImageUrl:
              healthRequest.farmerId?.imageUrl ||
              healthRequest.farmerId?.avatarUrl ||
              healthRequest.farmerId?.profilePicture ||
              healthRequest.farmerId?.avatar ||
              "",
          };
          pendingRequests.push(candidateItem);
        }
      }

      if (
        isFull ||
        (itemDisplayDate >= todayStart && itemDisplayDate < todayEnd) ||
        isOverdue
      ) {
        if (
          hasScheduledVisit &&
          !["advice", "office_pickup"].includes(
            healthRequest.handlingMethod,
          ) &&
          healthRequest.status !== "pending" &&
          assignedToMeHealth
        ) {
          agendaItems.push(item);
        }
      }
    });

    // Process scheduled technician tasks / general visits
    scheduledTasks.forEach((taskDoc) => {
      const itemDisplayDate = taskDoc.dueDate || taskDoc.createdAt;
      const isOverdue =
        ["Pending", "In Progress"].includes(taskDoc.status) &&
        new Date(itemDisplayDate) < todayStart;
      const firstAnimal = Array.isArray(taskDoc.animalIds)
        ? taskDoc.animalIds[0]
        : null;

      const getFarmLocationTarget = (farmer) => {
        const loc = farmer?.farmLocation;
        if (
          typeof loc?.latitude === "number" &&
          typeof loc?.longitude === "number"
        ) {
          return `${loc.latitude},${loc.longitude}`;
        }
        return null;
      };

      const item = {
        id: taskDoc._id,
        taskId: taskDoc._id,
        dueDate: taskDoc.dueDate || null,
        type: "task",
        taskType: taskDoc.taskType || "Other",
        status: taskDoc.status,
        displayStatus: taskDoc.status,
        time: formatTime(itemDisplayDate),
        displayDate: itemDisplayDate,
        visitPeriod: taskDoc.metadata?.visitPeriod || null,
        farmer: taskDoc.farmerId?.name || "Unknown Farmer",
        farmerName: taskDoc.farmerId?.name || "Unknown Farmer",
        farmerPhone:
          taskDoc.farmerId?.phoneNumber || taskDoc.farmerId?.phone || null,
        farmerImageUrl:
          taskDoc.farmerId?.avatarUrl ||
          taskDoc.farmerId?.profilePicture ||
          taskDoc.farmerId?.avatar ||
          null,
        location: formatAddress(taskDoc.farmerId?.address),
        farmLocationLabel:
          taskDoc.farmerId?.farmLocation?.detectedAddress?.trim() ||
          taskDoc.farmerId?.farmLocation?.landmark?.trim() ||
          (getFarmLocationTarget(taskDoc.farmerId)
            ? "Farm pin saved"
            : formatAddress(taskDoc.farmerId?.address)),
        navigationTarget: getFarmLocationTarget(taskDoc.farmerId),
        farmLocation: taskDoc.farmerId?.farmLocation || null,
        animalId: firstAnimal || null,
        animalTag: firstAnimal?.earTag || firstAnimal?.animalId || null,
        preferredTime: formatTime(itemDisplayDate),
        task: `${taskDoc.taskType || "Visit"}${firstAnimal ? ` - ${firstAnimal.animalId || firstAnimal.earTag || "Unknown"}` : ""}`,
        urgent:
          taskDoc.category === "Urgent" || taskDoc.category === "Emergency",
        overdue: isOverdue,
        sentTime: formatTime(taskDoc.createdAt),
        raw: taskDoc,
      };

      const isDateToday = (d) => {
        if (!d) return false;
        const dateVal = new Date(d);
        return dateVal >= todayStart && dateVal < todayEnd;
      };

      if (isFull || isDateToday(itemDisplayDate) || isOverdue) {
        agendaItems.push(item);
      }
    });

    agendaItems.sort(
      (a, b) => new Date(a.displayDate) - new Date(b.displayDate),
    );

    const getSortableTimestamp = (item) => {
      const value = item?.createdAt || item?.displayDate;

      if (!value) {
        return 0;
      }

      const timestamp = new Date(value).getTime();

      return Number.isFinite(timestamp) ? timestamp : 0;
    };

    pendingRequests.sort(
      (a, b) => getSortableTimestamp(b) - getSortableTimestamp(a),
    );

    const urgentHealthCount = healthReqs.filter((request) =>
      ["high", "emergency"].includes(
        String(request.urgency || "").trim().toLowerCase(),
      ),
    ).length;

    const animalRegistry = animalRegistryData.map((a) => {
      const lastIns = a.lastIns || null;
      const lastPregnancy = a.lastPregnancy || null;

      let status = "Pending";
      let sClass = "text-yellow-600";
      let dotClass = "bg-yellow-500";
      let last = "Added";

      if (
        lastPregnancy &&
        lastPregnancy.pregnancyDiagnosis?.result === "Pregnant"
      ) {
        status = "Pregnant";
        sClass = "text-purple-600";
        dotClass = "bg-purple-500";
        last = "Pregnancy Check";
      } else if (
        lastIns &&
        (lastIns.status === "approved" ||
          lastIns.status === "done" ||
          lastIns.status === "in-progress")
      ) {
        status = "Inseminated";
        sClass = "text-blue-600";
        dotClass = "bg-blue-500";
        last = "Insemination";
      } else if (lastIns && lastIns.status === "pending") {
        status = "Pending AI";
        sClass = "text-yellow-600";
        dotClass = "bg-yellow-500";
        last = "AI Request";
      }

      return {
        id: `#${(a.earTag || a.animalId)?.toString().substring(0, 4)}`,
        rawId: a._id,
        breed: a.breed || "Crossbreed",
        status,
        sClass,
        dotClass,
        last,
        farmerName: a.farmer?.name || "Unknown",
        farmerPhone: a.farmer?.phoneNumber || "No Contact",
        imageUrl: a.imageUrl || null,
        lastActionDate: a.lastActivityDate,
      };
    });

    res.status(200).json({
      stats: {
        todayActivities: todayVisitsArr[0] + todayVisitsArr[1],
        completedToday:
          completedTodayArr[0] + completedTodayArr[1] + completedTodayArr[2],
        urgentHealth: urgentHealthCount,
        pendingHealth: totalHealthPending,
        successRate,
        totalInsemMonth,
        totalPregnancyCheckupMonth,
        totalCalvingMonth,
      },
      pendingRequests,
      agendaItems,
      animalRegistry,
    });
  } catch (error) {
    console.error("[getTechnicianDashboardData ERROR]", error);
    res.status(500).json({ message: "Failed to load dashboard data." });
  }
};

// --- PAGINATED LISTS FOR TECHNICIAN ---

export const getMyInseminations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const ownershipFilter =
      req.user.role === "admin"
        ? {}
        : buildAIRequestMutationOwnershipGuard({
            technicianId: req.user._id,
          });
    const query = combineMongoFilters(
      { deletedAt: null },
      ownershipFilter,
    );
    const search = String(req.query.search || "").trim();
    const estrus = String(req.query.estrus || "").trim();
    const outcome = String(req.query.outcome || "").trim();

    if (estrus) query.estrus = estrus;
    if (outcome) query.outcome = outcome;

    if (search) {
      const searchPattern = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      const [farmers, animals] = await Promise.all([
        User.find({ name: searchPattern }).select("_id").lean(),
        Animal.find({
          $or: [{ earTag: searchPattern }, { animalId: searchPattern }],
        })
          .select("_id")
          .lean(),
      ]);

      query.$or = [
        { farmerId: { $in: farmers.map((farmer) => farmer._id) } },
        { animalId: { $in: animals.map((animal) => animal._id) } },
        { sireBreed: searchPattern },
        { sireCode: searchPattern },
      ];
    }

    const summaryQuery = combineMongoFilters(
      { deletedAt: null },
      ownershipFilter,
    );
    const [records, total, totalCycles, confirmedPregnant, pendingChecks] =
      await Promise.all([
        Insemination.find(query)
          .populate("farmerId", "name phoneNumber address imageUrl")
          .populate("animalId", "animalId earTag breed species imageUrl")
          .populate("pregnancyId")
          .populate("technicianId", "name")
          .populate("approvedBy", "name")
          .populate(
            "previousAttemptId",
            "attemptNumber inseminationDate outcome outcomeVerificationStatus outcomeConfirmedAt",
          )
          .sort({ inseminationDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Insemination.countDocuments(query),
        Insemination.countDocuments(summaryQuery),
        Insemination.countDocuments({ ...summaryQuery, outcome: "Pregnant" }),
        Insemination.countDocuments({ ...summaryQuery, outcome: "Pending" }),
      ]);

    res.status(200).json({
      inseminations: records,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      summary: { totalCycles, confirmedPregnant, pendingChecks },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching inseminations", error: error.message });
  }
};

export const getMyReInseminations = async (req, res) => {
  res.status(410).json({
    message:
      "This legacy re-insemination list is no longer available. Use Technician Requests for open work and My Work for assigned services.",
    code: "LEGACY_REINSEMINATION_LIST_DEPRECATED",
    replacements: {
      openRequests: "/api/technician/requests",
      myWork: "/api/technician/work-queue",
    },
  });
};

export const getMyPregnancyChecks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      Pregnancy.find({ deletedAt: null })
        .populate("farmerId", "name phoneNumber address")
        .populate("animalId", "animalId earTag breed species imageUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Pregnancy.countDocuments({ deletedAt: null }),
    ]);

    res.status(200).json({
      data: records.map(withPregnancyConfirmationMetadata),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching pregnancy checks",
      error: error.message,
    });
  }
};

export const getMyCalvings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      Calving.find({ deletedAt: null })
        .populate("farmerId", "name phoneNumber address")
        .populate(
          "animalId",
          "animalId earTag breed species imageUrl color brand",
        )
        .populate(
          "calves.animalId",
          "animalId earTag breed species color brand",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Calving.countDocuments({ deletedAt: null }),
    ]);

    res.status(200).json({
      data: records,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching calvings", error: error.message });
  }
};

export const getMyNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const query = { recipientId: req.user._id };

    const [records, total] = await Promise.all([
      Notification.find(query)
        .populate("senderId", "name imageUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
    ]);

    res.status(200).json({
      data: records.map(presentNotificationDocument),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching notifications", error: error.message });
  }
};

export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password").lean();
    res.status(200).json(user);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching profile", error: error.message });
  }
};

// --- ACTION HANDLERS ---

export const getAIServiceContext = async (req, res) => {
  try {
    const { farmerId, animalId } = req.query;

    if (
      !mongoose.Types.ObjectId.isValid(farmerId) ||
      !mongoose.Types.ObjectId.isValid(animalId)
    ) {
      return res.status(400).json({
        code: "AI_SERVICE_CONTEXT_REQUIRED",
        message: "Select a registered farmer and animal to continue.",
      });
    }

    const [farmer, animal] = await Promise.all([
      User.findOne({ _id: farmerId, role: "farmer" }).lean(),
      Animal.findById(animalId).lean(),
    ]);

    if (!farmer) {
      return res.status(404).json({
        code: "FARMER_NOT_FOUND",
        message: "The selected farmer profile is no longer available.",
      });
    }
    if (!animal) {
      return res.status(404).json({
        code: "ANIMAL_NOT_FOUND",
        message: "The selected animal profile is no longer available.",
      });
    }
    if (String(animal.farmerId) !== String(farmer._id)) {
      return res.status(400).json({
        code: "ANIMAL_FARMER_MISMATCH",
        message: "The selected animal does not belong to the selected farmer.",
      });
    }

    const activeRequest = await findActiveAIRequest(animal._id);
    if (activeRequest) {
      await activeRequest.populate([
        { path: "approvedBy", select: "name" },
        { path: "technicianId", select: "name" },
      ]);
    }

    const task = activeRequest
      ? await Task.findOne({
          taskType: "AI",
          status: { $in: ["Pending", "In Progress"] },
          $or: [
            {
              relatedRecordType: "insemination",
              relatedRecordId: activeRequest._id,
            },
            { "metadata.requestId": activeRequest._id },
            { "metadata.inseminationId": activeRequest._id },
          ],
        })
          .select("_id status technicianId dueDate")
          .lean()
      : null;

    const eligibility = activeRequest
      ? {
          eligible: true,
          code: "ACTIVE_REQUEST_FOUND",
          reason: "Continue the existing AI service request for this animal.",
        }
      : await getAnimalAIEligibility({ animal, at: new Date() });

    const context = buildAIServiceContext({
      activeRequest,
      eligibility,
      task,
      actorId: req.user._id,
      isAdmin: req.user.role === "admin",
      now: new Date(),
    });

    return res.status(200).json({
      ...context,
      farmer: {
        _id: farmer._id,
        name: farmer.name,
        phoneNumber: farmer.phoneNumber || "",
        address: farmer.address || null,
      },
      animal: {
        _id: animal._id,
        animalId: animal.animalId,
        earTag: animal.earTag,
        species: animal.species,
        breed: animal.breed,
        gender: animal.gender,
        reproductiveStatus: animal.reproductiveStatus,
      },
    });
  } catch (error) {
    console.error("[getAIServiceContext ERROR]", error);
    return res.status(500).json({
      code: "AI_SERVICE_CONTEXT_FAILED",
      message: "The AI service context could not be loaded.",
    });
  }
};

export const walkInInsemination = async (req, res) => {
  try {
    if (req.user?.role !== "technician") {
      return res.status(403).json({
        message: "AI service recording requires a Technician account.",
        code: "TECHNICIAN_CLINICAL_ROLE_REQUIRED",
      });
    }

    const {
      farmerId,
      animalId: bodyAnimalId,
      firstName,
      lastName,
      phoneNumber,
      email,
      address,
      animalDetails,
      inseminationDetails,
      taskId,
      requestId,
    } = req.body;
    const technicianNote = normalizeTechnicianNoteInput(
      inseminationDetails || {},
    );

    // 1. Resolve or Create Farmer
    let farmer;
    let farmerResolution = null;
    if (farmerId) {
      farmer = await User.findById(farmerId);
    } else {
      farmerResolution = await resolveOrCreateAssistedFarmer({
        email,
        phoneNumber,
        name: `${firstName || ""} ${lastName || ""}`.trim(),
        address: {
          street:
            typeof address === "object" && address?.street
              ? address.street
              : "",
          barangay:
            typeof address === "string"
              ? address
              : address?.barangay || "Not Provided",
          city:
            typeof address === "object" && address?.city
              ? address.city
              : "Oton",
          province:
            typeof address === "object" && address?.province
              ? address.province
              : "Iloilo",
        },
        source: "walk-in-ai",
        invitationMode: email ? "best-effort" : "none",
        inviteExistingUnclaimed: false,
        allowClaimedExisting: true,
        redirectUrl: getFarmerInvitationRedirectUrl(),
        isVerified: true,
      });
      farmer = farmerResolution.farmer;
    }

    if (!farmer) {
      return res.status(400).json({ message: "Farmer details are required." });
    }

    // 2. Resolve or Create Animal
    let animal;
    if (bodyAnimalId) {
      animal = await Animal.findById(bodyAnimalId);
    } else if (animalDetails?.earTag) {
      animal = await Animal.findOne({ earTag: animalDetails.earTag });
    } else if (animalDetails?.animalId) {
      animal = await Animal.findOne({ animalId: animalDetails.animalId });
    }

    if (!animal) {
      return res.status(400).json({
        code: "ANIMAL_SELECTION_REQUIRED",
        message:
          "Select an existing animal before recording AI. Historical or incomplete animal records must be entered through an authorized historical-record workflow.",
      });
    }
    if (String(animal.farmerId) !== String(farmer._id)) {
      return res.status(400).json({
        code: "ANIMAL_FARMER_MISMATCH",
        message: "The selected animal does not belong to the selected farmer.",
      });
    }

    // Preserve the actual Manila service timestamp. Missing current-field
    // inputs fall back to the current clock, never a fixed appointment time.
    const entryDate = combineManilaServiceDateTime({
      date: inseminationDetails?.inseminationDate,
      time: inseminationDetails?.time,
    });
    if (entryDate.getTime() > Date.now() + 5 * 60 * 1000) {
      return res
        .status(400)
        .json({ message: "AI service date cannot be in the future." });
    }
    if (entryDate.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
      return res.status(400).json({
        code: "HISTORICAL_AI_WORKFLOW_REQUIRED",
        message:
          "The Record AI form is for a current field service. Older AI records require an authorized historical-record workflow.",
      });
    }

    const result = await recordTechnicianAIService({
      taskId,
      requestId,
      farmerId: farmer._id,
      animalId: animal._id,
      inseminationDate: entryDate,
      sireBreed: inseminationDetails?.sireBreed,
      sireCode: inseminationDetails?.sireCode,
      semenDosesUsed: inseminationDetails?.semenDosesUsed,
      estrus: inseminationDetails?.estrus,
      technicianNote,
      actorId: req.user._id,
      isAdmin: req.user.role === "admin",
    });

    await sendNotificationPush({
      recipient: farmer,
      type: "ai-request",
      eventType: "field_ai_recorded",
      relatedId: result.insemination._id,
      linkType: "record",
      title: "AI service recorded",
      message: `The completed AI service for ${animal.earTag || animal.animalId} was recorded.`,
      metadata: {
        animalId: animal._id,
        animalTag: animal.earTag || animal.animalId,
        recordId: result.insemination._id,
        serviceType: "ai",
        technicianName: req.user.name,
      },
    });

    // Trigger Socket Update
    req.app
      .get("io")
      .emit("dashboardUpdate", { type: "WALKIN_INSEMINATION_CREATED" });

    res.status(201).json({
      message: "Walk-in insemination recorded successfully",
      insemination: result.insemination,
      outcome: result.outcome,
      task: result.task,
      farmer,
      animal,
      invitationAttempted: Boolean(farmerResolution?.invitationAttempted),
      invitationSent: Boolean(farmerResolution?.invitationSent),
      invitationStatus: farmerResolution?.invitationSent
        ? "sent"
        : farmerResolution?.invitationAttempted
          ? "failed"
          : "not_applicable",
      farmerProfileReused: farmerId ? true : Boolean(farmerResolution?.reused),
    });
  } catch (error) {
    console.error("[walkInInsemination ERROR]", error);
    res.status(error.status || 500).json({
      message: error.message || "Error recording insemination",
      code: error.code,
      ...(error.details || {}),
    });
  }
};

export const previousInsemination = async (req, res) => {
  try {
    if (req.user?.role !== "technician") {
      return res.status(403).json({
        message: "Previous AI recording requires a Technician account.",
        code: "TECHNICIAN_CLINICAL_ROLE_REQUIRED",
      });
    }

    const {
      farmerId,
      animalId: bodyAnimalId,
      animalDetails,
      inseminationDetails,
      entryMode,
    } = req.body;

    if (!farmerId) {
      return res.status(400).json({ message: "Farmer ID is required." });
    }
    const farmer = await User.findById(farmerId);
    if (!farmer) {
      return res.status(404).json({ message: "Farmer not found." });
    }

    let animal;
    if (bodyAnimalId) {
      animal = await Animal.findById(bodyAnimalId);
    } else if (animalDetails?.earTag) {
      animal = await Animal.findOne({ earTag: animalDetails.earTag });
    } else if (animalDetails?.animalId) {
      animal = await Animal.findOne({ animalId: animalDetails.animalId });
    }

    if (!animal) {
      return res.status(400).json({
        code: "ANIMAL_SELECTION_REQUIRED",
        message: "Select an existing animal before recording previous AI.",
      });
    }
    if (String(animal.farmerId) !== String(farmer._id)) {
      return res.status(400).json({
        code: "ANIMAL_FARMER_MISMATCH",
        message: "The selected animal does not belong to the selected farmer.",
      });
    }

    const result = await recordPreviousInsemination({
      farmerId: farmer._id,
      animalId: animal._id,
      inseminationDetails,
      entryMode,
      actorId: req.user._id,
    });

    req.app
      .get("io")
      .emit("dashboardUpdate", { type: "PREVIOUS_INSEMINATION_CREATED" });

    return res.status(201).json({
      message:
        entryMode === "history_only"
          ? "Previous AI saved to reproductive history."
          : "Previous AI saved and current tracking continued.",
      entryMode,
      insemination: result.insemination,
      outcome: result.outcome,
      task: result.task,
      farmer,
      animal: result.animal || animal,
    });
  } catch (error) {
    console.error("[previousInsemination ERROR]", error);
    return res.status(error.status || 500).json({
      message: error.message || "Error recording previous insemination",
      code: error.code,
      ...(error.details || {}),
    });
  }
};

export const getAnimalHistory = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Fetch all related records
    const [animal, inseminations, pregnancies, calvings, healthRequests] =
      await Promise.all([
        Animal.findOne({ _id: id, deletedAt: null })
          .populate("farmerId", "name phoneNumber address")
          .lean(),
        Insemination.find({ animalId: id, deletedAt: null })
          .sort({ createdAt: -1 })
          .lean(),
        Pregnancy.find({ animalId: id, deletedAt: null })
          .sort({ createdAt: -1 })
          .lean(),
        Calving.find({ animalId: id, deletedAt: null })
          .sort({ createdAt: -1 })
          .lean(),
        HealthRequest.find({ animalId: id, deletedAt: null })
          .sort({ createdAt: -1 })
          .lean(),
      ]);

    if (!animal) return res.status(404).json({ message: "Animal not found" });
    const policyResolution = await loadPregnancyConfirmationPolicy();
    const inseminationsWithReadiness = inseminations.map((insemination) => ({
      ...insemination,
      pregnancyReadiness: getPregnancyCheckReadiness({
        insemination,
        policy: policyResolution.policy,
        species: animal.species,
      }),
    }));
    const pregnanciesWithReadiness = pregnancies
      .map(withPregnancyConfirmationMetadata)
      .map((pregnancy) => {
        const insemination = inseminations.find(
          (item) =>
            String(item._id) ===
            String(pregnancy.inseminationId?._id || pregnancy.inseminationId),
        );
        return {
          ...pregnancy,
          calvingReadiness: getCalvingReadiness({
            mother: animal,
            pregnancy,
            insemination,
          }),
        };
      });

    // 2. Build Timeline Events
    const timeline = [];

    // - Registration Event
    timeline.push({
      _id: "reg-" + animal._id,
      title: "Animal Registered",
      description: `Initial enrollment of ${animal.breed} ${animal.species} into the system hub.`,
      date: animal.createdAt,
      status: "Done",
      iconType: "FileText",
      technicianName: "System Hub",
    });

    // - Inseminations
    inseminations.forEach((ins) => {
      timeline.push({
        _id: ins._id,
        relatedId: ins._id,
        type: "Insemination",
        title: `AI Service - ${ins.sireBreed || "Breed Not Specified"}`,
        description:
          ins.status === "pending"
            ? "Awaiting technician field deployment."
            : `${ins.outcome === "Pending" ? "Artificial Insemination performed." : `AI Result: ${ins.outcome}.`} Sire Code: ${ins.sireCode || "N/A"}.`,
        date: ins.inseminationDate || ins.createdAt,
        status: ins.status.charAt(0).toUpperCase() + ins.status.slice(1),
        iconType: "Syringe",
        technicianName: "Field Technician",
        // Extended Details
        details: {
          sireBreed: ins.sireBreed,
          sireCode: ins.sireCode,
          semenDosesUsed: ins.semenDosesUsed,
          visitPeriod: ins.visitPeriod,
          attemptNumber: ins.attemptNumber,
          estrus: ins.estrus,
          outcome: ins.outcome,
          technicianNote: ins.technicianNote || "",
        },
      });
    });

    // - Pregnancy Checks
    pregnanciesWithReadiness.forEach((p) => {
      const result = p.pregnancyDiagnosis?.result || "Pending";
      timeline.push({
        _id: p._id,
        relatedId: p._id,
        type: "Pregnancy Check",
        title: "Pregnancy Diagnosis",
        description:
          result === "Pregnant"
            ? `Confirmed PREGNANT. Expected calving around ${new Date(p.targetCalvingDate).toLocaleDateString()}.`
            : `Diagnosis Result: ${result}. ${p.technicianNote || ""}`,
        date: p.pregnancyDiagnosis?.date || p.createdAt,
        status: result === "Pregnant" ? "Done" : "Done",
        iconType: "HeartPulse",
        technicianName: "Veterinary Officer",
        // Extended Details
        details: {
          result,
          diagnosisDate: p.pregnancyDiagnosis?.date,
          targetCalvingDate: p.targetCalvingDate,
          technicianNote: p.technicianNote,
        },
      });
    });

    // - Calvings
    calvings.forEach((c) => {
      const sexDist = c.calves?.map((calf) => calf.sex).join("/") || "N/A";
      const isLiveBirth = c.outcome === "live_birth" || !c.outcome;
      timeline.push({
        _id: c._id,
        relatedId: c._id,
        type: "Calving",
        title: "Calving Event",
        description: isLiveBirth
          ? `Live birth of ${c.numberOfCalves} calf/calves. Sex distribution: [${sexDist}]. Ease: ${c.calvingEase}.`
          : c.outcome === "stillbirth"
            ? `Stillbirth of ${c.numberOfCalves} calf/calves recorded.`
            : "Pregnancy loss recorded as abortion.",
        date: c.date || c.createdAt,
        status: "Done",
        iconType: "CheckCircle2",
        technicianName: "Field Technician",
        // Extended Details
        details: {
          numberOfCalves: c.numberOfCalves,
          calvingEase: c.calvingEase,
          calves: c.calves,
          technicianNote: c.technicianNote,
        },
      });
    });

    // - Health Records
    healthRequests.forEach((h) => {
      timeline.push({
        _id: h._id,
        relatedId: h._id,
        type: "Health",
        title: `Medical: ${h.requestType?.toUpperCase() || "HEALTH CHECK"}`,
        description: h.diagnosis || "Routine health check performed.",
        date: h.createdAt,
        status: h.status.charAt(0).toUpperCase() + h.status.slice(1),
        iconType: "HeartPulse",
        technicianName: h.technicianName || "Veterinary Officer",
        // Extended Details
        details: {
          requestType: h.requestType,
          diagnosis: h.diagnosis,
          treatment: h.treatment,
          symptoms: h.symptoms,
          technicianNote: h.technicianNote,
        },
      });
    });

    // 3. Sort by Date Descending
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
      animal,
      timeline,
      inseminations: inseminationsWithReadiness,
      pregnancies: pregnanciesWithReadiness,
      calvings,
      healthRequests,
    });
  } catch (error) {
    console.error("[getAnimalHistory ERROR]", error);
    res
      .status(500)
      .json({ message: "Error fetching animal history", error: error.message });
  }
};

export const registerFarmer = async (req, res) => {
  try {
    const { firstName, lastName, phoneNumber, email, address } = req.body;

    // 1. Validation
    if (!firstName || !lastName || !phoneNumber) {
      return res.status(400).json({
        message: "First name, last name, and phone number are required.",
      });
    }

    const resolution = await resolveOrCreateAssistedFarmer({
      email,
      phoneNumber,
      name: `${firstName} ${lastName}`.trim(),
      address: {
        street: address?.street || "",
        barangay: address?.barangay || "Unknown",
        city: address?.city || "Oton",
        province: address?.province || "Iloilo",
      },
      source: "register-farmer",
      invitationMode: email ? "required" : "none",
      inviteExistingUnclaimed: true,
      allowClaimedExisting: false,
      redirectUrl: getFarmerInvitationRedirectUrl(),
      expiresInDays: 1,
      isVerified: false,
    });

    res.status(resolution.reused ? 200 : 201).json({
      message: resolution.invitationResent
        ? "Farmer profile found. Invitation resent successfully."
        : resolution.invitationSent
          ? "Registration successful! Invitation sent to email."
          : "Farmer profile registered successfully.",
      user: resolution.farmer,
      invitationSent: resolution.invitationSent,
      invitationResent: resolution.invitationResent,
      profileReused: resolution.reused,
    });
  } catch (error) {
    console.error("[registerFarmer ERROR]", error);
    res.status(error.status || 500).json({
      message:
        error.message || "An internal error occurred during farmer registration.",
      code: error.code,
    });
  }
};

export const recordPregnancyCheck = async (req, res) => {
  try {
    const {
      animalId,
      result,
      technicianNote,
      inseminationId,
      diagnosisDate,
      taskId,
      methodCode,
      policyVersion,
    } = req.body;
    console.log(
      `[recordPregnancyCheck] Recording result for Animal: ${animalId}, Insem: ${inseminationId}, Result: ${result}, Task: ${taskId || "None"}`,
    );

    if (!animalId || !result || !inseminationId) {
      return res.status(400).json({
        message: "Missing required fields: animalId, result, or inseminationId",
      });
    }

    const confirmation = await confirmPregnancyDiagnosis({
      animalId,
      inseminationId,
      result,
      technicianNote,
      diagnosisDate,
      taskId,
      methodCode,
      policyVersion,
      actor: req.user,
    });
    const { pregnancy, animal, pregnancyReadiness, alreadyRecorded } =
      confirmation;

    if (animal.farmerId && !alreadyRecorded) {
      try {
        const farmer = await User.findById(animal.farmerId);
        await notifyUser({
          recipient: farmer,
          recipientId: animal.farmerId,
          senderId: req.user._id,
          type: "ai-request",
          relatedId: animal._id,
          category: "pregnancy",
          eventType:
            result === "Pregnant"
              ? "pregnancy_confirmed"
              : "pregnancy_not_confirmed",
          linkType: "animal",
          dedupeKey: `pregnancy-result:${pregnancy._id}:${animal.farmerId}`,
          title: "Pregnancy check updated",
          message: `The pregnancy check for ${animal.earTag || animal.animalId} has been recorded.`,
          metadata: {
            animalId: animal._id,
            animalTag: animal.earTag || animal.animalId,
            pregnancyId: pregnancy._id,
            requestId: inseminationId,
            technicianName: req.user.name,
            targetCalvingDate: pregnancy.targetCalvingDate,
          },
        });
      } catch (notifErr) {
        console.error("[recordPregnancyCheck NOTIF ERROR]", notifErr.message);
      }
    }

    // Trigger Inngest if Pregnant
    if (result === "Pregnant" && !alreadyRecorded) {
      try {
        await inngest.send({
          name: "pregnancy/confirmed",
          data: {
            pregnancyId: pregnancy._id,
            animalId,
            farmerId: animal.farmerId,
          },
        });
      } catch (inngestErr) {
        console.error(
          "[recordPregnancyCheck INNGEST ERROR]",
          inngestErr.message,
        );
      }
    }

    res.status(alreadyRecorded ? 200 : 201).json({
      message: alreadyRecorded
        ? "The pregnancy diagnosis was already recorded. The matching task has been completed."
        : "Pregnancy check recorded",
      code: alreadyRecorded ? "PREGNANCY_DIAGNOSIS_RECONCILED" : undefined,
      pregnancy,
      pregnancyReadiness,
      continuationTask: confirmation.continuationTask,
    });
  } catch (error) {
    console.error("[recordPregnancyCheck ERROR]", error);
    const transactionUnavailable =
      /Transaction numbers are only allowed|replica set|mongos/i.test(
        error.message,
      );
    res.status(transactionUnavailable ? 503 : error.status || 500).json({
      message: transactionUnavailable
        ? "This operation requires a transaction-capable database."
        : error.message || "Failed to record pregnancy check",
      code: transactionUnavailable ? "TRANSACTION_UNAVAILABLE" : error.code,
    });
  }
};

export const recordCalving = async (req, res) => {
  try {
    if (req.user?.role !== "technician") {
      return res.status(403).json({
        message: "Calving recording requires a Technician account.",
        code: "CALVING_CLINICAL_ROLE_REQUIRED",
      });
    }

    const {
      pregnancyId,
      animalId,
      date,
      calvingEase,
      outcome: submittedOutcome,
      numberOfCalves,
      calves,
      nonLivingCalves,
      technicianNote,
      taskId,
    } = req.body;

    // 1. Validate Mother & Pregnancy
    const mother = await Animal.findOne({ _id: animalId, deletedAt: null });
    if (!mother)
      return res.status(404).json({ message: "Mother animal not found" });

    const pregnancy = await Pregnancy.findOne({
      _id: pregnancyId,
      deletedAt: null,
    }).populate("inseminationId");
    if (!pregnancy)
      return res.status(404).json({ message: "Pregnancy record not found" });

    const {
      calving,
      offspring: registeredCalves,
      outcome,
      alreadyRecorded,
    } = await persistCalving({
      mother,
      pregnancy,
      calves,
      nonLivingCalves,
      date,
      calvingEase,
      outcome: submittedOutcome,
      numberOfCalves,
      technicianNote,
      actor: req.user,
      taskId,
    });

    // 6. Trigger Inngest & Socket
    if (!alreadyRecorded) {
      try {
        await inngest.send({
          name: "livestock/calving-recorded",
          data: {
            animalId,
            farmerId: mother.farmerId,
            calvingId: calving._id,
            numberOfCalves: registeredCalves.length,
            offspringIds: registeredCalves.map((c) => c._id),
            outcome,
          },
        });
      } catch (inngestErr) {
        console.error("[recordCalving INNGEST ERROR]", inngestErr.message);
      }
    }

    const io = req.app.get("io");
    if (io && !alreadyRecorded) {
      io.emit("dashboardUpdate", {
        type: "CALVING_RECORDED",
        motherId: animalId,
        calvingId: calving._id,
      });
    }

    res.status(alreadyRecorded ? 200 : 201).json({
      message: alreadyRecorded
        ? "This calving was already recorded. The original result has been returned."
        : ["live_birth", "mixed"].includes(outcome)
          ? "Calving and offspring registered successfully"
          : outcome === "stillbirth"
            ? "Stillbirth event recorded successfully"
            : "Pregnancy-loss event recorded successfully",
      code: alreadyRecorded ? "CALVING_ALREADY_RECORDED" : undefined,
      calving,
      offspring: registeredCalves,
    });
  } catch (error) {
    if (error.status && error.status < 500) {
      console.warn(
        `[recordCalving REJECTED] ${error.code || "CALVING_REJECTED"}: ${error.message}`,
      );
    } else {
      console.error("[recordCalving ERROR]", error);
    }
    const transactionUnavailable =
      /Transaction numbers are only allowed|replica set|mongos/i.test(
        error.message,
      );
    res.status(transactionUnavailable ? 503 : error.status || 500).json({
      message: transactionUnavailable
        ? "This operation requires a transaction-capable database."
        : error.message || "Failed to record calving",
      code: transactionUnavailable ? "TRANSACTION_UNAVAILABLE" : error.code,
      ...(error.details || {}),
    });
  }
};

// --- OPTIMIZED GRANULAR DASHBOARD ENDPOINTS ---

export const getDashboardStats = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [totalToday, pendingHealth, totalPreg_90, totalChecks_90] =
      await Promise.all([
        Insemination.countDocuments({
          $or: [
            { scheduledDate: { $gte: todayStart, $lt: todayEnd } },
            { inseminationDate: { $gte: todayStart, $lt: todayEnd } },
          ],
        }),
        HealthRequest.countDocuments({ status: "pending" }),
        Pregnancy.countDocuments({
          createdAt: { $gte: ninetyDaysAgo },
          "pregnancyDiagnosis.result": "Pregnant",
        }),
        Pregnancy.countDocuments({ createdAt: { $gte: ninetyDaysAgo } }),
      ]);

    const successRate =
      totalChecks_90 > 0
        ? Math.min(100, (totalPreg_90 / totalChecks_90) * 100).toFixed(1) + "%"
        : "0%";

    res.status(200).json({ totalToday, pendingHealth, successRate });
  } catch (error) {
    res.status(500).json({ message: "Error fetching stats" });
  }
};

export const getDashboardFeed = async (req, res) => {
  try {
    const hideDeclinedForMe =
      req.user?.role !== "admin" && req.user?._id
        ? { declinedByTechnicianIds: { $ne: req.user._id } }
        : {};

    const [inseminations, healthReqs] = await Promise.all([
      Insemination.find({
        status: { $in: ["pending", "approved", "scheduled", "in-progress"] },
        deletedAt: null,
        ...hideDeclinedForMe,
      })
        .populate("farmerId", "name address farmLocation")
        .populate("animalId", "animalId earTag imageUrl breed species")
        .populate("approvedBy", "name")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      HealthRequest.find({
        status: {
          $in: [
            "pending",
            "triaged",
            "assigned",
            "approved",
            "scheduled",
            "in-progress",
            "in_progress",
          ],
        },
        deletedAt: null,
        ...hideDeclinedForMe,
      })
        .populate("farmerId", "name address farmLocation")
        .populate("animalId", "animalId earTag imageUrl breed species")
        .populate("handledBy", "name")
        .sort({ urgency: -1, createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    const formatAddress = (addr) => {
      if (!addr) return "Unknown";
      if (typeof addr === "string") return addr;
      if (Array.isArray(addr) && addr.length > 0) addr = addr[0];
      return (
        `${addr.barangay || ""}, ${addr.city || ""}`
          .replace(/^,|,$/g, "")
          .trim() || "Unknown"
      );
    };

    const pendingRequests = [
      ...inseminations
        .filter((i) => i.status === "pending")
        .map((i) => ({
          id: i._id,
          type: "ai",
          status: "pending",
          task: `AI Service: ${i.animalId?.breed || "Livestock"}`,
          farmer: i.farmerId?.name,
          location: formatAddress(i.farmerId?.address),
          preferredDate: i.preferredDate || i.createdAt,
          scheduledDate: i.scheduledDate,
          sentTime: new Date(i.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        })),
      ...healthReqs
        .filter((h) => h.status === "pending")
        .map((h) => ({
          id: h._id,
          type: "health",
          status: "pending",
          task: `Health Check: ${h.animalId?.breed || "Livestock"}`,
          farmer: h.farmerId?.name,
          location: formatAddress(h.farmerId?.address),
          preferredDate: h.preferredDate || h.createdAt,
          scheduledDate: h.scheduledDate,
          sentTime: new Date(h.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        })),
    ].sort((a, b) => b.id.getTimestamp() - a.id.getTimestamp());

    const agendaItems = [
      ...inseminations
        .filter((i) => i.status !== "pending")
        .map((i) => ({
          id: i._id,
          type: "ai",
          status: i.status,
          task: `Insemination — ${i.animalId?.animalId || i.animalId?.earTag || "Unknown"}`,
          farmer: i.farmerId?.name,
          location: formatAddress(i.farmerId?.address),
          scheduledDate: i.scheduledDate,
          preferredDate: i.preferredDate,
          time: i.scheduledDate
            ? new Date(i.scheduledDate).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Today",
        })),
      ...healthReqs
        .filter((h) => h.status !== "pending")
        .map((h) => ({
          id: h._id,
          type: "health",
          status: h.status,
          task: `Medical — ${h.animalId?.animalId || h.animalId?.earTag || "Unknown"}`,
          farmer: h.farmerId?.name,
          location: formatAddress(h.farmerId?.address),
          scheduledDate: h.scheduledDate,
          preferredDate: h.preferredDate,
          time: h.scheduledDate
            ? new Date(h.scheduledDate).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Today",
        })),
    ];

    res.status(200).json({ pendingRequests, agendaItems });
  } catch (error) {
    res.status(500).json({ message: "Error fetching feed" });
  }
};

export const walkInLivestock = async (req, res) => {
  try {
    const {
      farmerName,
      earTag,
      species,
      breed,
      color,
      sex,
      gender,
      dob,
      imageUrl,
    } = req.body;

    if (!earTag || !species || !breed) {
      return res.status(400).json({
        message: "Missing required animal details (Tag, Species, Breed).",
      });
    }

    // Handle Image Upload if base64
    let finalImageUrl = imageUrl;
    if (imageUrl && imageUrl.startsWith("data:image")) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(imageUrl, {
          folder: "livestock_profiles",
        });
        finalImageUrl = uploadResponse.secure_url;
      } catch (uploadError) {
        console.error("[walkInLivestock IMAGE UPLOAD ERROR]", uploadError);
        // Continue without image if upload fails
      }
    }

    let farmer;
    if (mongoose.Types.ObjectId.isValid(farmerName)) {
      farmer = await User.findById(farmerName);
    } else {
      farmer = await User.findOne({
        name: { $regex: new RegExp(farmerName, "i") },
        role: "farmer",
      });
    }

    if (!farmer) {
      return res.status(404).json({
        message: "Farmer not found. Please register the farmer first.",
      });
    }

    const existing = await Animal.findOne({ earTag });
    if (existing) {
      return res
        .status(400)
        .json({ message: `An animal with Ear Tag #${earTag} already exists.` });
    }

    const animalId = `ANM-${Date.now().toString().slice(-6)}`;
    const animal = await Animal.create({
      farmerId: farmer._id,
      animalId,
      earTag,
      species,
      breed,
      color,
      gender: gender || sex || "Female",
      birthDate: dob ? new Date(dob) : undefined,
      imageUrl: finalImageUrl,
      barangay: farmer.address?.barangay || "Not Provided",
      isVerified: true,
    });

    await notifyUserBestEffort({
      recipient: farmer,
      senderId: req.user._id,
      type: "system",
      relatedId: animal._id,
      category: "animal",
      eventType: "animal_registered",
      dedupeKey: `animal-registered:${animal._id}:${farmer._id}`,
      linkType: "animal",
      title: "New animal registered",
      message: `A new ${species} (${breed}) with Tag #${earTag} has been added by technician ${req.user.name}.`,
      metadata: {
        animalId: animal._id,
        animalTag: earTag,
        technicianName: req.user.name,
      },
    }, "walkInLivestock");

    req.app.get("io").emit("dashboardUpdate", { type: "LIVESTOCK_REGISTERED" });
    res
      .status(201)
      .json({ message: "Livestock registered successfully", animal });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to register livestock", error: error.message });
  }
};

export const getDashboardRegistry = async (req, res) => {
  try {
    const animalRegistry = await Animal.aggregate([
      { $sort: { createdAt: -1 } },
      { $limit: 100 },
      {
        $lookup: {
          from: "users",
          localField: "farmerId",
          foreignField: "_id",
          as: "farmer",
        },
      },
      { $unwind: { path: "$farmer", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "inseminations",
          let: { animalId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$animalId", "$$animalId"] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: "lastIns",
        },
      },
      { $unwind: { path: "$lastIns", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "pregnancies",
          let: { animalId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$animalId", "$$animalId"] } } },
            {
              $lookup: {
                from: "inseminations",
                localField: "inseminationId",
                foreignField: "_id",
                as: "parentInsem",
              },
            },
            { $match: { "parentInsem.0": { $exists: true } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: "lastPregnancy",
        },
      },
      { $unwind: { path: "$lastPregnancy", preserveNullAndEmptyArrays: true } },
    ]);

    const formatted = animalRegistry.map((animal) => ({
      rawId: animal._id,
      id: `#${animal.earTag || animal.animalId || "N/A"}`,
      breed: animal.breed,
      status:
        animal.lastPregnancy?.pregnancyDiagnosis?.result === "Pregnant"
          ? "Pregnant"
          : animal.lastIns
            ? "Inseminated"
            : "READY",
      lastActionDate: animal.lastActivityDate,
      last: animal.lastIns
        ? `Insemination ${animal.lastIns.sireBreed ? `(${animal.lastIns.sireBreed})` : ""}`
        : "Initial Enrollment",
      farmerName: animal.farmer?.name || "Unknown Owner",
      farmerPhone: animal.farmer?.phoneNumber,
      imageUrl: animal.imageUrl,
      sClass:
        animal.lastPregnancy?.pregnancyDiagnosis?.result === "Pregnant"
          ? "text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full"
          : animal.lastIns
            ? "text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full"
            : "text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full",
      dotClass:
        animal.lastPregnancy?.pregnancyDiagnosis?.result === "Pregnant"
          ? "bg-purple-600"
          : animal.lastIns
            ? "bg-blue-600"
            : "bg-slate-400",
    }));

    res.status(200).json(formatted);
  } catch (error) {
    res.status(500).json({ message: "Error fetching registry" });
  }
};

export const toggleFarmerVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const farmer = await User.findById(id);
    if (!farmer || farmer.role !== "farmer")
      return res.status(404).json({ message: "Farmer not found" });
    farmer.isVerified = !farmer.isVerified;
    await farmer.save();
    res.status(200).json({
      message: `Farmer ${farmer.isVerified ? "Verified" : "Unverified"} successfully`,
      isVerified: farmer.isVerified,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update verification status" });
  }
};

export const getTechnicianAnalytics = async (req, res) => {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalInsem,
      totalPreg,
      totalAI_Week,
      totalHealth_Month,
      speciesData,
      monthlyHealthData,
      monthlyPregnancyData,
      monthlyCalvingData,
      breedData,
      monthlyData,
      barangayData,
    ] = await Promise.all([
      // 1. Overall Success (90 Days)
      Insemination.countDocuments({
        status: "done",
        inseminationDate: { $gte: ninetyDaysAgo },
      }),
      Pregnancy.countDocuments({
        "pregnancyDiagnosis.result": "Pregnant",
        createdAt: { $gte: ninetyDaysAgo },
      }),

      // 2. AI This Week
      Insemination.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),

      // 3. Health This Month
      HealthRequest.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),

      // 4. Species Distribution (AI)
      Insemination.aggregate([
        { $match: { status: "done" } },
        {
          $lookup: {
            from: "animals",
            localField: "animalId",
            foreignField: "_id",
            as: "animal",
          },
        },
        { $unwind: "$animal" },
        { $group: { _id: "$animal.species", count: { $sum: 1 } } },
        { $project: { species: "$_id", count: 1, _id: 0 } },
      ]),

      HealthRequest.aggregate([
        { $match: { createdAt: { $gte: sixMonthsAgo }, deletedAt: null } },
        {
          $group: {
            _id: {
              month: { $month: "$createdAt" },
              year: { $year: "$createdAt" },
            },
            health: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      Pregnancy.aggregate([
        { $match: { createdAt: { $gte: sixMonthsAgo }, deletedAt: null } },
        {
          $group: {
            _id: {
              month: { $month: "$createdAt" },
              year: { $year: "$createdAt" },
            },
            pregnancy: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      Calving.aggregate([
        { $match: { createdAt: { $gte: sixMonthsAgo }, deletedAt: null } },
        {
          $group: {
            _id: {
              month: { $month: "$createdAt" },
              year: { $year: "$createdAt" },
            },
            calving: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      // 3. Top Sire Breeds
      Insemination.aggregate([
        { $match: { status: "done", sireBreed: { $exists: true, $ne: "" } } },
        { $group: { _id: "$sireBreed", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $project: { breed: "$_id", count: 1, _id: 0 } },
      ]),

      // 4. Monthly Activity (Last 6 Months)
      Insemination.aggregate([
        { $match: { createdAt: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: {
              month: { $month: "$createdAt" },
              year: { $year: "$createdAt" },
            },
            ai: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      // 5. Barangay Activity
      User.aggregate([
        {
          $match: {
            role: "farmer",
            "address.barangay": { $exists: true, $ne: "" },
          },
        },
        { $group: { _id: "$address.barangay", farmers: { $sum: 1 } } },
        { $sort: { farmers: -1 } },
        { $limit: 8 },
        { $project: { barangay: "$_id", farmers: 1, _id: 0 } },
      ]),
    ]);

    // Format Monthly Data to be easier for charts
    const monthBuckets = new Map();
    const mergeMonthly = (rows, field) => {
      rows.forEach((row) => {
        const key = `${row._id.year}-${String(row._id.month).padStart(2, "0")}`;
        const existing = monthBuckets.get(key) || {
          key,
          month: new Date(row._id.year, row._id.month - 1).toLocaleString(
            "en-US",
            { month: "short" },
          ),
          ai: 0,
          health: 0,
          pregnancy: 0,
          calving: 0,
        };
        existing[field] = row[field] || 0;
        monthBuckets.set(key, existing);
      });
    };
    mergeMonthly(monthlyData, "ai");
    mergeMonthly(monthlyHealthData, "health");
    mergeMonthly(monthlyPregnancyData, "pregnancy");
    mergeMonthly(monthlyCalvingData, "calving");
    const formattedMonthly = [...monthBuckets.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(({ key: _key, ...row }) => row);

    const successRate =
      totalInsem > 0 ? Math.round((totalPreg / totalInsem) * 100) : 0;

    res.status(200).json({
      successRate,
      totalInsem,
      totalPreg,
      totalAI_Week,
      totalHealth_Month,
      speciesDistribution: speciesData,
      topBreeds: breedData,
      monthlyTrends: formattedMonthly,
      barangayActivity: barangayData,
    });
  } catch (error) {
    console.error("[getTechnicianAnalytics ERROR]", error);
    res.status(500).json({ message: "Failed to load analytics data." });
  }
};

export const deleteAnimal = async (req, res) => {
  try {
    const { id } = req.params;

    const animal = await Animal.findById(id);
    if (!animal) {
      return res.status(404).json({ message: "Animal not found." });
    }

    // Cascading delete of related records
    await Promise.all([
      Insemination.deleteMany({ animalId: id }),
      HealthRequest.deleteMany({ animalId: id }),
      Pregnancy.deleteMany({ animalId: id }),
      Calving.deleteMany({ animalId: id }),
    ]);

    // Cleanup Cloudinary Image
    if (animal.imageUrl && animal.imageUrl.includes("cloudinary.com")) {
      try {
        const parts = animal.imageUrl.split("/");
        const filename = parts[parts.length - 1]; // e.g. "abcd123.jpg"
        const publicIdWithFolder = `livestock_profiles/${filename.split(".")[0]}`;
        await cloudinary.uploader.destroy(publicIdWithFolder);
      } catch (cloudinaryError) {
        console.error("[Cloudinary Cleanup Error]", cloudinaryError);
      }
    }

    await Animal.findByIdAndDelete(id);

    req.app.get("io").emit("dashboardUpdate", { type: "ANIMAL_DELETED", id });

    res.status(200).json({
      message: "Animal and all related records deleted successfully.",
    });
  } catch (error) {
    console.error("[deleteAnimal ERROR]", error);
    res.status(500).json({ message: "Failed to delete animal record." });
  }
};

export const deletePregnancyCheck = async (req, res) => {
  return res.status(405).json({
    message:
      "Official pregnancy records cannot be deleted. Use the correction endpoint with an audit reason.",
    code: "OFFICIAL_RECORD_CORRECTION_REQUIRED",
  });
};

export const recordPregnancyContinuation = async (req, res) => {
  try {
    const result = await recordPregnancyContinuationRecheck({
      pregnancyId: req.params.id,
      result: req.body.result,
      checkedAt: req.body.checkedAt,
      notes: req.body.notes,
      followUpDate: req.body.followUpDate,
      taskId: req.body.taskId,
      actor: req.user,
    });
    res.status(200).json({
      message: "Pregnancy continuation recheck recorded.",
      data: result,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message:
        error.message || "Failed to record pregnancy continuation recheck.",
      code: error.code,
    });
  }
};

export const deleteCalving = async (req, res) => {
  return res.status(405).json({
    message:
      "Official calving records cannot be deleted. Use the correction endpoint with an audit reason.",
    code: "OFFICIAL_RECORD_CORRECTION_REQUIRED",
  });
};

export const correctPregnancyCheck = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await correctPregnancyRecord({
      id,
      changes: req.body?.changes || {},
      reason: req.body?.reason,
      actorId: req.user._id,
    });
    return res.status(200).json({
      message: "Pregnancy record corrected successfully.",
      data: record,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Failed to correct pregnancy record.",
      code: error.code || "PREGNANCY_CORRECTION_FAILED",
    });
  }
};

export const correctCalving = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await correctCalvingRecord({
      id,
      changes: req.body?.changes || {},
      reason: req.body?.reason,
      actorId: req.user._id,
    });
    return res.status(200).json({
      message: "Calving record corrected successfully.",
      data: record,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Failed to correct calving record.",
      code: error.code || "CALVING_CORRECTION_FAILED",
    });
  }
};

export const getFieldNotes = async (req, res) => {
  try {
    const userId = req.user?._id;
    const noteQuery =
      req.user?.role === "admin" ? {} : { technicianId: userId };
    const technicianNotes = await FieldNote.find(noteQuery)
      .populate("technicianId", "name")
      .populate("farmerId", "name phoneNumber address")
      .populate("taskId", "taskType notes dueDate status")
      .populate("animalId", "animalId earTag breed species")
      .sort({ createdAt: -1 })
      .lean();

    const notes = technicianNotes.map((note) => ({
      id: note._id,
      _id: note._id,
      type: "technician-note",
      farmer: note.farmerId?.name || note.farmerName || "General note",
      farmerName: note.farmerId?.name || note.farmerName || "",
      farmerPhone: note.farmerId?.phoneNumber || "",
      taskId: note.taskId || null,
      animalId: note.animalId || null,
      imageUrl: note.imageUrl || "",
      title: note.title,
      description: note.description || "",
      note: [note.title, note.description].filter(Boolean).join(": "),
      date: note.createdAt,
      createdAt: note.createdAt,
      status: "recorded",
      latitude: note.latitude || "",
      longitude: note.longitude || "",
      locationName: note.locationName || "",
      author: note.technicianId?.name || "Technician",
      isArchived: Boolean(note.deletedAt),
    }));

    res.status(200).json(notes);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to load field notes", error: error.message });
  }
};

export const createFieldNote = async (req, res) => {
  try {
    const technicianId = req.user._id;
    const {
      title,
      description,
      imageUrl,
      farmerId: requestedFarmerId,
      taskId: requestedTaskId,
      animalId: requestedAnimalId,
      farmerName,
      latitude,
      longitude,
    } = req.body;

    const normalizedTitle = String(title || "").trim();
    const normalizedDescription = String(description || "").trim();
    if (!normalizedTitle) {
      return res.status(400).json({ message: "Note title is required" });
    }
    if (!normalizedDescription && !imageUrl) {
      return res.status(400).json({
        message: "Add an observation or attach a photo.",
      });
    }

    let linkedTask = null;
    if (requestedTaskId) {
      if (!mongoose.isValidObjectId(requestedTaskId)) {
        return res.status(400).json({ message: "Invalid field-work task." });
      }
      linkedTask = await Task.findOne({
        _id: requestedTaskId,
        technicianId,
        taskType: {
          $in: ["GeneralVisit", "FarmInspection", "Registration", "Other"],
        },
      }).select("_id farmerId animalIds taskType");
      if (!linkedTask) {
        return res.status(404).json({
          message:
            "Field-work task not found. Official service evidence belongs in its service record.",
        });
      }
    }

    const effectiveFarmerId =
      requestedFarmerId || linkedTask?.farmerId?.toString() || "";
    if (
      requestedFarmerId &&
      linkedTask &&
      String(requestedFarmerId) !== String(linkedTask.farmerId)
    ) {
      return res.status(400).json({
        message: "The selected farmer does not match this field-work task.",
      });
    }

    let farmer = null;
    if (effectiveFarmerId) {
      if (!mongoose.isValidObjectId(effectiveFarmerId)) {
        return res.status(400).json({ message: "Invalid farmer selection." });
      }
      farmer = await User.findOne({
        _id: effectiveFarmerId,
        role: "farmer",
        deletedAt: null,
      }).select("_id name");
      if (!farmer) {
        return res.status(404).json({ message: "Farmer not found." });
      }
    }

    let linkedAnimal = null;
    if (requestedAnimalId) {
      if (!mongoose.isValidObjectId(requestedAnimalId)) {
        return res.status(400).json({ message: "Invalid animal selection." });
      }
      if (
        linkedTask &&
        !(linkedTask.animalIds || []).some(
          (animalId) => String(animalId) === String(requestedAnimalId),
        )
      ) {
        return res.status(400).json({
          message: "The selected animal is not part of this field-work task.",
        });
      }
      linkedAnimal = await Animal.findOne({
        _id: requestedAnimalId,
        ...(farmer ? { farmerId: farmer._id } : {}),
        deletedAt: null,
      }).select("_id");
      if (!linkedAnimal) {
        return res.status(404).json({ message: "Animal not found." });
      }
    }

    const normalizeCoordinate = (value, minimum, maximum, label) => {
      if (value === undefined || value === null || value === "") return "";
      const coordinate = Number(value);
      if (
        !Number.isFinite(coordinate) ||
        coordinate < minimum ||
        coordinate > maximum
      ) {
        const error = new Error(`Invalid ${label}.`);
        error.status = 400;
        throw error;
      }
      return coordinate.toFixed(6);
    };

    const normalizedLatitude = normalizeCoordinate(
      latitude,
      -90,
      90,
      "latitude",
    );
    const normalizedLongitude = normalizeCoordinate(
      longitude,
      -180,
      180,
      "longitude",
    );
    if (Boolean(normalizedLatitude) !== Boolean(normalizedLongitude)) {
      return res.status(400).json({
        message: "Latitude and longitude must be saved together.",
      });
    }

    // Handle Image Upload if base64
    let finalImageUrl = imageUrl;
    if (imageUrl && imageUrl.startsWith("data:image")) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(imageUrl, {
          folder: "technician_field_notes",
        });
        finalImageUrl = uploadResponse.secure_url;
      } catch (uploadError) {
        console.error("[createFieldNote IMAGE UPLOAD ERROR]", uploadError);
        return res
          .status(500)
          .json({ message: "Failed to upload photo note image" });
      }
    }

    const fieldNote = await FieldNote.create({
      technicianId,
      farmerId: farmer?._id || null,
      taskId: linkedTask?._id || null,
      animalId: linkedAnimal?._id || null,
      farmerName: farmer?.name || String(farmerName || "").trim(),
      title: normalizedTitle,
      description: normalizedDescription,
      imageUrl: finalImageUrl || "",
      latitude: normalizedLatitude,
      longitude: normalizedLongitude,
      locationName: "",
    });

    req.app.get("io").emit("dashboardUpdate", {
      type: "FIELD_NOTE_CREATED",
      message: `Technician ${req.user.name} added a field note: ${normalizedTitle}`,
    });

    res
      .status(201)
      .json({ message: "Field note saved successfully", fieldNote });
  } catch (error) {
    console.error("[createFieldNote ERROR]", error);
    res.status(error.status || 500).json({
      message:
        error.status === 400 ? error.message : "Failed to save field note",
      error: error.message,
    });
  }
};

export const getTechnicianFieldNotes = async (req, res) => {
  try {
    const technicianId = req.user._id;
    const technicianNotes = await FieldNote.find({
      technicianId,
      deletedAt: null,
    })
      .populate("technicianId", "name")
      .populate("farmerId", "name phoneNumber address")
      .populate("taskId", "taskType notes dueDate status")
      .populate("animalId", "animalId earTag breed species")
      .sort({ createdAt: -1 })
      .lean();

    const notes = technicianNotes.map((note) => ({
      ...note,
      _id: note._id,
      id: note._id,
      type: "technician-note",
      farmerName: note.farmerId?.name || note.farmerName || "",
      farmer: note.farmerId?.name || note.farmerName || "General note",
      farmerPhone: note.farmerId?.phoneNumber || "",
      taskId: note.taskId || null,
      animalId: note.animalId || null,
      imageUrl: note.imageUrl || "",
      description: note.description || "",
      latitude: note.latitude || "",
      longitude: note.longitude || "",
      locationName: note.locationName || "",
      author: note.technicianId?.name || "Technician",
      status: "recorded",
      isArchived: false,
    }));

    res.status(200).json(notes);
  } catch (error) {
    res.status(500).json({
      message: "Failed to load your field notes",
      error: error.message,
    });
  }
};

export const deleteFieldNote = async (req, res) => {
  try {
    const { id } = req.params;
    const fieldNote = await FieldNote.findOneAndUpdate(
      {
        _id: id,
        technicianId: req.user._id,
        deletedAt: null,
      },
      { $set: { deletedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!fieldNote) {
      return res
        .status(404)
        .json({ message: "Field note not found or unauthorized" });
    }

    res.status(200).json({ message: "Field note archived successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete field note", error: error.message });
  }
};

export const deleteFieldNoteRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent, restore } = req.query;
    const isPermanent = permanent === "true";
    const ownerFilter =
      req.user.role === "admin"
        ? { _id: id }
        : { _id: id, technicianId: req.user._id };

    let fieldNote;
    if (restore === "true") {
      fieldNote = await FieldNote.findOneAndUpdate(
        ownerFilter,
        { $set: { deletedAt: null } },
        { returnDocument: "after" },
      );
    } else if (isPermanent) {
      fieldNote = await FieldNote.findOneAndDelete(ownerFilter);
    } else {
      fieldNote = await FieldNote.findOneAndUpdate(
        ownerFilter,
        { $set: { deletedAt: new Date() } },
        { returnDocument: "after" },
      );
    }

    if (!fieldNote) {
      return res
        .status(404)
        .json({ message: "Field note not found or unauthorized" });
    }

    const action =
      restore === "true"
        ? "restored"
        : isPermanent
          ? "permanently deleted"
          : "archived";
    res.status(200).json({ message: `Field note ${action} successfully` });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete field note record",
      error: error.message,
    });
  }
};

export const markCalvingAsSeen = async (req, res) => {
  try {
    const { id } = req.params;
    const calving = await Calving.findByIdAndUpdate(
      id,
      { $set: { isSeen: true } },
      { returnDocument: "after" },
    );
    if (!calving) {
      return res.status(404).json({ message: "Calving record not found" });
    }
    res.status(200).json({ message: "Calving record marked as seen", calving });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error marking calving as seen", error: error.message });
  }
};

export const declineTechnicianRequest = async (req, res) => {
  try {
    const { type, id } = req.params;
    const note = req.body?.technicianNote || "Skipped by technician.";

    if (req.user?.role !== "technician") {
      return res.status(403).json({
        message: "Only Technicians can skip available requests.",
        code: "TECHNICIAN_SKIP_FORBIDDEN",
      });
    }

    if (!["ai", "health"].includes(type)) {
      return res.status(400).json({ message: "Invalid request type." });
    }

    const Model = type === "ai" ? Insemination : HealthRequest;
    const request = await Model.findOne({ _id: id, deletedAt: null });

    if (!request) {
      return res.status(404).json({ message: "Request not found." });
    }

    assertTechnicianEligibleForNewRequest({
      technician: req.user,
      requestType: type === "ai" ? "AI" : "HEALTH",
      dispatch: request.dispatch,
    });

    const unassignedFilter =
      type === "ai"
        ? { approvedBy: null, technicianId: null }
        : { handledBy: null, assignedTechnicianId: null };

    const updated = await Model.findOneAndUpdate(
      {
        _id: id,
        deletedAt: null,
        status: "pending",
        declinedByTechnicianIds: { $ne: req.user._id },
        ...unassignedFilter,
      },
      {
        $addToSet: { declinedByTechnicianIds: req.user._id },
        $push: {
          statusHistory: {
            status: "skipped_by_technician",
            note,
            actorId: req.user._id,
            createdAt: new Date(),
          },
        },
      },
      { returnDocument: "after" },
    );

    if (!updated) {
      const alreadySkipped = request.declinedByTechnicianIds?.some(
        (technicianId) =>
          technicianId?.toString() === req.user._id.toString(),
      );
      return res.status(409).json({
        message: alreadySkipped
          ? "You already skipped this request."
          : "This request is no longer pending and unassigned. Refresh your available requests.",
        code: alreadySkipped
          ? "REQUEST_ALREADY_SKIPPED"
          : "REQUEST_SKIP_CONCURRENT_UPDATE",
      });
    }

    res.status(200).json({
      message:
        "Request skipped. It remains available to other eligible technicians.",
      data: updated,
    });
  } catch (error) {
    console.error("[declineTechnicianRequest ERROR]", error);
    res.status(error.status || 500).json({
      message: error.message || "Failed to skip request for this technician.",
      code: error.code,
    });
  }
};

export const claimRequest = async (req, res) => {
  try {
    const { type, id } = req.params;

    if (req.user.role === "farmer") {
      return res
        .status(403)
        .json({ message: "Farmers cannot claim technician requests." });
    }

    if (!["ai", "health", "breeding_verification"].includes(type)) {
      return res.status(400).json({ message: "Invalid request type." });
    }

    let updated = null;

    if (type === "ai") {
      if (req.user.role !== "technician") {
        return res.status(403).json({
          message: "Only technicians can claim AI requests.",
          code: "AI_REQUEST_CLAIM_FORBIDDEN",
        });
      }

      const existing = await Insemination.findById(id);
      if (!existing) {
        return res
          .status(404)
          .json({ message: "AI request record not found." });
      }
      if (existing.status !== "pending") {
        return res.status(409).json({
          message: `This request is already ${existing.status} and cannot be claimed.`,
          code: "REQUEST_NOT_CLAIMABLE",
        });
      }
      if (
        existing.approvedBy &&
        existing.approvedBy.toString() !== req.user._id.toString()
      ) {
        return res.status(409).json({
          message:
            "This request has already been claimed by another technician.",
          code: "REQUEST_ALREADY_CLAIMED",
        });
      }
      assertTechnicianEligibleForNewRequest({
        technician: req.user,
        requestType: "AI",
        dispatch: existing.dispatch,
      });

      updated = await Insemination.findOneAndUpdate(
        {
          _id: id,
          deletedAt: null,
          status: "pending",
          ...buildAIRequestAssignmentGuard({
            technicianId: req.user._id,
            allowPendingUnassigned: true,
          }),
        },
        {
          $set: {
            approvedBy: req.user._id,
            claimedAt: new Date(),
            status: "approved",
            activeRequestKey: activeRequestKeyForAnimal(existing.animalId),
          },
        },
        { returnDocument: "after" },
      )
        .populate("farmerId", "name address imageUrl phoneNumber")
        .populate("animalId", "animalId earTag species breed imageUrl");
    } else if (type === "health") {
      if (req.user.role !== "technician") {
        return res.status(403).json({
          message: "Only technicians can claim Health requests.",
          code: "HEALTH_REQUEST_CLAIM_FORBIDDEN",
        });
      }
      const existing = await HealthRequest.findById(id);
      if (!existing) {
        return res
          .status(404)
          .json({ message: "Health request record not found." });
      }
      if (existing.handledBy) {
        return res.status(409).json({
          message:
            "This request has already been claimed by another technician.",
          code: "REQUEST_ALREADY_CLAIMED",
        });
      }
      if (existing.status !== "pending") {
        return res.status(409).json({
          message: `This request is already ${existing.status} and cannot be claimed.`,
          code: "REQUEST_NOT_CLAIMABLE",
        });
      }
      assertTechnicianEligibleForNewRequest({
        technician: req.user,
        requestType: "HEALTH",
        dispatch: existing.dispatch,
      });

      updated = await HealthRequest.findOneAndUpdate(
        {
          _id: id,
          deletedAt: null,
          status: "pending",
          $and: [
            {
              $or: [
                { handledBy: null },
                { handledBy: { $exists: false } },
              ],
            },
            {
              $or: [
                { assignedTechnicianId: null },
                { assignedTechnicianId: { $exists: false } },
              ],
            },
          ],
        },
        {
          $set: {
            handledBy: req.user._id,
            assignedTechnicianId: req.user._id,
            claimedAt: new Date(),
            status: "approved",
            activeCaseKey: activeHealthCaseKey(
              existing.animalId,
              existing.requestType,
            ),
          },
        },
        { returnDocument: "after" },
      )
        .populate("farmerId", "name address imageUrl phoneNumber")
        .populate("animalId", "animalId earTag species breed imageUrl");
    } else if (type === "breeding_verification") {
      if (req.user.role !== "technician") {
        return res.status(403).json({
          message: "Only Technicians can claim pregnancy diagnosis work.",
          code: "PREGNANCY_TASK_CLAIM_FORBIDDEN",
        });
      }

      const existing = await Task.findById(id);
      if (!existing) {
        return res.status(404).json({ message: "Task not found." });
      }
      const supportedSources = new Set([
        "farmer_requested_verification",
        "automatic_pd_followup",
      ]);
      const supportedStages = new Set(Object.values(PREGNANCY_TASK_STAGE));
      const workflowStage =
        existing.metadata?.workflowStage ||
        PREGNANCY_TASK_STAGE.INITIAL_CONFIRMATION;
      if (
        existing.taskType !== "PD" ||
        existing.status !== "Pending" ||
        !supportedSources.has(existing.sourceType) ||
        !supportedStages.has(workflowStage)
      ) {
        return res.status(409).json({
          message: "This pregnancy task is not claimable through this workflow.",
          code: "PREGNANCY_TASK_NOT_CLAIMABLE",
        });
      }

      if (existing.technicianId) {
        return res.status(409).json({
          message:
            "This request has already been claimed by another technician.",
          code: "REQUEST_ALREADY_CLAIMED",
        });
      }

      updated = await Task.findOneAndUpdate(
        {
          _id: id,
          taskType: "PD",
          technicianId: { $in: [null, undefined] },
          status: "Pending",
          sourceType: {
            $in: [
              "farmer_requested_verification",
              "automatic_pd_followup",
            ],
          },
          $or: [
            { "metadata.workflowStage": { $in: Object.values(PREGNANCY_TASK_STAGE) } },
            { "metadata.workflowStage": { $exists: false } },
          ],
        },
        {
          $set: {
            technicianId: req.user._id,
            claimedAt: new Date(),
          },
        },
        { returnDocument: "after" },
      )
        .populate("farmerId", "name address imageUrl phoneNumber")
        .populate("animalIds", "animalId earTag species breed imageUrl");
    }

    if (!updated) {
      return res.status(409).json({
        message: "This request has already been claimed by another technician.",
        code: "REQUEST_ALREADY_CLAIMED",
      });
    }

    const io = req.app.get("io");
    if (io) {
      io.to("role:technician").emit("dashboardUpdate", {
        type: "REQUEST_CLAIMED",
        requestType: type,
        requestId: id,
        technicianId: req.user._id,
      });
    }

    return res.status(200).json({
      message: "Request claimed successfully.",
      data: updated,
    });
  } catch (error) {
    console.error("[claimRequest ERROR]", error);
    return res.status(error.status || 500).json({
      message: error.message || "Failed to claim request.",
      code: error.code,
      ...(error.details || {}),
    });
  }
};

export const getTechnicianRequests = async (req, res) => {
  try {
    let {
      type,
      status,
      urgency,
      assignment,
      search,
      page,
      limit,
      includeUpcoming,
      nearLat,
      nearLng,
      sortBy,
      municipality,
      barangay,
      includeOperationalTasks,
      includeCounts,
      requestId,
      assignedTechnicianId,
    } = req.query;
    page = Math.max(Number.parseInt(page, 10) || 1, 1);
    limit = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const now = new Date();
    const PHT_OFFSET = 8 * 60 * 60 * 1000;
    const todayStart = new Date(now.getTime() + PHT_OFFSET);
    todayStart.setUTCHours(0, 0, 0, 0);
    todayStart.setTime(todayStart.getTime() - PHT_OFFSET);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const aiQuery = { deletedAt: null };
    const healthQuery = { deletedAt: null };
    const taskQuery = { taskType: "PD" };
    const taskAndFilters = [];
    const technician = req.user.role === "technician" ? req.user : null;
    const aiDispatch = technician
      ? buildNewRequestDispatchFilter({ technician, requestType: "AI" })
      : null;
    const healthDispatch = technician
      ? buildNewRequestDispatchFilter({ technician, requestType: "HEALTH" })
      : null;

    if (requestId) {
      if (!mongoose.Types.ObjectId.isValid(requestId)) {
        return res.status(400).json({
          message: "The requested service reference is invalid.",
        });
      }
      aiQuery._id = requestId;
      healthQuery._id = requestId;
      taskQuery._id = requestId;
    }

    // Apply municipality/barangay filters if provided
    if (municipality || barangay) {
      const addressQuery = {};
      if (municipality) {
        addressQuery["address.city"] = {
          $regex: new RegExp(`^${municipality}$`, "i"),
        };
      }
      if (barangay) {
        addressQuery["address.barangay"] = {
          $regex: new RegExp(`^${barangay}$`, "i"),
        };
      }
      const matchingFarmers = await User.find({
        role: "farmer",
        ...addressQuery,
      }).select("_id");
      const matchingFarmerIds = matchingFarmers.map((f) => f._id);

      aiQuery.farmerId = { $in: matchingFarmerIds };
      healthQuery.farmerId = { $in: matchingFarmerIds };
      taskAndFilters.push({ farmerId: { $in: matchingFarmerIds } });
    }

    if (includeUpcoming !== "true") {
      taskAndFilters.push({
        $or: [
          // Manual or farmer-requested: show immediately
          { sourceType: { $in: ["manual", "farmer_requested_verification"] } },
          // Automatic follow-ups: only show when dueDate has arrived
          { sourceType: "automatic_pd_followup", dueDate: { $lte: now } },
          // Legacy tasks (no sourceType): show immediately
          { sourceType: { $exists: false } },
        ],
      });
    }

    // 1. Assignment & Visibility Filter
    if (assignment === "mine") {
      aiQuery.$or = [
        { approvedBy: req.user._id },
        { technicianId: req.user._id },
      ];
      healthQuery.$or = [
        { handledBy: req.user._id },
        { assignedTechnicianId: req.user._id },
      ];
      taskQuery.technicianId = req.user._id;
    } else if (assignment === "unassigned" || assignment === "available") {
      aiQuery.approvedBy = null;
      aiQuery.technicianId = null;
      healthQuery.handledBy = null;
      healthQuery.assignedTechnicianId = null;
      taskQuery.technicianId = { $in: [null, undefined] };
      if (req.user.role !== "admin") {
        aiQuery.declinedByTechnicianIds = { $ne: req.user._id };
        healthQuery.declinedByTechnicianIds = { $ne: req.user._id };
        appendMongoCondition(aiQuery, aiDispatch?.filter);
        appendMongoCondition(healthQuery, healthDispatch?.filter);
      }
      aiQuery.status = {
        $in: ["pending", "approved", "unassigned", "triaged"],
      };
      healthQuery.status = {
        $in: ["pending", "triaged", "assigned", "approved", "unassigned"],
      };
      taskQuery.status = { $in: ["Pending", "unassigned"] };
    } else if (assignment === "all") {
      if (req.user.role !== "admin") {
        appendMongoCondition(aiQuery, {
          $or: [
            { approvedBy: req.user._id },
            { technicianId: req.user._id },
            {
              $and: [
                { approvedBy: null },
                { technicianId: null },
                { declinedByTechnicianIds: { $ne: req.user._id } },
                aiDispatch.filter,
              ],
            },
          ],
        });
        appendMongoCondition(healthQuery, {
          $or: [
            { handledBy: req.user._id },
            { assignedTechnicianId: req.user._id },
            {
              $and: [
                { handledBy: null },
                { assignedTechnicianId: null },
                { declinedByTechnicianIds: { $ne: req.user._id } },
                healthDispatch.filter,
              ],
            },
          ],
        });
      }
    } else {
      appendMongoCondition(aiQuery, {
        $or: [
          { approvedBy: req.user._id },
          { technicianId: req.user._id },
          ...(req.user.role === "admin"
            ? [{ approvedBy: null, technicianId: null }]
            : [
                {
                  $and: [
                    { approvedBy: null },
                    { technicianId: null },
                    { declinedByTechnicianIds: { $ne: req.user._id } },
                    aiDispatch.filter,
                  ],
                },
              ]),
        ],
      });
      appendMongoCondition(healthQuery, {
        $or: [
          { handledBy: req.user._id },
          { assignedTechnicianId: req.user._id },
          ...(req.user.role === "admin"
            ? [{ handledBy: null, assignedTechnicianId: null }]
            : [
                {
                  $and: [
                    { handledBy: null },
                    { assignedTechnicianId: null },
                    { declinedByTechnicianIds: { $ne: req.user._id } },
                    healthDispatch.filter,
                  ],
                },
              ]),
        ],
      });
      taskQuery.technicianId = { $in: [req.user._id, null, undefined] };
    }

    if (assignedTechnicianId) {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          message: "Only Admin can filter requests by assigned Technician.",
        });
      }
      if (!mongoose.Types.ObjectId.isValid(assignedTechnicianId)) {
        return res.status(400).json({
          message: "The selected Technician reference is invalid.",
        });
      }

      appendMongoCondition(aiQuery, {
        $or: [
          { approvedBy: assignedTechnicianId },
          { technicianId: assignedTechnicianId },
        ],
      });
      appendMongoCondition(healthQuery, {
        $or: [
          { handledBy: assignedTechnicianId },
          { assignedTechnicianId },
        ],
      });
      taskQuery.technicianId = assignedTechnicianId;
    }

    // 2. Urgency Filter
    if (urgency === "urgent") {
      healthQuery.urgency = { $in: ["high", "emergency"] };
      taskQuery.priority = 1;
    }

    // 3. Status Filter Mapping
    if (status && status !== "all") {
      if (status === "pending") {
        aiQuery.status = "pending";
        healthQuery.status = { $in: ["pending", "triaged", "assigned"] };
        taskQuery.status = "Pending";
      } else if (status === "approved") {
        aiQuery.status = "approved";
        healthQuery.status = { $in: ["assigned", "approved"] };
        taskQuery.status = "Pending";
      } else if (status === "scheduled") {
        aiQuery.status = { $in: ["approved", "scheduled"] };
        healthQuery.status = { $in: ["approved", "scheduled"] };
        taskQuery.status = "In Progress";
      } else if (status === "in_progress") {
        aiQuery.status = "in-progress";
        healthQuery.status = { $in: ["in-progress", "in_progress"] };
        taskQuery.status = "In Progress";
      } else if (status === "completed") {
        aiQuery.status = "done";
        healthQuery.status = "resolved";
        taskQuery.status = "Completed";
      } else if (status === "declined") {
        aiQuery.status = "rejected";
        healthQuery.status = { $in: ["rejected", "cancelled"] };
        taskQuery.status = "Cancelled";
      } else if (status === "active") {
        aiQuery.status = {
          $in: ["pending", "approved", "scheduled", "in-progress"],
        };
        healthQuery.status = {
          $in: [
            "pending",
            "triaged",
            "assigned",
            "approved",
            "scheduled",
            "in-progress",
            "in_progress",
          ],
        };
        taskQuery.status = { $in: ["Pending", "In Progress"] };
      } else if (status === "history") {
        aiQuery.status = { $in: ["done", "rejected", "cancelled"] };
        healthQuery.status = { $in: ["resolved", "rejected", "cancelled"] };
        taskQuery.status = { $in: ["Completed", "Cancelled"] };
      }
    }

    // 4. Search Filter
    if (search) {
      const farmers = await User.find({
        name: { $regex: search, $options: "i" },
        role: "farmer",
      }).select("_id");
      const farmerIds = farmers.map((f) => f._id);

      const animals = await Animal.find({
        $or: [
          { earTag: { $regex: search, $options: "i" } },
          { animalId: { $regex: search, $options: "i" } },
        ],
      }).select("_id");
      const animalIds = animals.map((a) => a._id);

      const aiSearchFilter = {
        $or: [
          { farmerId: { $in: farmerIds } },
          { animalId: { $in: animalIds } },
        ],
      };
      const healthSearchFilter = {
        $or: [
          { farmerId: { $in: farmerIds } },
          { animalId: { $in: animalIds } },
        ],
      };

      if (aiQuery.$or) {
        aiQuery.$and = [
          ...(aiQuery.$and || []),
          { $or: aiQuery.$or },
          aiSearchFilter,
        ];
        delete aiQuery.$or;
      } else {
        aiQuery.$or = aiSearchFilter.$or;
      }

      if (healthQuery.$or) {
        healthQuery.$and = [
          ...(healthQuery.$and || []),
          { $or: healthQuery.$or },
          healthSearchFilter,
        ];
        delete healthQuery.$or;
      } else {
        healthQuery.$or = healthSearchFilter.$or;
      }
      taskAndFilters.push({
        $or: [
          { farmerId: { $in: farmerIds } },
          { animalIds: { $in: animalIds } },
        ],
      });
    }

    if (taskAndFilters.length > 0) {
      taskQuery.$and = taskAndFilters;
    }

    // 5. Fetch Records
    const fetchAI = type === "all" || type === "ai" || !type;
    const fetchHealth = type === "all" || type === "health" || !type;
    const fetchPregnancyChecks =
      includeOperationalTasks !== "false" &&
      (type === "all" || type === "breeding_verification" || !type);
    const sortByVal = sortBy || "newest";
    const boundedMerge = sortByVal !== "distance";
    const candidateLimit = skip + limit;
    const requestDateDirection = sortByVal === "oldest" ? 1 : -1;
    const aiDatePartitions =
      sortByVal === "preferredDate"
        ? effectiveDatePartitions(["preferredDate", "createdAt"], 1)
        : effectiveDatePartitions(["createdAt"], requestDateDirection);
    const healthUrgencyPartitions = [
      { filter: { urgency: { $in: ["high", "emergency"] } } },
      { filter: { urgency: { $nin: ["high", "emergency"] } } },
    ];
    const taskUrgencyPartitions = [
      {
        filter: {
          $or: [
            { priority: 1 },
            { category: { $in: ["Urgent", "Emergency"] } },
          ],
        },
      },
      {
        filter: {
          $nor: [
            { priority: 1 },
            { category: { $in: ["Urgent", "Emergency"] } },
          ],
        },
      },
    ];
    const healthDatePartitions =
      sortByVal === "preferredDate"
        ? effectiveDatePartitions(["preferredDate", "createdAt"], 1)
        : effectiveDatePartitions(["createdAt"], requestDateDirection);
    const taskDatePartitions =
      sortByVal === "preferredDate"
        ? effectiveDatePartitions(["dueDate", "createdAt"], 1)
        : effectiveDatePartitions(["createdAt"], requestDateDirection);

    const populateAIRequest = (query) =>
      query
        .populate(
          "farmerId",
          "name address imageUrl avatarUrl profilePicture avatar phoneNumber farmLocation",
        )
        .populate("animalId", "animalId earTag species breed imageUrl")
        .populate("approvedBy", "name")
        .populate({
          path: "previousAttemptId",
          select:
            "attemptNumber inseminationDate outcome failureReason farmerOutcomeReport isSuccess status outcomeVerificationStatus outcomeConfirmationSource outcomeConfirmedAt approvedBy technicianId",
          populate: { path: "approvedBy technicianId", select: "name" },
        });
    const populateHealthRequest = (query) =>
      query
        .populate(
          "farmerId",
          "name address imageUrl avatarUrl profilePicture avatar phoneNumber farmLocation",
        )
        .populate("animalId", "animalId earTag species breed imageUrl")
        .populate("handledBy", "name");
    const populatePregnancyTask = (query) =>
      query
        .populate(
          "farmerId",
          "name address imageUrl avatarUrl profilePicture avatar phoneNumber farmLocation",
        )
        .populate("animalIds", "animalId earTag species breed imageUrl")
        .populate("technicianId", "name");

    const [
      aiRecords,
      healthRecords,
      pregnancyCheckTasks,
      aiTotal,
      healthTotal,
      pregnancyTotal,
    ] = await Promise.all([
      fetchAI
        ? boundedMerge
          ? fetchBoundedPartitions({
              Model: Insemination,
              baseFilter: aiQuery,
              partitions: aiDatePartitions,
              windowLimit: candidateLimit,
              populate: populateAIRequest,
            })
          : populateAIRequest(Insemination.find(aiQuery)).lean()
        : [],
      fetchHealth
        ? boundedMerge
          ? fetchBoundedPartitions({
              Model: HealthRequest,
              baseFilter: healthQuery,
              partitions: crossPartitions(
                healthUrgencyPartitions,
                healthDatePartitions,
              ),
              windowLimit: candidateLimit,
              populate: populateHealthRequest,
            })
          : populateHealthRequest(HealthRequest.find(healthQuery)).lean()
        : [],
      fetchPregnancyChecks
        ? boundedMerge
          ? fetchBoundedPartitions({
              Model: Task,
              baseFilter: taskQuery,
              partitions: crossPartitions(
                taskUrgencyPartitions,
                taskDatePartitions,
              ),
              windowLimit: candidateLimit,
              populate: populatePregnancyTask,
            })
          : populatePregnancyTask(Task.find(taskQuery)).lean()
        : [],
      fetchAI ? Insemination.countDocuments(aiQuery) : 0,
      fetchHealth ? HealthRequest.countDocuments(healthQuery) : 0,
      fetchPregnancyChecks ? Task.countDocuments(taskQuery) : 0,
    ]);

    const linkedObservationIds = pregnancyCheckTasks
      .filter((task) => task.sourceType === "farmer_requested_verification")
      .map((task) => task.metadata?.inseminationId)
      .filter(Boolean);
    const linkedObservations = linkedObservationIds.length
      ? await Insemination.find({ _id: { $in: linkedObservationIds } })
          .select(
            "farmerOutcomeReport farmerOutcomeReportedAt farmerObservationSigns farmerObservationNotes evidencePhotos verificationRequested verificationStatus",
          )
          .lean()
      : [];
    const observationByInseminationId = new Map(
      linkedObservations.map((observation) => [
        String(observation._id),
        observation,
      ]),
    );

    const formatAddress = (addr) => {
      if (!addr) return "Unknown Location";
      if (typeof addr === "string") return addr;
      if (Array.isArray(addr) && addr.length > 0) {
        const first = addr[0];
        return (
          `${first.barangay || ""}, ${first.city || ""}`
            .replace(/^,|,$/g, "")
            .trim() || "Unknown Location"
        );
      }
      if (typeof addr === "object") {
        return (
          `${addr.barangay || ""}, ${addr.city || ""}`
            .replace(/^,|,$/g, "")
            .trim() || "Unknown Location"
        );
      }
      return "Unknown Location";
    };

    // Helper to check if a date is today
    const isDateToday = (d) => {
      if (!d) return false;
      const dateVal = new Date(d);
      return dateVal >= todayStart && dateVal < todayEnd;
    };

    const getHaversineDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371; // Radius of the Earth in km
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
          Math.cos(lat2 * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c; // Distance in km
    };

    const techLat = nearLat ? parseFloat(nearLat) : null;
    const techLng = nearLng ? parseFloat(nearLng) : null;

    // Normalize AI Inseminations
    const normalizedAI = aiRecords.map((rec) => {
      const isReady =
        (rec.status === "scheduled" || rec.status === "approved") &&
        rec.scheduledDate &&
        isDateToday(rec.scheduledDate) &&
        rec.approvedBy &&
        rec.approvedBy._id?.toString() === req.user._id.toString();

      const farmer = rec.farmerId || {};
      const farmLoc = farmer.farmLocation || {};
      const addr = farmer.address || {};
      const hasFarmPin = !!(farmLoc.latitude && farmLoc.longitude);
      const city = addr.city || "";
      const barangay = addr.barangay || "";
      const assignedTechnicianId =
        rec.approvedBy?._id || rec.approvedBy || rec.technicianId || null;
      const isUnassigned = !assignedTechnicianId;
      const previousAttempt =
        rec.previousAttemptId && typeof rec.previousAttemptId === "object"
          ? rec.previousAttemptId
          : null;
      const previousAttemptContext = previousAttempt
        ? {
            _id: previousAttempt._id,
            attemptNumber: previousAttempt.attemptNumber,
            inseminationDate: previousAttempt.inseminationDate,
            outcome: previousAttempt.outcome,
            failureReason: previousAttempt.failureReason,
            outcomeVerificationStatus:
              previousAttempt.outcomeVerificationStatus,
            outcomeConfirmationSource:
              previousAttempt.outcomeConfirmationSource,
            outcomeConfirmedAt: previousAttempt.outcomeConfirmedAt,
          }
        : null;
      const requestKind = previousAttempt ? "re_insemination" : "initial_ai";
      const previousAttemptVerified = previousAttempt
        ? isVerifiedReturnToHeatAIAttempt(previousAttempt)
        : false;

      const safeFarmerPhone = isUnassigned ? null : farmer.phoneNumber || "";
      const safeFarmerPhoneAlt = isUnassigned ? null : farmer.phone || null;
      const safeFarmerImageUrl = isUnassigned ? "" : farmer.imageUrl || "";
      const safeLocation = isUnassigned ? null : formatAddress(farmer.address);

      let allowedAction = null;
      let actionLabel = null;
      if (rec.status === "pending" && isUnassigned) {
        allowedAction = "CLAIM_AND_SCHEDULE";
        actionLabel = "Accept & Set Visit";
      } else if (rec.status === "approved") {
        allowedAction = "SCHEDULE_VISIT";
        actionLabel = "Schedule Visit";
      } else if (["scheduled", "in-progress"].includes(rec.status)) {
        allowedAction = "RECORD_SERVICE";
        actionLabel = "Record Insemination";
      } else if (rec.status === "done") {
        allowedAction = "VIEW_RECORD";
        actionLabel = "View Record";
      }

      const attachmentUrls = [
        ...new Set([
          ...getAIRequestPhotos(rec),
          ...(Array.isArray(rec.evidencePhotos) ? rec.evidencePhotos : []),
        ]),
      ].filter(Boolean);

      let distanceKm = null;
      if (
        techLat !== null &&
        !isNaN(techLat) &&
        techLng !== null &&
        !isNaN(techLng) &&
        hasFarmPin
      ) {
        distanceKm = parseFloat(
          getHaversineDistance(
            techLat,
            techLng,
            farmLoc.latitude,
            farmLoc.longitude,
          ).toFixed(2),
        );
      }

      if (isUnassigned) {
        return {
          id: rec._id,
          workflowId: rec._id,
          workflowType: "AI",
          type: "ai",
          serviceType: "Artificial Insemination",
          requestKind,
          attemptNumber: rec.attemptNumber || 1,
          previousAttemptId: previousAttemptContext,
          previousAttemptOutcome: previousAttempt?.outcome || null,
          previousAttemptVerified,
          status: rec.status,
          allowedAction,
          actionLabel,
          farmer: farmer.name || "Unknown Farmer",
          isReadyToday: !!isReady,
          displayStatus: isReady
            ? "Ready Today"
            : rec.status === "approved"
              ? "Assigned"
              : rec.status,
          urgency: "normal",
          animal: rec.animalId?.animalId || rec.animalId?.earTag || "Unknown",
          earTag: rec.animalId?.earTag || "",
          breed: rec.animalId?.breed || "",
          species: rec.animalId?.species || "",
          municipality: city,
          barangay: barangay,
          preferredDate: rec.preferredDate || rec.createdAt,
          scheduledDate: rec.scheduledDate || null,
          visitPeriod: rec.visitPeriod,
          heatSigns: Array.isArray(rec.heatSigns) ? rec.heatSigns : [],
          requestSubmissionDate: rec.createdAt,
          attachments: {
            primaryUrl: attachmentUrls[0] || null,
            urls: attachmentUrls,
            count: attachmentUrls.length,
          },
          createdAt: rec.createdAt,
        };
      }

      return {
        id: rec._id,
        workflowId: rec._id,
        taskId: null,
        workflowType: "AI",
        type: "ai",
        serviceType: "Artificial Insemination",
        requestKind,
        attemptNumber: rec.attemptNumber || 1,
        previousAttemptId: previousAttemptContext,
        previousAttemptOutcome: previousAttempt?.outcome || null,
        previousAttemptVerified,
        status: rec.status,
        allowedAction,
        actionLabel,
        isReadyToday: !!isReady,
        displayStatus: isReady
          ? "Ready Today"
          : rec.status === "approved"
            ? "Assigned"
            : rec.status,
        urgency: "normal",
        farmer: farmer.name || "Unknown Farmer",
        farmerId: farmer._id || farmer,
        farmerImageUrl: farmer.imageUrl || farmer.avatarUrl || farmer.profilePicture || farmer.avatar || "",
        farmerPhone: farmer.phoneNumber || "",
        phone: farmer.phone || null,
        farmerDetails: {
          id: farmer._id || null,
          name: farmer.name || "Unknown Farmer",
          phone: farmer.phoneNumber || "",
          location: formatAddress(farmer.address),
        },
        animal: rec.animalId?.animalId || rec.animalId?.earTag || "Unknown",
        animalId: rec.animalId?._id || rec.animalId,
        earTag: rec.animalId?.earTag || "",
        breed: rec.animalId?.breed || "",
        species: rec.animalId?.species || "",
        location: formatAddress(farmer.address),
        locationLabel:
          barangay && city
            ? `${barangay}, ${city}`
            : formatAddress(farmer.address) || "Unknown Location",
        municipality: city,
        barangay: barangay,
        hasFarmPin,
        distanceKm,
        farmPinStatus: hasFarmPin ? "available" : "missing",
        preferredDate: rec.preferredDate || rec.createdAt,
        scheduledDate: rec.scheduledDate || null,
        visitPeriod: rec.visitPeriod,
        schedule: {
          date: rec.scheduledDate || null,
          visitPeriod: rec.visitPeriod || null,
        },
        heatSigns: Array.isArray(rec.heatSigns) ? rec.heatSigns : [],
        requestSubmissionDate: rec.createdAt,
        attachments: {
          primaryUrl: attachmentUrls[0] || null,
          urls: attachmentUrls,
          count: attachmentUrls.length,
        },
        assignedTechnician: rec.approvedBy?.name || "",
        createdAt: rec.createdAt,
        raw: rec,
      };
    });

    // Normalize Health Requests
    const normalizedHealth = healthRecords.map((rec) => {
      const isReady =
        (rec.status === "scheduled" || rec.status === "approved") &&
        rec.scheduledDate &&
        isDateToday(rec.scheduledDate) &&
        rec.handledBy &&
        rec.handledBy._id?.toString() === req.user._id.toString();

      const farmer = rec.farmerId || {};
      const farmLoc = farmer.farmLocation || {};
      const addr = farmer.address || {};
      const hasFarmPin = !!(farmLoc.latitude && farmLoc.longitude);
      const city = addr.city || "";
      const barangay = addr.barangay || "";

      const assignedTechnicianId = rec.handledBy?._id || rec.handledBy || null;
      const isUnassigned = !assignedTechnicianId;

      const safeFarmerPhone = isUnassigned ? null : farmer.phoneNumber || "";
      const safeFarmerPhoneAlt = isUnassigned ? null : farmer.phone || null;
      const safeFarmerImageUrl = isUnassigned ? "" : farmer.imageUrl || "";
      const safeLocation = isUnassigned ? null : formatAddress(farmer.address);
      const attachmentUrls = getHealthRequestAttachmentUrls(rec);

      let distanceKm = null;
      if (
        techLat !== null &&
        !isNaN(techLat) &&
        techLng !== null &&
        !isNaN(techLng) &&
        hasFarmPin
      ) {
        distanceKm = parseFloat(
          getHaversineDistance(
            techLat,
            techLng,
            farmLoc.latitude,
            farmLoc.longitude,
          ).toFixed(2),
        );
      }

      if (isUnassigned) {
        return {
          id: rec._id,
          type: "health",
          serviceType: rec.requestType || "health",
          requestType: rec.requestType || "health",
          status: rec.status,
          farmer: farmer.name || "Unknown Farmer",
          farmerImageUrl: farmer.imageUrl || farmer.avatarUrl || farmer.profilePicture || farmer.avatar || "",
          isReadyToday: !!isReady,
          displayStatus: isReady
            ? "Ready Today"
            : rec.status === "approved"
              ? "Assigned"
              : rec.status,
          urgency:
            rec.urgency === "high" || rec.urgency === "emergency"
              ? "urgent"
              : "normal",
          animal: rec.animalId?.animalId || rec.animalId?.earTag || "Unknown",
          earTag: rec.animalId?.earTag || "",
          breed: rec.animalId?.breed || "",
          species: rec.animalId?.species || "",
          municipality: city,
          barangay: barangay,
          preferredDate: rec.preferredDate || rec.createdAt,
          scheduledDate: rec.scheduledDate || null,
          attachments: {
            primaryUrl: attachmentUrls[0] || null,
            urls: attachmentUrls,
            count: attachmentUrls.length,
          },
          createdAt: rec.createdAt,
        };
      }

      return {
        id: rec._id,
        type: "health",
        serviceType: rec.requestType || "health",
        requestType: rec.requestType || "health",
        status: rec.status,
        isReadyToday: !!isReady,
        displayStatus: isReady
          ? "Ready Today"
          : rec.status === "approved"
            ? "Assigned"
            : rec.status,
        urgency:
          rec.urgency === "high" || rec.urgency === "emergency"
            ? "urgent"
            : "normal",
        farmer: farmer.name || "Unknown Farmer",
        farmerId: farmer._id || farmer,
        farmerImageUrl: farmer.imageUrl || farmer.avatarUrl || farmer.profilePicture || farmer.avatar || "",
        farmerPhone: farmer.phoneNumber || "",
        animal: rec.animalId?.animalId || rec.animalId?.earTag || "Unknown",
        animalId: rec.animalId?._id || rec.animalId,
        earTag: rec.animalId?.earTag || "",
        breed: rec.animalId?.breed || "",
        species: rec.animalId?.species || "",
        location: formatAddress(farmer.address),
        locationLabel:
          barangay && city
            ? `${barangay}, ${city}`
            : formatAddress(farmer.address) || "Unknown Location",
        municipality: city,
        barangay: barangay,
        hasFarmPin,
        distanceKm,
        farmPinStatus: hasFarmPin ? "available" : "missing",
        preferredDate: rec.preferredDate || rec.createdAt,
        scheduledDate: rec.scheduledDate || null,
        attachments: {
          primaryUrl: attachmentUrls[0] || null,
          urls: attachmentUrls,
          count: attachmentUrls.length,
        },
        assignedTechnician: rec.handledBy?.name || "",
        createdAt: rec.createdAt,
        raw: rec,
      };
    });

    // Normalize Pregnancy Checks
    const normalizedPregnancyChecks = pregnancyCheckTasks.map((task) => {
      const animal = Array.isArray(task.animalIds) ? task.animalIds[0] : null;
      const linkedObservation = task.metadata?.inseminationId
        ? observationByInseminationId.get(String(task.metadata.inseminationId))
        : null;

      const farmer = task.farmerId || {};
      const farmLoc = farmer.farmLocation || {};
      const addr = farmer.address || {};
      const hasFarmPin = !!(farmLoc.latitude && farmLoc.longitude);
      const city = addr.city || "";
      const barangay = addr.barangay || "";

      let distanceKm = null;
      if (
        techLat !== null &&
        !isNaN(techLat) &&
        techLng !== null &&
        !isNaN(techLng) &&
        hasFarmPin
      ) {
        distanceKm = parseFloat(
          getHaversineDistance(
            techLat,
            techLng,
            farmLoc.latitude,
            farmLoc.longitude,
          ).toFixed(2),
        );
      }

      return {
        id: task._id,
        type: "breeding_verification",
        serviceType: "Pregnancy Check",
        status: task.status,
        isReadyToday: false,
        displayStatus: task.status,
        urgency:
          task.priority === 1 || task.category === "Urgent"
            ? "urgent"
            : "normal",
        farmer: farmer.name || "Unknown Farmer",
        farmerId: farmer._id || farmer,
        farmerImageUrl: farmer.imageUrl || farmer.avatarUrl || farmer.profilePicture || farmer.avatar || "",
        farmerPhone: farmer.phoneNumber || "",
        animal: animal?.animalId || animal?.earTag || "Unknown",
        animalId: animal?._id || animal,
        earTag: animal?.earTag || "",
        breed: animal?.breed || "",
        species: animal?.species || "",
        location: formatAddress(farmer.address),
        locationLabel:
          barangay && city
            ? `${barangay}, ${city}`
            : formatAddress(farmer.address) || "Unknown Location",
        municipality: city,
        barangay: barangay,
        hasFarmPin,
        distanceKm,
        farmPinStatus: hasFarmPin ? "available" : "missing",
        preferredDate: task.dueDate || task.createdAt,
        scheduledDate: task.dueDate || null,
        assignedTechnician: task.technicianId?.name || "",
        createdAt: task.createdAt,
        farmerObservation: linkedObservation
          ? {
              reportType: linkedObservation.farmerOutcomeReport || null,
              reportedAt: linkedObservation.farmerOutcomeReportedAt || null,
              signs: Array.isArray(linkedObservation.farmerObservationSigns)
                ? linkedObservation.farmerObservationSigns
                : [],
              notes: linkedObservation.farmerObservationNotes || "",
              evidencePhotos: Array.isArray(linkedObservation.evidencePhotos)
                ? linkedObservation.evidencePhotos.filter(Boolean)
                : [],
              verificationRequested: Boolean(
                linkedObservation.verificationRequested,
              ),
              verificationStatus:
                linkedObservation.verificationStatus || "not_requested",
            }
          : task.sourceType === "farmer_requested_verification"
            ? {
                reportType: task.metadata?.reportType || null,
                reportedAt: null,
                signs: [],
                notes: "",
                evidencePhotos: [],
                verificationRequested: true,
                verificationStatus: "pending",
              }
            : null,
        raw: task,
      };
    });

    // Combine & Sort
    const combined = [
      ...normalizedAI,
      ...normalizedHealth,
      ...normalizedPregnancyChecks,
    ].sort((a, b) => {
      // 1. Emergency/Urgent priority first:
      const aUrgent = a.urgency === "urgent";
      const bUrgent = b.urgency === "urgent";
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;

      // 2. Sort by sortBy parameter:
      if (sortByVal === "distance" && techLat !== null && techLng !== null) {
        const aHasDist = a.distanceKm !== null;
        const bHasDist = b.distanceKm !== null;
        if (aHasDist && !bHasDist) return -1;
        if (!aHasDist && bHasDist) return 1;
        if (aHasDist && bHasDist) {
          return a.distanceKm - b.distanceKm;
        }
      } else if (sortByVal === "preferredDate") {
        return (
          new Date(a.preferredDate).getTime() -
          new Date(b.preferredDate).getTime()
        );
      } else if (sortByVal === "oldest") {
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }

      // Fallback: newest first
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Apply pagination slice
    const total = aiTotal + healthTotal + pregnancyTotal;
    const paginated = combined.slice(skip, skip + limit);

    let counts;
    if (includeCounts === "true") {
      const unassignedAIQuery = {
        deletedAt: null,
        approvedBy: null,
        technicianId: null,
        status: { $in: ["pending", "approved", "unassigned", "triaged"] },
        ...(req.user.role !== "admin"
          ? { declinedByTechnicianIds: { $ne: req.user._id } }
          : {}),
      };
      const unassignedHealthQuery = {
        deletedAt: null,
        handledBy: null,
        assignedTechnicianId: null,
        status: {
          $in: ["pending", "triaged", "assigned", "approved", "unassigned"],
        },
        ...(req.user.role !== "admin"
          ? { declinedByTechnicianIds: { $ne: req.user._id } }
          : {}),
      };
      if (req.user.role !== "admin") {
        appendMongoCondition(unassignedAIQuery, aiDispatch?.filter);
        appendMongoCondition(unassignedHealthQuery, healthDispatch?.filter);
      }
      const unassignedPregnancyQuery = {
        taskType: "PD",
        technicianId: { $in: [null, undefined] },
        status: { $in: ["Pending", "unassigned"] },
        ...(includeUpcoming === "true"
          ? {}
          : {
              $or: [
                {
                  sourceType: {
                    $in: ["manual", "farmer_requested_verification"],
                  },
                },
                {
                  sourceType: "automatic_pd_followup",
                  dueDate: { $lte: now },
                },
                { sourceType: { $exists: false } },
              ],
            }),
      };
      const [aiCount, healthCount, pregnancyCount] = await Promise.all([
        Insemination.countDocuments(unassignedAIQuery),
        HealthRequest.countDocuments(unassignedHealthQuery),
        Task.countDocuments(unassignedPregnancyQuery),
      ]);
      counts = {
        all: aiCount + healthCount + pregnancyCount,
        ai: aiCount,
        health: healthCount,
        pregnancy: pregnancyCount,
      };
    }

    res.status(200).json({
      requests: paginated,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      ...(counts ? { counts } : {}),
    });
  } catch (error) {
    console.error("[getTechnicianRequests ERROR]", error);
    res.status(500).json({
      message: "Failed to fetch technician requests",
      error: error.message,
    });
  }
};

export const getWorkQueue = async (req, res) => {
  try {
    const isAdmin = req.user?.role === "admin";
    const authenticatedUserId = req.user?._id;
    const {
      workState = "active",
      type = "all",
      search = "",
    } = req.query || {};
    const page = Math.max(Number.parseInt(req.query?.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(Number.parseInt(req.query?.limit, 10) || 20, 1),
      50,
    );
    const skip = (page - 1) * limit;
    const candidateLimit = skip + limit;
    if (!["active", "completed"].includes(workState)) {
      return res.status(400).json({ message: "Invalid work state." });
    }
    const supportedTypes = new Set([
      "all",
      "ai",
      "health",
      "pregnancy",
      "calving",
    ]);
    if (!supportedTypes.has(type)) {
      return res.status(400).json({ message: "Invalid work type." });
    }
    const now = new Date();
    const PHT_OFFSET = 8 * 60 * 60 * 1000;
    const todayStart = new Date(now.getTime() + PHT_OFFSET);
    todayStart.setUTCHours(0, 0, 0, 0);
    todayStart.setTime(todayStart.getTime() - PHT_OFFSET);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const aiStateQuery =
      workState === "completed"
        ? buildCompletedAIWorkFilter({
            technicianId: isAdmin ? null : authenticatedUserId,
          })
        : buildActiveAIWorkFilter({
            technicianId: isAdmin ? null : authenticatedUserId,
          });

    const healthStateQuery =
      workState === "completed"
        ? buildCompletedHealthWorkFilter({
            technicianId: isAdmin ? null : authenticatedUserId,
          })
        : buildActiveHealthWorkFilter({
            technicianId: isAdmin ? null : authenticatedUserId,
          });

    const standaloneTaskQuery =
      workState === "completed"
        ? buildCompletedStandaloneTaskFilter({
            technicianId: isAdmin ? null : authenticatedUserId,
          })
        : buildActiveStandaloneTaskFilter({
            technicianId: isAdmin ? null : authenticatedUserId,
            now,
          });

    const searchText = String(search || "").trim();
    let farmerIds = [];
    let animalIds = [];
    if (searchText) {
      const [farmers, animals] = await Promise.all([
        User.find({
          role: "farmer",
          name: { $regex: searchText, $options: "i" },
        })
          .select("_id")
          .lean(),
        Animal.find({
          $or: [
            { earTag: { $regex: searchText, $options: "i" } },
            { animalId: { $regex: searchText, $options: "i" } },
          ],
        })
          .select("_id")
          .lean(),
      ]);
      farmerIds = farmers.map((item) => item._id);
      animalIds = animals.map((item) => item._id);
    }

    const aiTitleMatches = /artificial insemination|insemination|ai service/i.test(
      searchText,
    );
    const healthTitleMatches = /health|health check|health assistance/i.test(
      searchText,
    );
    const aiQuery = searchText && !aiTitleMatches
      ? combineMongoFilters(aiStateQuery, {
          $or: [
            { farmerId: { $in: farmerIds } },
            { animalId: { $in: animalIds } },
          ],
        })
      : aiStateQuery;
    const healthQuery = searchText && !healthTitleMatches
      ? combineMongoFilters(healthStateQuery, {
          $or: [
            { farmerId: { $in: farmerIds } },
            { animalId: { $in: animalIds } },
          ],
        })
      : healthStateQuery;
    const taskQuery = searchText
      ? combineMongoFilters(standaloneTaskQuery, {
          $or: [
            { farmerId: { $in: farmerIds } },
            { animalIds: { $in: animalIds } },
            { taskType: { $regex: searchText, $options: "i" } },
          ],
        })
      : standaloneTaskQuery;

    const includeAI = type === "all" || type === "ai";
    const includeHealth = type === "all" || type === "health";
    const includeTasks = ["all", "pregnancy", "calving"].includes(type);
    const typedTaskQuery =
      type === "pregnancy"
        ? combineMongoFilters(taskQuery, {
            taskType: { $in: ["PD", "BreedingFollowUp"] },
          })
        : type === "calving"
          ? combineMongoFilters(taskQuery, {
              taskType: { $in: ["CD", "Calving"] },
            })
          : taskQuery;
    const aiPartitions = workQueueDatePartitions(
      workState === "completed"
        ? ["completedAt", "inseminationDate", "createdAt"]
        : ["scheduledDate", "createdAt"],
      workState,
      todayStart,
    );
    const healthPartitions = workQueueDatePartitions(
      workState === "completed"
        ? ["resolvedAt", "createdAt"]
        : ["scheduledDate", "createdAt"],
      workState,
      todayStart,
    );
    const taskPartitions = workQueueDatePartitions(
      workState === "completed"
        ? ["completedAt", "createdAt"]
        : ["dueDate", "createdAt"],
      workState,
      todayStart,
    );
    const populateAIWork = (query) =>
      query
        .populate(
          "farmerId",
          "name phoneNumber phone address farmLocation imageUrl avatarUrl profilePicture avatar",
        )
        .populate("animalId", "name animalId earTag imageUrl breed species gender")
        .populate(
          "previousAttemptId",
          "attemptNumber outcome isSuccess outcomeVerificationStatus reviewedBy status",
        );
    const populateHealthWork = (query) =>
      query
        .populate(
          "farmerId",
          "name phoneNumber phone address farmLocation imageUrl avatarUrl profilePicture avatar",
        )
        .populate("animalId", "name animalId earTag imageUrl breed species gender");
    const populateTaskWork = (query) =>
      query
        .populate(
          "farmerId",
          "name phoneNumber phone address farmLocation imageUrl avatarUrl profilePicture avatar",
        )
        .populate(
          "animalIds",
          "name animalId earTag imageUrl breed species gender farmerId",
        );

    const [inseminations, healthReqs, standaloneTasks] = await Promise.all([
      includeAI
        ? fetchBoundedPartitions({
            Model: Insemination,
            baseFilter: aiQuery,
            partitions: aiPartitions,
            windowLimit: candidateLimit,
            populate: populateAIWork,
          })
        : [],
      includeHealth
        ? fetchBoundedPartitions({
            Model: HealthRequest,
            baseFilter: healthQuery,
            partitions: healthPartitions,
            windowLimit: candidateLimit,
            populate: populateHealthWork,
          })
        : [],
      includeTasks
        ? fetchBoundedPartitions({
            Model: Task,
            baseFilter: typedTaskQuery,
            partitions: taskPartitions,
            windowLimit: candidateLimit,
            populate: populateTaskWork,
          })
        : [],
    ]);

    const workflowIds = [
      ...inseminations.map((item) => item._id),
      ...healthReqs.map((item) => item._id),
    ];
    const executionTaskStatusFilter =
      workState === "completed"
        ? "Completed"
        : { $in: ["Pending", "In Progress"] };
    const executionTasks = workflowIds.length
      ? await Task.find({
          status: executionTaskStatusFilter,
          ...(isAdmin
            ? {}
            : {
                $or: [
                  { technicianId: authenticatedUserId },
                  { technicianId: null },
                  { technicianId: { $exists: false } },
                ],
              }),
          $and: [
            {
              $or: [
                { relatedRecordId: { $in: workflowIds } },
                { requestId: { $in: workflowIds } },
                { sourceId: { $in: workflowIds } },
                { inseminationId: { $in: workflowIds } },
                { "metadata.relatedRecordId": { $in: workflowIds } },
                { "metadata.requestId": { $in: workflowIds } },
                { "metadata.sourceId": { $in: workflowIds } },
                { "metadata.inseminationId": { $in: workflowIds } },
                { "metadata.healthRequestId": { $in: workflowIds } },
              ],
            },
          ],
        }).lean()
      : [];
    // Linked execution Tasks provide request/task identifiers for AI and
    // Health cards. They are not independent Work Queue items. Appending them
    // here previously allowed an active reproductive Task linked to a
    // completed AI request to leak into workState=completed.
    const scheduledTasks = standaloneTasks;
    const pregnancyCountQuery = combineMongoFilters(standaloneTaskQuery, {
      taskType: { $in: ["PD", "BreedingFollowUp"] },
    });
    const calvingCountQuery = combineMongoFilters(standaloneTaskQuery, {
      taskType: { $in: ["CD", "Calving"] },
    });
    // Execute each Mongoose Query once and retain its native Promise. Some
    // selected totals intentionally share an all-type count; sharing the Query
    // object itself would cause Mongoose to execute the same Query twice.
    const allAICountPromise = Insemination.countDocuments(aiStateQuery).exec();
    const allHealthCountPromise = HealthRequest.countDocuments(
      healthStateQuery,
    ).exec();
    const allTaskCountPromise = Task.countDocuments(standaloneTaskQuery).exec();
    const pregnancyCountPromise = Task.countDocuments(
      pregnancyCountQuery,
    ).exec();
    const calvingCountPromise = Task.countDocuments(calvingCountQuery).exec();
    const selectedAICountPromise = includeAI
      ? aiQuery === aiStateQuery
        ? allAICountPromise
        : Insemination.countDocuments(aiQuery).exec()
      : 0;
    const selectedHealthCountPromise = includeHealth
      ? healthQuery === healthStateQuery
        ? allHealthCountPromise
        : HealthRequest.countDocuments(healthQuery).exec()
      : 0;
    const selectedTaskCountPromise = includeTasks
      ? typedTaskQuery === standaloneTaskQuery
        ? allTaskCountPromise
        : Task.countDocuments(typedTaskQuery).exec()
      : 0;
    const [
      allAICount,
      allHealthCount,
      allTaskCount,
      pregnancyCount,
      calvingCount,
      selectedAITotal,
      selectedHealthTotal,
      selectedTaskTotal,
    ] = await Promise.all([
      allAICountPromise,
      allHealthCountPromise,
      allTaskCountPromise,
      pregnancyCountPromise,
      calvingCountPromise,
      selectedAICountPromise,
      selectedHealthCountPromise,
      selectedTaskCountPromise,
    ]);
    const workCounts = {
      all: allAICount + allHealthCount + allTaskCount,
      ai: allAICount,
      health: allHealthCount,
      pregnancy: pregnancyCount,
      calving: calvingCount,
    };
    const selectedTotal =
      selectedAITotal + selectedHealthTotal + selectedTaskTotal;

    const idOf = (value) => {
      let current = value;
      const seen = new Set();

      // Limit traversal in case a malformed object contains a deep or cyclic ID.
      for (let depth = 0; depth < 5; depth += 1) {
        if (current == null) return null;

        if (typeof current === "string") {
          return current;
        }

        if (typeof current === "number" || typeof current === "bigint") {
          return String(current);
        }

        // Handle real MongoDB/Mongoose ObjectIds before accessing `_id`.
        if (typeof current?.toHexString === "function") {
          try {
            return current.toHexString();
          } catch {
            return null;
          }
        }

        if (typeof current !== "object") {
          return null;
        }

        if (seen.has(current)) {
          return null;
        }

        seen.add(current);

        const nestedId = current._id ?? current.id;

        if (nestedId == null || nestedId === current) {
          return null;
        }

        current = nestedId;
      }

      return null;
    };

    const uniqueMongoIds = (values) => [
      ...new Set(
        values
          .map(idOf)
          .filter((value) => value && mongoose.isValidObjectId(value)),
      ),
    ];
    const hasPresentationFields = (value, fields) =>
      value &&
      typeof value === "object" &&
      fields.some((field) => value[field] !== undefined);
    const taskRelationshipRefs = scheduledTasks.map((taskDoc) => {
      const metadata = taskDoc.metadata || {};
      const relatedRecordType = String(
        taskDoc.relatedRecordType || "",
      ).toLowerCase();
      return {
        taskDoc,
        directAnimalRef:
          (Array.isArray(taskDoc.animalIds) && taskDoc.animalIds[0]) ||
          taskDoc.animalId ||
          metadata.animalId ||
          null,
        directFarmerRef: taskDoc.farmerId || metadata.farmerId || null,
        pregnancyId: idOf(
          taskDoc.pregnancyId ||
            metadata.pregnancyId ||
            (relatedRecordType === "pregnancy"
              ? taskDoc.relatedRecordId
              : null),
        ),
        calvingId: idOf(
          taskDoc.calvingId ||
            metadata.calvingId ||
            (relatedRecordType === "calving"
              ? taskDoc.relatedRecordId
              : null),
        ),
        inseminationId: idOf(
          taskDoc.inseminationId ||
            metadata.inseminationId ||
            (relatedRecordType === "insemination"
              ? taskDoc.relatedRecordId
              : null),
        ),
      };
    });
    const pregnancyIds = uniqueMongoIds(
      taskRelationshipRefs.map((relationship) => relationship.pregnancyId),
    );
    const calvingIds = uniqueMongoIds(
      taskRelationshipRefs.map((relationship) => relationship.calvingId),
    );
    const inseminationIds = uniqueMongoIds(
      taskRelationshipRefs.map((relationship) => relationship.inseminationId),
    );
    const [linkedPregnancies, linkedCalvings, linkedInseminations] =
      await Promise.all([
        pregnancyIds.length
          ? Pregnancy.find({ _id: { $in: pregnancyIds } })
              .select(
                "_id animalId farmerId inseminationId pregnancyDiagnosis confirmation completedAt",
              )
              .lean()
          : [],
        calvingIds.length
          ? Calving.find({ _id: { $in: calvingIds } })
              .select(
                "_id animalId farmerId pregnancyId inseminationId date",
              )
              .lean()
          : [],
        inseminationIds.length
          ? Insemination.find({ _id: { $in: inseminationIds } })
              .select(
                "_id animalId farmerId outcomeConfirmedAt inseminationDate completedAt",
              )
              .lean()
          : [],
      ]);
    const pregnancyById = new Map(
      linkedPregnancies.map((record) => [idOf(record), record]),
    );
    const calvingById = new Map(
      linkedCalvings.map((record) => [idOf(record), record]),
    );
    const inseminationById = new Map(
      linkedInseminations.map((record) => [idOf(record), record]),
    );
    const taskRelationshipSources = taskRelationshipRefs.map((relationship) => {
      const pregnancy = pregnancyById.get(relationship.pregnancyId) || null;
      const calving = calvingById.get(relationship.calvingId) || null;
      const insemination =
        inseminationById.get(relationship.inseminationId) || null;
      return {
        ...relationship,
        pregnancy,
        calving,
        insemination,
        animalRef:
          relationship.directAnimalRef ||
          pregnancy?.animalId ||
          calving?.animalId ||
          insemination?.animalId ||
          null,
        farmerRef:
          relationship.directFarmerRef ||
          pregnancy?.farmerId ||
          calving?.farmerId ||
          insemination?.farmerId ||
          null,
      };
    });
    const taskAnimalIds = uniqueMongoIds(
      taskRelationshipSources.map((relationship) => relationship.animalRef),
    );
    const taskAnimals = taskAnimalIds.length
      ? await Animal.find({ _id: { $in: taskAnimalIds } })
          .select(
            "_id farmerId name animalId earTag imageUrl breed species gender",
          )
          .lean()
      : [];
    const animalById = new Map(
      taskAnimals.map((record) => [idOf(record), record]),
    );
    const taskFarmerIds = uniqueMongoIds(
      taskRelationshipSources.map((relationship) => {
        const animal = animalById.get(idOf(relationship.animalRef));
        return relationship.farmerRef || animal?.farmerId || null;
      }),
    );
    const taskFarmers = taskFarmerIds.length
      ? await User.find({ _id: { $in: taskFarmerIds } })
          .select(
            "_id name phoneNumber phone address farmLocation imageUrl avatarUrl profilePicture avatar",
          )
          .lean()
      : [];
    const farmerById = new Map(
      taskFarmers.map((record) => [idOf(record), record]),
    );
    const taskContextById = new Map(
      taskRelationshipSources.map((relationship) => {
        const fetchedAnimal = animalById.get(idOf(relationship.animalRef));
        const animal =
          fetchedAnimal ||
          (hasPresentationFields(relationship.animalRef, [
            "name",
            "animalId",
            "earTag",
          ])
            ? relationship.animalRef
            : null);
        const farmerRef =
          relationship.farmerRef || animal?.farmerId || null;
        const fetchedFarmer = farmerById.get(idOf(farmerRef));
        const farmer =
          fetchedFarmer ||
          (hasPresentationFields(farmerRef, ["name", "address", "farmLocation"])
            ? farmerRef
            : null);
        return [
          idOf(relationship.taskDoc),
          {
            animal,
            farmer,
            pregnancy: relationship.pregnancy,
            calving: relationship.calving,
            insemination: relationship.insemination,
          },
        ];
      }),
    );
    const terminalHealthRequestIds = healthReqs
      .filter(
        (request) =>
          ["resolved", "done"].includes(request.status) &&
          !["advice", "office_pickup"].includes(request.handlingMethod),
      )
      .map((request) => request._id);
    const healthMedicalRecords = terminalHealthRequestIds.length
      ? await MedicalRecord.find({
          healthRequestId: { $in: terminalHealthRequestIds },
        })
          .select("_id healthRequestId date")
          .lean()
      : [];
    const medicalRecordByHealthRequest = new Map(
      healthMedicalRecords.map((record) => [
        idOf(record.healthRequestId),
        record,
      ]),
    );
    const cleanAddressPart = (value) => {
      const normalized = String(value || "").trim();
      return normalized &&
        !["n/a", "na", "none", "null", "undefined"].includes(
          normalized.toLowerCase(),
        )
        ? normalized
        : "";
    };

    const formatAddress = (addr) => {
      if (!addr) return "Unknown Location";
      if (typeof addr === "string") return addr;
      if (Array.isArray(addr) && addr.length > 0) {
        const first = addr[0];
        return (
          [first.barangay, first.city || first.municipality]
            .map(cleanAddressPart)
            .filter(Boolean)
            .join(", ") || "Unknown Location"
        );
      }
      if (typeof addr === "object") {
        return (
          [addr.barangay, addr.city || addr.municipality]
            .map(cleanAddressPart)
            .filter(Boolean)
            .join(", ") || "Unknown Location"
        );
      }
      return "Unknown Location";
    };

    const formatTime = (date) => {
      if (!date) return "Not Set";
      return new Date(date).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Manila",
      });
    };

    const getFarmLocationDetails = (farmer) => {
      const farmLocation = farmer?.farmLocation || null;
      const hasCoordinates =
        Number.isFinite(farmLocation?.latitude) &&
        Number.isFinite(farmLocation?.longitude);
      const label =
        farmLocation?.detectedAddress?.trim() ||
        farmLocation?.landmark?.trim() ||
        (hasCoordinates ? "Farm pin saved" : formatAddress(farmer?.address));
      return {
        farmLocation,
        farmLocationLabel: label,
        hasFarmPin: hasCoordinates,
        navigationTarget: hasCoordinates
          ? `${farmLocation.latitude},${farmLocation.longitude}`
          : null,
      };
    };

    const serializeFarmer = (farmer) => ({
      id: idOf(farmer),
      name: farmer?.name || "Unknown Farmer",
      phone: farmer?.phoneNumber || farmer?.phone || null,
      location: formatAddress(farmer?.address),
      imageUrl: farmer?.imageUrl || farmer?.avatarUrl || farmer?.profilePicture || farmer?.avatar || null,
    });

    const serializeAnimal = (animal) => ({
      id: idOf(animal),
      name: animal?.name || animal?.animalId || animal?.earTag || "Unknown",
      earTag: animal?.earTag || animal?.animalId || null,
      species: animal?.species || null,
      breed: animal?.breed || null,
      sex: animal?.gender || null,
    });

    const taskLinkIds = (taskDoc) => {
      const metadata = taskDoc?.metadata || {};
      return new Set(
        [
          taskDoc?.relatedRecordId,
          taskDoc?.requestId,
          taskDoc?.sourceId,
          taskDoc?.inseminationId,
          metadata.relatedRecordId,
          metadata.requestId,
          metadata.sourceId,
          metadata.inseminationId,
          metadata.healthRequestId,
        ]
          .map(idOf)
          .filter(Boolean),
      );
    };

    const isExecutionTaskForWorkflow = (taskDoc, workflowType, workflowId) => {
      if (!workflowId || !taskLinkIds(taskDoc).has(workflowId)) return false;

      const taskType = String(taskDoc?.taskType || "").toUpperCase();
      const relatedRecordType = String(
        taskDoc?.relatedRecordType || "",
      ).toLowerCase();

      // PD and Calving are distinct downstream activities even when they carry
      // an insemination id for lineage.
      if (["PD", "CD", "CALVING", "BREEDINGFOLLOWUP"].includes(taskType))
        return false;

      if (workflowType === "AI") {
        return taskType === "AI" || relatedRecordType === "insemination";
      }

      if (workflowType === "Health") {
        return (
          relatedRecordType === "health" ||
          ["HEALTH", "TREATMENT", "VACCINATION", "DEWORMING"].includes(taskType)
        );
      }

      return false;
    };

    const findExecutionTask = (workflowType, workflowId) =>
      executionTasks.find((taskDoc) => {
        const taskTechnicianId = idOf(taskDoc.technicianId);
        const taskIsVisible =
          isAdmin ||
          !taskTechnicianId ||
          taskTechnicianId === idOf(authenticatedUserId);
        return (
          taskIsVisible &&
          isExecutionTaskForWorkflow(taskDoc, workflowType, workflowId)
        );
      }) || null;

    const isToday = (date) => {
      if (!date) return false;
      const value = new Date(date);
      return value >= todayStart && value < todayEnd;
    };

    const isOverdue = (date, terminal) => {
      if (!date || terminal) return false;
      const value = new Date(date);
      return !Number.isNaN(value.getTime()) && value < todayStart;
    };

    const unifiedQueue = [];
    const workflowOwnedTaskIds = new Set();

    inseminations.forEach((ins) => {
      const workflowId = idOf(ins);
      if (!workflowId) return;
      const canonicalStatus = normalizeAIStatus(ins.status);
      const presentedInsemination = { ...ins, status: canonicalStatus };

      const assignedTechnicianId = idOf(ins.approvedBy);
      if (canonicalStatus === AI_STATUS.PENDING && !assignedTechnicianId)
        return;

      const matchedTask = findExecutionTask("AI", workflowId);
      const taskId = idOf(matchedTask);
      if (taskId) workflowOwnedTaskIds.add(taskId);

      const farmLocationDetails = getFarmLocationDetails(ins.farmerId);
      const scheduleDate = ins.scheduledDate || null;
      const completedAt =
        canonicalStatus === AI_STATUS.DONE
          ? ins.completedAt || ins.inseminationDate || null
          : null;
      const terminal = canonicalStatus === AI_STATUS.DONE;
      const itemDisplayDate = terminal
        ? completedAt || ins.createdAt || null
        : scheduleDate || ins.createdAt || null;
      const attemptNumber = Number.isInteger(ins.attemptNumber)
        ? ins.attemptNumber
        : null;
      const previousAttempt =
        ins.previousAttemptId && typeof ins.previousAttemptId === "object"
          ? ins.previousAttemptId
          : null;

      let allowedAction = null;
      let actionLabel = null;
      let stateIssue = null;
      if (canonicalStatus === AI_STATUS.PENDING) {
        actionLabel = "Schedule review required";
        stateIssue = scheduleDate
          ? "PENDING_WITH_SCHEDULE"
          : "PENDING_ASSIGNED_WITHOUT_SCHEDULE";
      } else if (canonicalStatus === AI_STATUS.APPROVED) {
        allowedAction = "SCHEDULE_VISIT";
        actionLabel = "Schedule Visit";
      } else if (
        [AI_STATUS.SCHEDULED, AI_STATUS.IN_PROGRESS].includes(canonicalStatus)
      ) {
        allowedAction = "RECORD_SERVICE";
        actionLabel = "Record Insemination";
      } else if (canonicalStatus === AI_STATUS.DONE) {
        allowedAction = "VIEW_RECORD";
        actionLabel = "View Record";
      }

      const item = {
        id: workflowId,
        workflowId,
        taskId,
        workflowType: "AI",
        type: "insemination",
        taskType: "AI",
        serviceType: "Artificial Insemination",
        requestKind:
          attemptNumber && attemptNumber > 1 ? "re_insemination" : "initial_ai",
        attemptNumber,
        previousAttemptId: idOf(ins.previousAttemptId),
        attemptSeriesId: idOf(ins.attemptSeriesId),
        previousAttemptOutcome: previousAttempt?.outcome || null,
        previousAttemptVerified: previousAttempt
          ? isVerifiedFailedAIAttempt(previousAttempt)
          : false,
        status: canonicalStatus,
        allowedAction,
        actionLabel,
        stateIssue,
        title: "Artificial Insemination",
        summary: `Attempt ${ins.attemptNumber || 1}`,
        farmer: serializeFarmer(ins.farmerId),
        animal: serializeAnimal(ins.animalId),
        timing: {
          kind: terminal ? "completed" : "scheduled_visit",
          date: terminal ? completedAt : scheduleDate,
          visitPeriod: terminal ? null : ins.visitPeriod || null,
        },
        context: {
          attemptNumber: ins.attemptNumber || 1,
          sireBreed: ins.sireBreed || null,
          sireCode: ins.sireCode || null,
        },
        schedule: {
          date: scheduleDate,
          visitPeriod: ins.visitPeriod || null,
        },
        requestedAt: ins.createdAt || null,
        completedAt,
        isReadyToday:
          [AI_STATUS.APPROVED, AI_STATUS.SCHEDULED].includes(canonicalStatus) &&
          isToday(scheduleDate),
        time: formatTime(itemDisplayDate),
        preferredTime: formatTime(itemDisplayDate),
        displayDate: itemDisplayDate,
        farmerName: ins.farmerId?.name || "Unknown Farmer",
        farmerPhone: ins.farmerId?.phoneNumber || ins.farmerId?.phone || null,
        farmerImageUrl:
          ins.farmerId?.imageUrl ||
          ins.farmerId?.avatarUrl ||
          ins.farmerId?.profilePicture ||
          ins.farmerId?.avatar ||
          "",
        farmerId: ins.farmerId || null,
        location: formatAddress(ins.farmerId?.address),
        ...farmLocationDetails,
        animalId: ins.animalId || null,
        animalTag: ins.animalId?.earTag || ins.animalId?.animalId || null,
        displayStatus:
          [AI_STATUS.APPROVED, AI_STATUS.SCHEDULED].includes(canonicalStatus) &&
          isToday(scheduleDate)
            ? "Ready Today"
            : canonicalStatus,
        task: `AI Service (Attempt #${ins.attemptNumber || 1}) - ${ins.animalId?.animalId || ins.animalId?.earTag || "Unknown"}`,
        urgent: false,
        overdue: isOverdue(scheduleDate, terminal),
        sentTime: formatTime(ins.createdAt),
        scheduledDate: scheduleDate,
        visitPeriod: ins.visitPeriod || null,
        raw: presentedInsemination,
      };

      unifiedQueue.push(item);
    });

    healthReqs.forEach((req) => {
      const workflowId = idOf(req);
      if (!workflowId) return;
      const medicalRecord =
        medicalRecordByHealthRequest.get(workflowId) || null;
      const medicalRecordId = idOf(medicalRecord);

      const matchedTask = findExecutionTask("Health", workflowId);
      const taskId = idOf(matchedTask);
      if (taskId) workflowOwnedTaskIds.add(taskId);

      const farmLocationDetails = getFarmLocationDetails(req.farmerId);
      const scheduleDate = req.scheduledDate || null;
      const healthStatus = String(req.status || "")
        .trim()
        .toLowerCase()
        .replaceAll("_", "-");
      const handlingMethod = String(req.handlingMethod || "").toLowerCase();
      const terminal = ["resolved", "done", "completed"].includes(
        healthStatus,
      );
      const completedAt = terminal
        ? req.resolvedAt || medicalRecord?.date || null
        : null;
      const itemDisplayDate = terminal
        ? completedAt || req.createdAt || null
        : scheduleDate || req.createdAt || null;

      let allowedAction = null;
      let actionLabel = null;
      let stateIssue = null;
      if (
        ["pending", "triaged", "assigned", "approved"].includes(healthStatus)
      ) {
        allowedAction = "HANDLE_REQUEST";
        actionLabel = "Handle Request";
      } else if (healthStatus === "scheduled") {
        const hasCanonicalFarmVisit =
          handlingMethod === "farm_visit" &&
          Boolean(scheduleDate) &&
          ["morning", "afternoon"].includes(String(req.visitPeriod || ""));
        if (hasCanonicalFarmVisit) {
          allowedAction = "START_SERVICE";
          actionLabel = "Start Visit";
        } else {
          allowedAction = "VIEW_DETAILS";
          actionLabel = "Review Request";
          stateIssue = "INCOMPLETE_FARM_VISIT_SCHEDULE";
        }
      } else if (healthStatus === "in-progress") {
        allowedAction = "RECORD_SERVICE";
        actionLabel = "Complete Visit";
      } else if (terminal) {
        allowedAction = medicalRecordId ? "VIEW_RECORD" : "VIEW_RESPONSE";
      }

      if (allowedAction === "VIEW_RECORD") actionLabel = "View Record";
      else if (allowedAction === "VIEW_RESPONSE")
        actionLabel = "View Response";

      const item = {
        id: workflowId,
        workflowId,
        taskId,
        workflowType: "Health",
        type: "health",
        taskType: "Health",
        serviceType: req.requestType || "Health Assistance",
        status: req.status,
        handlingMethod: req.handlingMethod || null,
        medicalRecordId,
        allowedAction,
        actionLabel,
        stateIssue,
        title: req.requestType || "Health Assistance",
        summary: req.handlingMethod
          ? `Handling: ${String(req.handlingMethod).replaceAll("_", " ")}`
          : "Farmer health request",
        farmer: serializeFarmer(req.farmerId),
        animal: serializeAnimal(req.animalId),
        timing: {
          kind: terminal ? "completed" : "scheduled_visit",
          date: terminal ? completedAt : scheduleDate,
          visitPeriod: terminal ? null : req.visitPeriod || null,
        },
        context: {
          handlingMethod: req.handlingMethod || null,
          urgency: req.urgency || null,
          description: req.description || null,
        },
        schedule: {
          date: scheduleDate,
          visitPeriod: req.visitPeriod || null,
        },
        requestedAt: req.createdAt || null,
        completedAt,
        isReadyToday:
          ["approved", "scheduled"].includes(req.status) &&
          isToday(scheduleDate),
        time: formatTime(itemDisplayDate),
        preferredTime: formatTime(itemDisplayDate),
        displayDate: itemDisplayDate,
        farmerName: req.farmerId?.name || "Unknown Farmer",
        farmerPhone: req.farmerId?.phoneNumber || req.farmerId?.phone || null,
        farmerImageUrl:
          req.farmerId?.imageUrl ||
          req.farmerId?.avatarUrl ||
          req.farmerId?.profilePicture ||
          req.farmerId?.avatar ||
          "",
        farmerId: req.farmerId || null,
        location: formatAddress(req.farmerId?.address),
        ...farmLocationDetails,
        animalId: req.animalId || null,
        animalTag: req.animalId?.earTag || req.animalId?.animalId || null,
        displayStatus:
          ["approved", "scheduled"].includes(req.status) &&
          isToday(scheduleDate)
            ? "Ready Today"
            : req.status,
        task: `Health Check - ${req.animalId?.animalId || req.animalId?.earTag || "Unknown"}`,
        urgent: ["high", "emergency"].includes(req.urgency),
        overdue: isOverdue(scheduleDate, terminal),
        sentTime: formatTime(req.createdAt),
        scheduledDate: scheduleDate,
        visitPeriod: req.visitPeriod || null,
        raw: req,
      };

      unifiedQueue.push(item);
    });

    scheduledTasks.forEach((taskDoc) => {
      const taskId = idOf(taskDoc);
      if (!taskId || workflowOwnedTaskIds.has(taskId)) return;
      if (
        !isAdmin &&
        idOf(taskDoc.technicianId) !== idOf(authenticatedUserId)
      ) {
        return;
      }

      const terminal = taskDoc.status === "Completed";
      if ((workState === "completed") !== terminal) return;
      const taskContext = taskContextById.get(taskId) || {};
      const firstAnimal =
        taskContext.animal ||
        (Array.isArray(taskDoc.animalIds) ? taskDoc.animalIds[0] : null);
      const taskFarmer = taskContext.farmer || taskDoc.farmerId || null;

      let allowedAction = null;
      let wType = "StandaloneTask";
      if (taskDoc.taskType === "PD") wType = "PD";
      if (taskDoc.taskType === "BreedingFollowUp")
        wType = "BreedingFollowUp";
      if (taskDoc.taskType === "CD" || taskDoc.taskType === "Calving")
        wType = "Calving";

      const completedAt = terminal
        ? taskDoc.completedAt ||
          (wType === "PD"
            ? taskContext.pregnancy?.pregnancyDiagnosis?.date ||
              taskContext.pregnancy?.confirmation?.confirmedAt ||
              null
            : wType === "BreedingFollowUp"
              ? taskContext.insemination?.outcomeConfirmedAt || null
              : wType === "Calving"
                ? taskContext.calving?.date || null
                : null)
        : null;
      const itemDisplayDate = terminal
        ? completedAt || taskDoc.createdAt || null
        : taskDoc.dueDate || taskDoc.createdAt || null;

      if (["PD", "Calving"].includes(wType)) {
        if (
          ["Pending", "In Progress"].includes(taskDoc.status) &&
          taskDoc.technicianId
        )
          allowedAction = "RECORD_SERVICE";
        else if (taskDoc.status === "Pending") allowedAction = "CLAIM";
        else if (taskDoc.status === "Completed") allowedAction = "VIEW_DETAILS";
      } else if (wType === "BreedingFollowUp") {
        if (["Pending", "In Progress"].includes(taskDoc.status)) {
          allowedAction = taskDoc.technicianId
            ? "RECORD_BREEDING_OBSERVATION"
            : "CLAIM";
        } else if (taskDoc.status === "Completed") {
          allowedAction = "VIEW_DETAILS";
        }
      } else if (["Pending", "In Progress"].includes(taskDoc.status)) {
        allowedAction = taskDoc.technicianId ? "COMPLETE_TASK" : "CLAIM";
      } else if (taskDoc.status === "Completed") {
        allowedAction = "VIEW_DETAILS";
      }

      let actionLabel = null;
      if (allowedAction === "RECORD_SERVICE") {
        actionLabel =
          wType === "PD"
            ? "Record Pregnancy Check"
            : wType === "Calving"
              ? "Record Calving"
              : "Record Service";
      } else if (allowedAction === "COMPLETE_TASK")
        actionLabel = "Complete Task";
      else if (allowedAction === "CLAIM") actionLabel = "Claim";
      else if (allowedAction === "RECORD_BREEDING_OBSERVATION")
        actionLabel = "Record Follow-up";
      else if (allowedAction === "VIEW_DETAILS") actionLabel = "View Details";

      const serviceType =
        wType === "PD"
          ? "Pregnancy Diagnosis"
          : wType === "BreedingFollowUp"
            ? "Breeding Follow-up"
          : wType === "Calving"
            ? "Calving Assistance"
            : taskDoc.taskType || "Task";

      const item = {
        id: taskId,
        workflowId: null,
        taskId,
        workflowType: wType,
        type: "task",
        taskType: taskDoc.taskType || "Other",
        serviceType,
        status: taskDoc.status,
        allowedAction,
        actionLabel,
        title: serviceType,
        summary: taskDoc.notes || null,
        farmer: serializeFarmer(taskFarmer),
        animal: serializeAnimal(firstAnimal),
        timing: {
          kind: terminal ? "completed" : "due",
          date: terminal ? completedAt : taskDoc.dueDate || null,
          visitPeriod: null,
        },
        context: {
          notes: taskDoc.notes || null,
          workflowStage: taskDoc.metadata?.workflowStage || null,
          pregnancyId: idOf(
            taskDoc.metadata?.pregnancyId || taskContext.pregnancy,
          ),
          inseminationId: idOf(
            taskDoc.metadata?.inseminationId ||
              taskContext.insemination ||
              taskContext.pregnancy?.inseminationId ||
              taskContext.calving?.inseminationId,
          ),
          reportType: taskDoc.metadata?.reportType || null,
        },
        schedule: {
          date: taskDoc.dueDate || null,
          visitPeriod: taskDoc.metadata?.visitPeriod || null,
        },
        requestedAt: taskDoc.createdAt || null,
        completedAt,
        displayStatus: taskDoc.status,
        time: formatTime(itemDisplayDate),
        displayDate: itemDisplayDate,
        farmerName: taskFarmer?.name || "Unknown Farmer",
        farmerPhone:
          taskFarmer?.phoneNumber || taskFarmer?.phone || null,
        farmerImageUrl:
          taskFarmer?.imageUrl ||
          taskFarmer?.avatarUrl ||
          taskFarmer?.profilePicture ||
          taskFarmer?.avatar ||
          null,
        farmerId: taskFarmer || null,
        location: formatAddress(taskFarmer?.address),
        ...getFarmLocationDetails(taskFarmer),
        animalId: firstAnimal || null,
        animalTag: firstAnimal?.earTag || firstAnimal?.animalId || null,
        preferredTime: formatTime(itemDisplayDate),
        task: `${taskDoc.taskType || "Visit"}${firstAnimal ? ` - ${firstAnimal.animalId || firstAnimal.earTag || "Unknown"}` : ""}`,
        urgent:
          taskDoc.category === "Urgent" || taskDoc.category === "Emergency",
        overdue: isOverdue(taskDoc.dueDate, terminal),
        sentTime: formatTime(taskDoc.createdAt),
        scheduledDate: taskDoc.dueDate || null,
        visitPeriod: taskDoc.metadata?.visitPeriod || null,
        raw: taskDoc,
      };

      unifiedQueue.push(item);
    });

    // Sort logic to match work queue priorities (overdue first, then by date)
    unifiedQueue.sort((a, b) => {
      if (a.overdue && !b.overdue) return -1;
      if (!a.overdue && b.overdue) return 1;
      const aDate = new Date(a.displayDate || 0).getTime();
      const bDate = new Date(b.displayDate || 0).getTime();
      return aDate - bDate;
    });

    const items = unifiedQueue.slice(skip, skip + limit);
    res.status(200).json({
      data: items,
      pagination: {
        total: selectedTotal,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(selectedTotal / limit)),
      },
      counts: workCounts,
    });
  } catch (error) {
    console.error("[getWorkQueue ERROR]", error);
    res.status(500).json({ message: "Failed to load work queue data." });
  }
};

/**
 * Update Technician Dispatch Status
 * PATCH /api/technician/dispatch-status
 */
export const updateDispatchStatus = async (req, res) => {
  try {
    const { availabilityStatus, acceptsNewRequests } = req.body;

    // Authorization
    if (req.user.role !== "technician") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updates = {};
    if (availabilityStatus !== undefined) {
      if (!["available", "busy", "off_duty"].includes(availabilityStatus)) {
        return res
          .status(400)
          .json({ message: "Invalid availability status." });
      }
    }

    if (acceptsNewRequests !== undefined) {
      if (typeof acceptsNewRequests !== "boolean") {
        return res
          .status(400)
          .json({ message: "acceptsNewRequests must be a boolean." });
      }
    }

    if (
      availabilityStatus !== undefined &&
      acceptsNewRequests !== undefined &&
      ((acceptsNewRequests && availabilityStatus !== "available") ||
        (!acceptsNewRequests && availabilityStatus === "available"))
    ) {
      return res.status(400).json({
        message:
          "Receive Requests and availability must describe the same operational state.",
        code: "DISPATCH_STATUS_CONFLICT",
      });
    }

    if (acceptsNewRequests !== undefined) {
      updates["dispatchProfile.acceptsNewRequests"] = acceptsNewRequests;
      updates["dispatchProfile.availabilityStatus"] =
        availabilityStatus ||
        (acceptsNewRequests ? "available" : "off_duty");
    } else if (availabilityStatus !== undefined) {
      updates["dispatchProfile.availabilityStatus"] = availabilityStatus;
      updates["dispatchProfile.acceptsNewRequests"] =
        availabilityStatus === "available";
    }

    if (Object.keys(updates).length > 0) {
      updates["dispatchProfile.updatedAt"] = new Date();

      // Ensure dispatchProfile object exists with safe defaults if missing
      const user = await User.findById(req.user._id)
        .select("dispatchProfile")
        .lean();
      if (!user) {
        return res.status(404).json({ message: "Technician not found." });
      }

      if (!user.dispatchProfile) {
        updates["dispatchProfile.availabilityStatus"] ??= "off_duty";
        updates["dispatchProfile.acceptsNewRequests"] ??= false;
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updates },
        { returnDocument: "after", runValidators: true },
      );

      return res.status(200).json({
        message: "Dispatch status updated successfully.",
        dispatchProfile: updatedUser.dispatchProfile,
      });
    }

    return res.status(200).json({ message: "No updates provided." });
  } catch (error) {
    console.error("[Update Dispatch Status] Error:", error);
    res.status(500).json({ message: "Failed to update dispatch status." });
  }
};
