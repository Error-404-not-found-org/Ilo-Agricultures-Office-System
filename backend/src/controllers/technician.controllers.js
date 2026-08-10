import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import cloudinary from "../config/cloudinary.js";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Calving } from "../models/calving.model.js";
import { Notification } from "../models/notification.model.js";
import { AIRequest } from "../models/ai-request.model.js";
import { Config } from "../models/config.model.js";
import { FieldNote } from "../models/field-note.model.js";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { Task } from "../models/task.model.js";
import { inngest } from "../config/inngest.js";
import {
  confirmPregnancyDiagnosis,
  recordPregnancyContinuationRecheck,
} from "../services/pregnancy-confirmation.service.js";
import { persistCalving } from "../services/calving.service.js";
import {
  correctCalvingRecord,
  correctPregnancyRecord,
} from "../services/breeding-correction.service.js";
import {
  activeRequestKeyForAnimal,
  createAIRequestWithGuard,
  findActiveAIRequest,
  isVerifiedFailedAIAttempt,
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
import {
  notifyUser,
  sendNotificationPush,
} from "../services/notification-delivery.service.js";
import { presentNotificationDocument } from "../domain/notification-presentation.js";
import { buildAIRequestAssignmentGuard } from "../policies/request.policy.js";
import { normalizeTechnicianNoteInput } from "../domain/ai-recording-fields.js";
import { combineManilaServiceDateTime } from "../domain/service-date-time.js";

export const getTechnicianDashboardData = async (req, res) => {
  try {
    const { fullAgenda } = req.query;
    const isFull = fullAgenda === "true";
    const hideDeclinedForMe =
      req.user?.role !== "admin" && req.user?._id
        ? { declinedByTechnicianIds: { $ne: req.user._id } }
        : {};

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
        // Unassigned requests don't have handledBy yet, so global unassigned stat is acceptable or scoped to local
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
          status: "done",
          updatedAt: { $gte: todayStart, $lt: todayEnd },
          ...assigneeFilterAI,
        }),
        HealthRequest.countDocuments({
          status: "resolved",
          updatedAt: { $gte: todayStart, $lt: todayEnd },
          ...assigneeFilterHealth,
        }),
      ]),
      // Data Streams (Using .lean() for performance)
      Insemination.find({
        status: { $in: ["pending", "approved", "scheduled", "in-progress"] },
        deletedAt: null,
        ...hideDeclinedForMe,
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
        ...hideDeclinedForMe,
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
        dueDate: { $ne: null },
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
        displayStatus: isReadyToday ? "Ready Today" : ins.status,
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
        } else if (assignedToMeAI) {
          pendingRequests.push(item);
        }
      }

      if (
        isFull ||
        (itemDisplayDate >= todayStart && itemDisplayDate < todayEnd) ||
        isOverdue
      ) {
        if (ins.status !== "pending" && assignedToMeAI) {
          agendaItems.push(item);
        }
      }
    });

    // Process Health Requests
    healthReqs.forEach((healthRequest) => {
      const farmLocationDetails = getFarmLocationDetails(
        healthRequest.farmerId,
      );
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
        type: "health",
        taskType: "Health",
        serviceType: healthRequest.requestType || "Health Assistance",
        status: healthRequest.status,
        isReadyToday,
        time: formatTime(itemDisplayDate),
        preferredTime: formatTime(itemDisplayDate),
        displayDate: itemDisplayDate,
        visitPeriod: healthRequest.visitPeriod || null,
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
        displayStatus: isReadyToday ? "Ready Today" : healthRequest.status,
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
        } else if (assignedToMeHealth) {
          pendingRequests.push(item);
        }
      }

      if (
        isFull ||
        (itemDisplayDate >= todayStart && itemDisplayDate < todayEnd) ||
        isOverdue
      ) {
        if (healthRequest.status !== "pending" && assignedToMeHealth) {
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
        completedToday: completedTodayArr[0] + completedTodayArr[1],
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

    const query = { deletedAt: null };
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

    const summaryQuery = { deletedAt: null };
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
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const query = { attemptNumber: { $gt: 1 }, deletedAt: null };

    const [records, total] = await Promise.all([
      Insemination.find(query)
        .populate("farmerId", "name phoneNumber address")
        .populate("animalId", "animalId earTag breed species imageUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Insemination.countDocuments(query),
    ]);

    res.status(200).json({
      data: records,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching re-inseminations",
      error: error.message,
    });
  }
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
    if (farmerId) {
      farmer = await User.findById(farmerId);
    } else if (phoneNumber) {
      farmer = await User.findOne({ phoneNumber });
      if (!farmer) {
        if (email) {
          try {
            const clientUrl = (
              process.env.CLIENT_URL || "http://localhost:5173"
            ).trim();
            const normalizedClientUrl = /^https?:\/\//i.test(clientUrl)
              ? clientUrl
              : `https://${clientUrl}`;
            const finalRedirectUrl = `${normalizedClientUrl.replace(/\/$/, "")}/download-app`;

            await clerkClient.invitations.createInvitation({
              emailAddress: email,
              publicMetadata: { role: "farmer" },
              redirectUrl: finalRedirectUrl,
            });
          } catch (clerkError) {
            console.error("[walkInAI CLERK ERROR]", clerkError.message);
          }
        }

        farmer = await User.create({
          name: `${firstName || ""} ${lastName || ""}`.trim(),
          phoneNumber,
          email: email || undefined,
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
          role: "farmer",
          isVerified: true,
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
    pregnancies.map(withPregnancyConfirmationMetadata).forEach((p) => {
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
      pregnancies: pregnancies.map(withPregnancyConfirmationMetadata),
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

    const fullName = `${firstName} ${lastName}`.trim();

    // 2. Check for existing user
    // We check both email and phone number to prevent duplicate accounts
    const existingUser = await User.findOne({
      $or: [{ phoneNumber }, ...(email ? [{ email }] : [])],
    });

    if (existingUser) {
      const conflict =
        existingUser.phoneNumber === phoneNumber ? "phone number" : "email";
      return res.status(400).json({
        message: `A farmer with this ${conflict} is already registered.`,
      });
    }

    // 3. Handle Clerk Invitation (for tech-enabled farmers)
    if (email) {
      try {
        const clientUrl = (
          process.env.CLIENT_URL || "http://localhost:5173"
        ).trim();
        const normalizedClientUrl = /^https?:\/\//i.test(clientUrl)
          ? clientUrl
          : `https://${clientUrl}`;
        const finalRedirectUrl = `${normalizedClientUrl.replace(/\/$/, "")}/download-app`;

        await clerkClient.invitations.createInvitation({
          emailAddress: email,
          publicMetadata: { role: "farmer" },
          redirectUrl: finalRedirectUrl,
          expiresInDays: 1,
        });
      } catch (clerkError) {
        console.error("[registerFarmer CLERK ERROR]", clerkError.message);
        // Continue even if invitation fails, as we still want the local record
      }
    }

    // 4. Create local User record
    const user = await User.create({
      clerkId: email
        ? undefined
        : `manual_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: fullName,
      email: email || undefined,
      phoneNumber,
      address: {
        street: address?.street || "",
        barangay: address?.barangay || "Unknown",
        city: address?.city || "Oton",
        province: address?.province || "Iloilo",
      },
      role: "farmer",
      isVerified: !!email,
      status: "active",
    });

    res.status(201).json({
      message: email
        ? "Registration successful! Invitation sent to email."
        : "Farmer profile registered successfully.",
      user,
    });
  } catch (error) {
    console.error("[registerFarmer ERROR]", error);
    res.status(500).json({
      message: "An internal error occurred during farmer registration.",
      error: error.message,
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
    console.error("[recordCalving ERROR]", error);
    const transactionUnavailable =
      /Transaction numbers are only allowed|replica set|mongos/i.test(
        error.message,
      );
    res.status(transactionUnavailable ? 503 : error.status || 500).json({
      message: transactionUnavailable
        ? "This operation requires a transaction-capable database."
        : error.message || "Failed to record calving",
      code: transactionUnavailable ? "TRANSACTION_UNAVAILABLE" : error.code,
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

    await notifyUser({
      recipient: farmer,
      senderId: req.user._id,
      type: "system",
      relatedId: animal._id,
      category: "animal",
      eventType: "animal_registered",
      linkType: "animal",
      title: "New animal registered",
      message: `A new ${species} (${breed}) with Tag #${earTag} has been added by technician ${req.user.name}.`,
      metadata: {
        animalId: animal._id,
        animalTag: earTag,
        technicianName: req.user.name,
      },
    });

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
      { new: true },
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
        { new: true },
      );
    } else if (isPermanent) {
      fieldNote = await FieldNote.findOneAndDelete(ownerFilter);
    } else {
      fieldNote = await FieldNote.findOneAndUpdate(
        ownerFilter,
        { $set: { deletedAt: new Date() } },
        { new: true },
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
      { new: true },
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
    const note = req.body?.technicianNote || "Declined by technician.";

    if (!["ai", "health"].includes(type)) {
      return res.status(400).json({ message: "Invalid request type." });
    }

    const Model = type === "ai" ? Insemination : HealthRequest;
    const assignedField = type === "ai" ? "approvedBy" : "handledBy";
    const request = await Model.findOne({ _id: id, deletedAt: null });

    if (!request) {
      return res.status(404).json({ message: "Request not found." });
    }

    if (
      ["done", "resolved", "completed", "rejected", "cancelled"].includes(
        request.status,
      )
    ) {
      return res.status(400).json({
        message: `This request is already ${request.status} and cannot be declined.`,
      });
    }

    const assignedTo = request[assignedField];
    const isAssignedToAnother =
      assignedTo &&
      assignedTo.toString() !== req.user._id.toString() &&
      req.user.role !== "admin";

    if (isAssignedToAnother) {
      const assignedTech = await User.findById(assignedTo)
        .select("name")
        .lean();
      return res.status(403).json({
        message: `This request is already assigned to ${assignedTech?.name || "another technician"}.`,
      });
    }

    const update = {
      $addToSet: { declinedByTechnicianIds: req.user._id },
      $push: {
        statusHistory: {
          status: "declined_by_technician",
          note,
          actorId: req.user._id,
          createdAt: new Date(),
        },
      },
    };

    if (assignedTo && assignedTo.toString() === req.user._id.toString()) {
      update.$unset = {
        [assignedField]: "",
        scheduledDate: "",
      };
      update.$set = {
        status: "pending",
        technicianNote: note,
      };
      if (type === "health") {
        update.$unset.assignedTechnicianId = "";
      }
    }

    const updated = await Model.findByIdAndUpdate(id, update, {
      new: true,
    });

    req.app.get("io").to("role:technician").emit("dashboardUpdate", {
      type: "REQUEST_DECLINED_FOR_TECHNICIAN",
      requestType: type,
      requestId: id,
      technicianId: req.user._id,
    });

    res.status(200).json({
      message:
        "Request hidden from your queue. Other technicians can still accept it.",
      data: updated,
    });
  } catch (error) {
    console.error("[declineTechnicianRequest ERROR]", error);
    res.status(500).json({
      message: "Failed to decline request for this technician.",
      error: error.message,
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
      if (!["technician", "admin"].includes(req.user.role)) {
        return res.status(403).json({
          message: "Only technicians or administrators can claim AI requests.",
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
        { new: true },
      )
        .populate("farmerId", "name address imageUrl phoneNumber")
        .populate("animalId", "animalId earTag species breed imageUrl");
    } else if (type === "health") {
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

      updated = await HealthRequest.findOneAndUpdate(
        {
          _id: id,
          deletedAt: null,
          handledBy: { $in: [null, undefined] },
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
        { new: true },
      )
        .populate("farmerId", "name address imageUrl phoneNumber")
        .populate("animalId", "animalId earTag species breed imageUrl");
    } else if (type === "breeding_verification") {
      const existing = await Task.findById(id);
      if (!existing) {
        return res.status(404).json({ message: "Task not found." });
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
        },
        {
          $set: {
            technicianId: req.user._id,
            claimedAt: new Date(),
          },
        },
        { new: true },
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
    return res.status(500).json({
      message: "Failed to claim request.",
      error: error.message,
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
      requestId,
    } = req.query;
    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 10;
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
      aiQuery.approvedBy = { $in: [null, undefined] };
      healthQuery.handledBy = { $in: [null, undefined] };
      taskQuery.technicianId = { $in: [null, undefined] };
      if (req.user.role !== "admin") {
        aiQuery.declinedByTechnicianIds = { $ne: req.user._id };
        healthQuery.declinedByTechnicianIds = { $ne: req.user._id };
      }
      aiQuery.status = {
        $in: ["pending", "approved", "unassigned", "triaged"],
      };
      healthQuery.status = {
        $in: ["pending", "triaged", "assigned", "approved", "unassigned"],
      };
      taskQuery.status = { $in: ["Pending", "unassigned"] };
    } else if (assignment === "all") {
      // No assignment filter
    } else {
      aiQuery.approvedBy = { $in: [req.user._id, null, undefined] };
      healthQuery.handledBy = { $in: [req.user._id, null, undefined] };
      taskQuery.technicianId = { $in: [req.user._id, null, undefined] };
      if (req.user.role !== "admin") {
        aiQuery.declinedByTechnicianIds = { $ne: req.user._id };
        healthQuery.declinedByTechnicianIds = { $ne: req.user._id };
      }
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

    const [aiRecords, healthRecords, pregnancyCheckTasks] = await Promise.all([
      fetchAI
        ? Insemination.find(aiQuery)
            .populate(
              "farmerId",
              "name address imageUrl phoneNumber farmLocation",
            )
            .populate("animalId", "animalId earTag species breed imageUrl")
            .populate("approvedBy", "name")
            .populate({
              path: "previousAttemptId",
              select:
                "attemptNumber inseminationDate outcome outcomeConfirmedAt approvedBy technicianId",
              populate: { path: "approvedBy technicianId", select: "name" },
            })
            .lean()
        : [],
      fetchHealth
        ? HealthRequest.find(healthQuery)
            .populate(
              "farmerId",
              "name address imageUrl phoneNumber farmLocation",
            )
            .populate("animalId", "animalId earTag species breed imageUrl")
            .populate("handledBy", "name")
            .lean()
        : [],
      fetchPregnancyChecks
        ? Task.find(taskQuery)
            .populate(
              "farmerId",
              "name address imageUrl phoneNumber farmLocation",
            )
            .populate("animalIds", "animalId earTag species breed imageUrl")
            .populate("technicianId", "name")
            .lean()
        : [],
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
        rec.imageUrl,
        ...(Array.isArray(rec.evidencePhotos) ? rec.evidencePhotos : []),
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
        farmerImageUrl: farmer.imageUrl || "",
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
          primaryUrl: rec.imageUrl || attachmentUrls[0] || null,
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
        farmerImageUrl: farmer.imageUrl || "",
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
        farmerImageUrl: farmer.imageUrl || "",
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
    const sortByVal = sortBy || "newest";
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
    const total = combined.length;
    const paginated = combined.slice(skip, skip + limit);

    res.status(200).json({
      requests: paginated,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
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
    const now = new Date();
    const PHT_OFFSET = 8 * 60 * 60 * 1000;
    const todayStart = new Date(now.getTime() + PHT_OFFSET);
    todayStart.setUTCHours(0, 0, 0, 0);
    todayStart.setTime(todayStart.getTime() - PHT_OFFSET);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const aiQuery = {
      status: {
        $in: ["pending", "approved", "scheduled", "in-progress", "done"],
      },
      deletedAt: null,
      ...(isAdmin
        ? {}
        : {
            declinedByTechnicianIds: { $ne: authenticatedUserId },
            $or: [
              { approvedBy: authenticatedUserId },
              { status: "done", technicianId: authenticatedUserId },
            ],
          }),
    };

    const healthAssigneeField = "assignedTechnicianId";
    const healthQuery = {
      status: {
        $in: [
          "pending",
          "triaged",
          "assigned",
          "approved",
          "scheduled",
          "in-progress",
          "in_progress",
          "resolved",
          "done",
        ],
      },
      deletedAt: null,
      ...(isAdmin
        ? {}
        : {
            declinedByTechnicianIds: { $ne: authenticatedUserId },
            $or: [
              { handledBy: authenticatedUserId },
              { [healthAssigneeField]: authenticatedUserId },
            ],
          }),
    };

    const taskQuery = {
      status: { $in: ["Pending", "In Progress", "Completed"] },
      ...(isAdmin
        ? {}
        : {
            $or: [
              { technicianId: authenticatedUserId },
              { technicianId: null },
              { technicianId: { $exists: false } },
            ],
          }),
    };

    const [inseminations, healthReqs, scheduledTasks] = await Promise.all([
      Insemination.find(aiQuery)
        .populate(
          "farmerId",
          "name phoneNumber phone address farmLocation imageUrl avatarUrl profilePicture avatar",
        )
        .populate("animalId", "name animalId earTag imageUrl breed species")
        .populate(
          "previousAttemptId",
          "attemptNumber outcome isSuccess outcomeVerificationStatus reviewedBy status",
        )
        .sort({ createdAt: -1 })
        .lean(),

      HealthRequest.find(healthQuery)
        .populate(
          "farmerId",
          "name phoneNumber phone address farmLocation imageUrl avatarUrl profilePicture avatar",
        )
        .populate("animalId", "name animalId earTag imageUrl breed species")
        .sort({ urgency: -1, createdAt: -1 })
        .lean(),

      Task.find(taskQuery)
        .populate(
          "farmerId",
          "name phoneNumber phone address farmLocation avatarUrl profilePicture avatar",
        )
        .populate("animalIds", "name animalId earTag imageUrl breed species")
        .sort({ dueDate: 1, createdAt: -1 })
        .lean(),
    ]);

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
    });

    const serializeAnimal = (animal) => ({
      id: idOf(animal),
      name: animal?.name || animal?.animalId || animal?.earTag || "Unknown",
      earTag: animal?.earTag || animal?.animalId || null,
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
      if (["PD", "CD", "CALVING"].includes(taskType)) return false;

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
      scheduledTasks.find((taskDoc) => {
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

      const assignedTechnicianId = idOf(ins.approvedBy);
      if (ins.status === "pending" && !assignedTechnicianId) return;

      const matchedTask = findExecutionTask("AI", workflowId);
      const taskId = idOf(matchedTask);
      if (taskId) workflowOwnedTaskIds.add(taskId);

      const farmLocationDetails = getFarmLocationDetails(ins.farmerId);
      const scheduleDate = ins.scheduledDate || null;
      const completedAt =
        ins.status === "done"
          ? ins.inseminationDate || ins.updatedAt || null
          : null;
      const itemDisplayDate =
        scheduleDate || completedAt || ins.createdAt || null;
      const terminal = ins.status === "done";
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
      if (ins.status === "pending") {
        actionLabel = "Schedule review required";
        stateIssue = scheduleDate
          ? "PENDING_WITH_SCHEDULE"
          : "PENDING_ASSIGNED_WITHOUT_SCHEDULE";
      } else if (ins.status === "approved") {
        allowedAction = "SCHEDULE_VISIT";
        actionLabel = "Schedule Visit";
      } else if (["scheduled", "in-progress"].includes(ins.status)) {
        allowedAction = "RECORD_SERVICE";
        actionLabel = "Record Insemination";
      } else if (ins.status === "done") {
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
        status: ins.status,
        allowedAction,
        actionLabel,
        stateIssue,
        farmer: serializeFarmer(ins.farmerId),
        animal: serializeAnimal(ins.animalId),
        schedule: {
          date: scheduleDate,
          visitPeriod: ins.visitPeriod || null,
        },
        requestedAt: ins.createdAt || null,
        completedAt,
        isReadyToday:
          ["approved", "scheduled"].includes(ins.status) &&
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
          ["approved", "scheduled"].includes(ins.status) &&
          isToday(scheduleDate)
            ? "Ready Today"
            : ins.status,
        task: `AI Service (Attempt #${ins.attemptNumber || 1}) - ${ins.animalId?.animalId || ins.animalId?.earTag || "Unknown"}`,
        urgent: false,
        overdue: isOverdue(scheduleDate, terminal),
        sentTime: formatTime(ins.createdAt),
        scheduledDate: scheduleDate,
        visitPeriod: ins.visitPeriod || null,
        raw: ins,
      };

      unifiedQueue.push(item);
    });

    healthReqs.forEach((req) => {
      const workflowId = idOf(req);
      if (!workflowId) return;

      const matchedTask = findExecutionTask("Health", workflowId);
      const taskId = idOf(matchedTask);
      if (taskId) workflowOwnedTaskIds.add(taskId);

      const farmLocationDetails = getFarmLocationDetails(req.farmerId);
      const scheduleDate = req.scheduledDate || null;
      const terminal = ["resolved", "done"].includes(req.status);
      const completedAt = terminal
        ? req.resolvedAt || req.updatedAt || null
        : null;
      const itemDisplayDate =
        scheduleDate || completedAt || req.createdAt || null;

      let allowedAction = null;
      let actionLabel = null;
      if (
        req.status === "pending" ||
        req.status === "triaged" ||
        req.status === "assigned"
      )
        allowedAction = "CLAIM";
      else if (req.status === "approved" || req.status === "scheduled")
        allowedAction = "START_SERVICE";
      else if (req.status === "in-progress" || req.status === "in_progress")
        allowedAction = "RECORD_SERVICE";
      else if (terminal) allowedAction = "VIEW_RECORD";

      if (allowedAction === "CLAIM") actionLabel = "Claim";
      else if (allowedAction === "START_SERVICE") actionLabel = "Start Service";
      else if (allowedAction === "RECORD_SERVICE")
        actionLabel = "Record Service";
      else if (allowedAction === "VIEW_RECORD") actionLabel = "View Record";

      const item = {
        id: workflowId,
        workflowId,
        taskId,
        workflowType: "Health",
        type: "health",
        taskType: "Health",
        serviceType: req.requestType || "Health Assistance",
        status: req.status,
        allowedAction,
        actionLabel,
        farmer: serializeFarmer(req.farmerId),
        animal: serializeAnimal(req.animalId),
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

      const itemDisplayDate = taskDoc.dueDate || taskDoc.createdAt;
      const terminal = taskDoc.status === "Completed";
      const firstAnimal = Array.isArray(taskDoc.animalIds)
        ? taskDoc.animalIds[0]
        : null;

      let allowedAction = null;
      let wType = "StandaloneTask";
      if (taskDoc.taskType === "PD") wType = "PD";
      if (taskDoc.taskType === "CD" || taskDoc.taskType === "Calving")
        wType = "Calving";

      if (["PD", "Calving"].includes(wType)) {
        if (taskDoc.status === "Pending" && taskDoc.technicianId)
          allowedAction = "START_SERVICE";
        else if (taskDoc.status === "In Progress")
          allowedAction = "RECORD_SERVICE";
        else if (taskDoc.status === "Pending") allowedAction = "CLAIM";
      } else if (["Pending", "In Progress"].includes(taskDoc.status)) {
        allowedAction = taskDoc.technicianId ? "COMPLETE_TASK" : "CLAIM";
      }

      let actionLabel = null;
      if (allowedAction === "START_SERVICE") actionLabel = "Start Service";
      else if (allowedAction === "RECORD_SERVICE")
        actionLabel = "Record Service";
      else if (allowedAction === "COMPLETE_TASK") actionLabel = "Complete Task";
      else if (allowedAction === "CLAIM") actionLabel = "Claim";

      const serviceType =
        wType === "PD"
          ? "Pregnancy Diagnosis"
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
        farmer: serializeFarmer(taskDoc.farmerId),
        animal: serializeAnimal(firstAnimal),
        schedule: {
          date: taskDoc.dueDate || null,
          visitPeriod: taskDoc.metadata?.visitPeriod || null,
        },
        requestedAt: taskDoc.createdAt || null,
        completedAt: terminal
          ? taskDoc.completedAt || taskDoc.updatedAt || null
          : null,
        displayStatus: taskDoc.status,
        time: formatTime(itemDisplayDate),
        displayDate: itemDisplayDate,
        farmerName: taskDoc.farmerId?.name || "Unknown Farmer",
        farmerPhone:
          taskDoc.farmerId?.phoneNumber || taskDoc.farmerId?.phone || null,
        farmerImageUrl:
          taskDoc.farmerId?.avatarUrl ||
          taskDoc.farmerId?.profilePicture ||
          taskDoc.farmerId?.avatar ||
          null,
        farmerId: taskDoc.farmerId || null,
        location: formatAddress(taskDoc.farmerId?.address),
        ...getFarmLocationDetails(taskDoc.farmerId),
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

    res.status(200).json({
      data: unifiedQueue,
      pagination: {
        total: unifiedQueue.length,
        page: 1,
        limit: unifiedQueue.length,
        totalPages: 1,
      },
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
      updates["dispatchProfile.availabilityStatus"] = availabilityStatus;
    }

    if (acceptsNewRequests !== undefined) {
      if (typeof acceptsNewRequests !== "boolean") {
        return res
          .status(400)
          .json({ message: "acceptsNewRequests must be a boolean." });
      }
      updates["dispatchProfile.acceptsNewRequests"] = acceptsNewRequests;
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
        if (!updates["dispatchProfile.availabilityStatus"]) {
          updates["dispatchProfile.availabilityStatus"] = "off_duty";
        }
        if (updates["dispatchProfile.acceptsNewRequests"] === undefined) {
          updates["dispatchProfile.acceptsNewRequests"] = false;
        }
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
