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
import { persistPregnancyDiagnosis } from "../services/livestock-transaction.service.js";
import { persistCalving } from "../services/calving.service.js";
import {
  correctCalvingRecord,
  correctPregnancyRecord,
} from "../services/breeding-correction.service.js";
import {
  activeRequestKeyForAnimal,
  createAIRequestWithGuard,
} from "../services/ai-request-creation.service.js";
import { activeHealthCaseKey } from "../services/health-request-creation.service.js";
import {
  verifyPostpartumWindow,
  calculateTargetCalvingDate,
  checkInseminationAgeEligibility,
} from "../utils/cattleCore.js";

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
      }),
      HealthRequest.countDocuments({ status: "pending" }),
      Insemination.countDocuments({
        inseminationDate: { $gte: ninetyDaysAgo },
      }),
      Pregnancy.countDocuments({
        createdAt: { $gte: ninetyDaysAgo },
        "pregnancyDiagnosis.result": "Pregnant",
      }),
      // 5. Total Visits Scheduled for Today (AI + Health)
      Promise.all([
        Insemination.countDocuments({
          scheduledDate: { $gte: todayStart, $lt: todayEnd },
        }),
        HealthRequest.countDocuments({
          scheduledDate: { $gte: todayStart, $lt: todayEnd },
        }),
      ]),
      // 6. Total Completed Today
      Promise.all([
        Insemination.countDocuments({
          status: "done",
          updatedAt: { $gte: todayStart, $lt: todayEnd },
        }),
        HealthRequest.countDocuments({
          status: "resolved",
          updatedAt: { $gte: todayStart, $lt: todayEnd },
        }),
      ]),
      // Data Streams (Using .lean() for performance)
      Insemination.find({
        status: { $in: ["pending", "approved", "scheduled", "in-progress"] },
        deletedAt: null,
        ...hideDeclinedForMe,
      })
        .populate("farmerId", "name address farmLocation")
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
        .populate("farmerId", "name address farmLocation")
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
      }),
      Pregnancy.countDocuments({
        createdAt: { $gte: monthStart },
        deletedAt: null,
      }),
      Calving.countDocuments({
        createdAt: { $gte: monthStart },
        deletedAt: null,
      }),
      // 8. Tasks (Claimed/Scheduled tasks)
      Task.find({
        status: { $in: ["Pending", "In Progress"] },
        dueDate: { $ne: null },
        ...(req.user.role !== "admin" ? { technicianId: req.user._id } : {}),
      })
        .populate("farmerId", "name address farmLocation")
        .populate("animalIds", "animalId earTag imageUrl breed species")
        .sort({ dueDate: 1, createdAt: -1 })
        .lean(),
    ]);

    // 2. Fetch Success Rate from Cache or Calculate
    const totalInsem_90 = await Insemination.countDocuments({
      inseminationDate: { $gte: ninetyDaysAgo },
    });
    const successRate =
      totalInsem_90 > 0
        ? Math.min(100, (totalPreg_90 / totalInsem_90) * 100).toFixed(1) + "%"
        : "0%";

    // 2. FORMAT DATA
    const cleanAddressPart = (value) => {
      const normalized = String(value || "").trim();
      return normalized && !["n/a", "na", "none", "null", "undefined"].includes(normalized.toLowerCase())
        ? normalized
        : "";
    };

    const formatAddress = (addr) => {
      if (!addr) return "Unknown Location";
      if (typeof addr === "string") return addr;
      if (Array.isArray(addr) && addr.length > 0) {
        const first = addr[0];
        return [first.barangay, first.city || first.municipality]
          .map(cleanAddressPart)
          .filter(Boolean)
          .join(", ") || "Unknown Location";
      }
      if (typeof addr === "object") {
        return [addr.barangay, addr.city || addr.municipality]
          .map(cleanAddressPart)
          .filter(Boolean)
          .join(", ") || "Unknown Location";
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
        ) &&
        new Date(itemDisplayDate) < todayStart;
      const isReadyToday =
        ["approved", "scheduled"].includes(ins.status) &&
        new Date(itemDisplayDate) >= todayStart &&
        new Date(itemDisplayDate) < todayEnd;

      const item = {
        id: ins._id,
        type: "insemination",
        serviceType: "Artificial Insemination",
        status: ins.status,
        isReadyToday,
        time: formatTime(itemDisplayDate),
        preferredTime: formatTime(itemDisplayDate),
        displayDate: itemDisplayDate,
        farmer: ins.farmerId?.name || "Unknown Farmer",
        farmerName: ins.farmerId?.name || "Unknown Farmer",
        location: formatAddress(ins.farmerId?.address),
        ...farmLocationDetails,
        animalTag:
          ins.animalId?.earTag || ins.animalId?.animalId || null,
        displayStatus: isReadyToday ? "Ready Today" : ins.status,
        task: isMobileRequest
          ? `AI Request (Attempt #${ins.attemptNumber || 1}) - ${ins.animalId?.animalId || ins.animalId?.earTag || "Unknown"}`
          : `AI Service (Attempt #${ins.attemptNumber || 1}) - ${ins.animalId?.animalId || ins.animalId?.earTag || "Unknown"}`,
        urgent: isMobileRequest,
        overdue: isOverdue,
        sentTime: formatTime(ins.createdAt),
        raw: ins,
      };

      if (
        ["pending", "approved", "scheduled", "in-progress"].includes(
          ins.status,
        )
      ) {
        pendingRequests.push(item);
      }

      if (
        isFull ||
        (itemDisplayDate >= todayStart && itemDisplayDate < todayEnd) ||
        isOverdue
      ) {
        if (ins.status !== "pending") {
          agendaItems.push(item);
        }
      }
    });

    // Process Health Requests
    healthReqs.forEach((req) => {
      const farmLocationDetails = getFarmLocationDetails(req.farmerId);
      const itemDisplayDate =
        req.status === "resolved" || req.status === "done"
          ? req.scheduledDate || req.preferredDate || req.createdAt // Health doesn't have inseminationDate
          : req.scheduledDate || req.preferredDate || req.createdAt;

      const isOverdue =
        [
          "pending",
          "triaged",
          "assigned",
          "approved",
          "scheduled",
          "in-progress",
          "in_progress",
        ].includes(req.status) &&
        new Date(itemDisplayDate) < todayStart;
      const isReadyToday =
        ["approved", "scheduled"].includes(req.status) &&
        new Date(itemDisplayDate) >= todayStart &&
        new Date(itemDisplayDate) < todayEnd;

      const item = {
        id: req._id,
        type: "health",
        serviceType: req.requestType || "Health Assistance",
        status: req.status,
        isReadyToday,
        time: formatTime(itemDisplayDate),
        preferredTime: formatTime(itemDisplayDate),
        displayDate: itemDisplayDate,
        farmer: req.farmerId?.name || "Unknown Farmer",
        farmerName: req.farmerId?.name || "Unknown Farmer",
        location: formatAddress(req.farmerId?.address),
        ...farmLocationDetails,
        animalTag:
          req.animalId?.earTag || req.animalId?.animalId || null,
        displayStatus: isReadyToday ? "Ready Today" : req.status,
        task: `Health Check - ${req.animalId?.animalId || req.animalId?.earTag || "Unknown"}`,
        urgent: ["high", "emergency"].includes(req.urgency),
        overdue: isOverdue,
        sentTime: formatTime(req.createdAt),
        raw: req,
      };

      if (
        [
          "pending",
          "triaged",
          "assigned",
          "approved",
          "scheduled",
          "in-progress",
          "in_progress",
        ].includes(req.status)
      ) {
        pendingRequests.push(item);
      }

      if (
        isFull ||
        (itemDisplayDate >= todayStart && itemDisplayDate < todayEnd) ||
        isOverdue
      ) {
        if (req.status !== "pending") {
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
        farmer: taskDoc.farmerId?.name || "Unknown Farmer",
        farmerName: taskDoc.farmerId?.name || "Unknown Farmer",
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
        urgent: taskDoc.category === "Urgent" || taskDoc.category === "Emergency",
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
    pendingRequests.sort(
      (a, b) => new Date(b.raw.createdAt) - new Date(a.raw.createdAt),
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
    const [records, total, totalCycles, confirmedPregnant, pendingChecks] = await Promise.all([
      Insemination.find(query)
        .populate("farmerId", "name phoneNumber address")
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
      data: records,
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
      data: records,
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
    } = req.body;

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
      if (!animalDetails?.animalId && !animalDetails?.earTag) {
        return res
          .status(400)
          .json({ message: "Animal details are required." });
      }
      const newAnimalId =
        animalDetails.animalId || `ANM-${Date.now().toString().slice(-6)}`;
      animal = await Animal.create({
        farmerId: farmer._id,
        animalId: newAnimalId,
        earTag: animalDetails.earTag || undefined,
        species: animalDetails.species || "Cattle",
        breed: animalDetails.breed || "Crossbreed",
        color: animalDetails.color || "Not Provided",
        gender: "Female",
        barangay: farmer.address?.barangay || "Not Provided",
        isVerified: true,
      });
    }

    // Gender check
    if (animal.gender !== "Female") {
      return res.status(400).json({
        message:
          `Insemination is restricted to female animals only. This animal is registered as ${animal.gender || "unknown"}.`,
      });
    }

    const ageCheck = checkInseminationAgeEligibility(
      animal.birthDate,
      animal.species,
    );
    if (!ageCheck.isEligible) {
      return res.status(400).json({ message: ageCheck.reason });
    }

    if (animal.reproductiveStatus === "Pregnant") {
      return res.status(400).json({
        message:
          "This animal is currently marked as pregnant. Record calving or update the pregnancy outcome before recording another AI.",
      });
    }

    if (animal.lastCalvingDate) {
      const targetDate =
        inseminationDetails?.inseminationDate ||
        new Date().toISOString().split("T")[0];
      const windowCheck = verifyPostpartumWindow(
        animal.lastCalvingDate,
        targetDate,
        animal.species,
        animal.breed,
      );
      if (!windowCheck.isSafe) {
        return res.status(400).json({
          message: `Postpartum recovery period is not complete. ${windowCheck.daysPassed} day(s) have passed; ${windowCheck.requiredDays} day(s) are required before insemination.`,
        });
      }
    }

    // Combine date and time into a single timestamp
    const entryDateString =
      inseminationDetails?.inseminationDate ||
      new Date().toISOString().split("T")[0];
    const entryTimeString = inseminationDetails?.time || "08:00";
    const entryDate = new Date(
      `${entryDateString}T${entryTimeString}:00+08:00`,
    );
    if (Number.isNaN(entryDate.getTime())) {
      return res.status(400).json({ message: "A valid AI service date and time are required." });
    }
    if (entryDate.getTime() > Date.now() + 5 * 60 * 1000) {
      return res.status(400).json({ message: "AI service date cannot be in the future." });
    }

    const insemination = await createAIRequestWithGuard({
      farmerId: farmer._id,
      animalId: animal._id,
      inseminationDate: entryDate,
      scheduledDate: entryDate, // Ensure walk-ins show up on the schedule
      preferredDate: entryDate, // Ensure requested date matches for walk-ins
      sireBreed: inseminationDetails?.sireBreed,
      sireCode: inseminationDetails?.sireCode,
      estrus: inseminationDetails?.estrus || "Natural",
      status: inseminationDetails?.status || "in-progress",
      approvedBy: req.user._id,
    });

    // Sync Animal Status if marked as 'done'
    if (insemination.status === "done") {
      await Animal.findByIdAndUpdate(animal._id, {
        reproductiveStatus: "Inseminated",
      });
      console.log(
        `[Status Sync] Animal ${animal._id} set to Inseminated via walkInInsemination.`,
      );
    }

    // Notify Farmer
    await Notification.create({
      recipientId: farmer._id,
      senderId: req.user._id,
      type: "ai-request",
      relatedId: insemination._id,
      title: "Field AI Recorded",
      message: `A field insemination has been recorded for your animal (${animal.earTag}) by technician ${req.user.name}.`,
    });

    // Trigger Socket Update
    req.app
      .get("io")
      .emit("dashboardUpdate", { type: "WALKIN_INSEMINATION_CREATED" });

    res.status(201).json({
      message: "Walk-in insemination recorded successfully",
      insemination,
      farmer,
      animal,
    });
  } catch (error) {
    console.error("[walkInInsemination ERROR]", error);
    res
      .status(error.status || 500)
      .json({
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
        technicianName: ins.technicianNote || "Field Technician",
        // Extended Details
        details: {
          sireBreed: ins.sireBreed,
          sireCode: ins.sireCode,
          attemptNumber: ins.attemptNumber,
          estrus: ins.estrus,
          outcome: ins.outcome,
        },
      });
    });

    // - Pregnancy Checks
    pregnancies.forEach((p) => {
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
      inseminations,
      pregnancies,
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
    const { animalId, result, technicianNote, inseminationId, diagnosisDate, taskId } = req.body;
    console.log(
      `[recordPregnancyCheck] Recording result for Animal: ${animalId}, Insem: ${inseminationId}, Result: ${result}, Task: ${taskId || "None"}`,
    );

    if (!animalId || !result || !inseminationId) {
      return res.status(400).json({
        message: "Missing required fields: animalId, result, or inseminationId",
      });
    }

    const animal = await Animal.findById(animalId);
    if (!animal) return res.status(404).json({ message: "Animal not found" });

    const insemination = await Insemination.findOne({
      _id: inseminationId,
      animalId,
      deletedAt: null,
    });
    if (!insemination) {
      return res.status(404).json({
        message:
          "Insemination attempt not found for this animal. Please select a valid AI record.",
      });
    }

    if (insemination.outcome && insemination.outcome !== "Pending") {
      return res.status(400).json({
        message: "Pregnancy outcome already determined for this insemination attempt.",
      });
    }

    // PROTECTION 1: Don't allow diagnosing a cow that's already pregnant
    if (animal.reproductiveStatus === "Pregnant") {
      return res.status(400).json({
        message: "Animal is already marked as pregnant.",
      });
    }

    // PROTECTION 2: Stop overwriting old records
    const existingPregnancy = await Pregnancy.findOne({ inseminationId });
    if (existingPregnancy) {
      return res.status(400).json({
        message:
          "Pregnancy diagnosis already recorded for this insemination attempt.",
      });
    }

    const pregnancy = await persistPregnancyDiagnosis({
      animal,
      insemination,
      result,
      technicianNote,
      diagnosisDate,
      taskId,
      actorId: req.user._id,
    });

    if (animal.farmerId) {
      try {
        const title =
          result === "Pregnant"
            ? "🎉 Pregnancy Confirmed!"
            : "Pregnancy Check Outcome";
        const message =
          result === "Pregnant"
            ? `Great news! Animal Tag #${animal.earTag || animal.animalId} has been confirmed pregnant by technician ${req.user.name}. Expected calving date is around ${pregnancy.targetCalvingDate ? new Date(pregnancy.targetCalvingDate).toLocaleDateString() : "the calculated target"}.`
            : `The pregnancy check for animal Tag #${animal.earTag || animal.animalId} resulted in: Empty. We recommend monitoring her for signs of heat and scheduling another A.I. attempt when appropriate.`;

        await Notification.create({
          recipientId: animal.farmerId,
          senderId: req.user._id,
          type: "ai-request",
          relatedId: inseminationId,
          title,
          message,
        });
      } catch (notifErr) {
        console.error("[recordPregnancyCheck NOTIF ERROR]", notifErr.message);
      }
    }

    // Trigger Inngest if Pregnant
    if (result === "Pregnant") {
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

    res.status(201).json({ message: "Pregnancy check recorded", pregnancy });
  } catch (error) {
    console.error("[recordPregnancyCheck ERROR]", error);
    const transactionUnavailable = /Transaction numbers are only allowed|replica set|mongos/i.test(error.message);
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

    const { calving, offspring: registeredCalves, outcome, alreadyRecorded } = await persistCalving({
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
    const transactionUnavailable = /Transaction numbers are only allowed|replica set|mongos/i.test(error.message);
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

    await Notification.create({
      recipientId: farmer._id,
      senderId: req.user._id,
      type: "system",
      relatedId: animal._id,
      title: "New Animal Registered",
      message: `A new ${species} (${breed}) with Tag #${earTag} has been added by technician ${req.user.name}.`,
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
            _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
            health: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      Pregnancy.aggregate([
        { $match: { createdAt: { $gte: sixMonthsAgo }, deletedAt: null } },
        {
          $group: {
            _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
            pregnancy: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      Calving.aggregate([
        { $match: { createdAt: { $gte: sixMonthsAgo }, deletedAt: null } },
        {
          $group: {
            _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
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
          month: new Date(row._id.year, row._id.month - 1).toLocaleString("en-US", { month: "short" }),
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
    message: "Official pregnancy records cannot be deleted. Use the correction endpoint with an audit reason.",
    code: "OFFICIAL_RECORD_CORRECTION_REQUIRED",
  });
};

export const deleteCalving = async (req, res) => {
  return res.status(405).json({
    message: "Official calving records cannot be deleted. Use the correction endpoint with an audit reason.",
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
    const isTech = req.user?.role === "technician";
    const userId = req.user?._id;

    const insemQuery = isTech
      ? { technicianId: userId, imageUrl: { $exists: true, $ne: "" } }
      : { imageUrl: { $exists: true, $ne: "" } };

    const healthQuery = isTech
      ? { handledBy: userId, imageUrl: { $exists: true, $ne: "" } }
      : { imageUrl: { $exists: true, $ne: "" } };

    const noteQuery = isTech ? { technicianId: userId } : {};

    const [inseminations, healthRequests, technicianNotes] = await Promise.all([
      Insemination.find(insemQuery)
        .populate("farmerId", "name phoneNumber address")
        .populate("animalId", "animalId earTag breed species imageUrl")
        .sort({ createdAt: -1 })
        .lean(),
      HealthRequest.find(healthQuery)
        .populate("farmerId", "name phoneNumber address")
        .populate("animalId", "animalId earTag breed species imageUrl")
        .sort({ createdAt: -1 })
        .lean(),
      FieldNote.find(noteQuery)
        .populate("technicianId", "name")
        .populate("farmerId", "name phoneNumber address")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const notes = [
      ...inseminations.map((ins) => ({
        id: ins._id,
        type: "insemination",
        farmer: ins.farmerId?.name || "Unknown Farmer",
        farmerPhone: ins.farmerId?.phoneNumber || "No Phone",
        animalTag: ins.animalId?.animalId || ins.animalId?.earTag || "No Tag",
        animalSpecies: ins.animalId?.species || "Cattle",
        animalBreed: ins.animalId?.breed || "Crossbreed",
        imageUrl: ins.imageUrl,
        note: ins.comment || "No comment provided.",
        date: ins.createdAt,
        status: ins.status,
        isArchived: !!ins.deletedAt,
      })),
      ...healthRequests.map((hr) => ({
        id: hr._id,
        type: "health",
        farmer: hr.farmerId?.name || "Unknown Farmer",
        farmerPhone: hr.farmerId?.phoneNumber || "No Phone",
        animalTag: hr.animalId?.animalId || hr.animalId?.earTag || "No Tag",
        animalSpecies: hr.animalId?.species || "Cattle",
        animalBreed: hr.animalId?.breed || "Crossbreed",
        imageUrl: hr.imageUrl,
        note: hr.symptoms || "No symptoms/notes provided.",
        date: hr.createdAt,
        status: hr.status,
        isArchived: !!hr.deletedAt,
      })),
      ...technicianNotes.map((tn) => ({
        id: tn._id,
        type: "technician-note",
        farmer: tn.farmerName || tn.farmerId?.name || "General Note",
        farmerPhone: tn.farmerId?.phoneNumber || "N/A",
        animalTag: "N/A",
        animalSpecies: "N/A",
        animalBreed: "N/A",
        imageUrl: tn.imageUrl,
        note: `[${tn.title}] ${tn.description || "No description."}`,
        date: tn.createdAt,
        status: "recorded",
        latitude: tn.latitude,
        longitude: tn.longitude,
        author: tn.technicianId?.name || "Technician",
        isArchived: !!tn.deletedAt,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

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
    const { title, description, imageUrl, farmerName, latitude, longitude } =
      req.body;

    if (!title) {
      return res.status(400).json({ message: "Note title is required" });
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

    // Attempt to resolve farmerId if farmerName matches an existing farmer
    let farmerId = null;
    if (farmerName) {
      const farmer = await User.findOne({
        name: { $regex: new RegExp(farmerName, "i") },
        role: "farmer",
      });
      if (farmer) {
        farmerId = farmer._id;
      }
    }

    const fieldNote = await FieldNote.create({
      technicianId,
      farmerId,
      farmerName: farmerName || "General Note",
      title,
      description,
      imageUrl: finalImageUrl || "",
      latitude: latitude || "",
      longitude: longitude || "",
    });

    req.app.get("io").emit("dashboardUpdate", {
      type: "FIELD_NOTE_CREATED",
      message: `Technician ${req.user.name} uploaded a new field note: ${title}`,
    });

    res
      .status(201)
      .json({ message: "Field note saved successfully", fieldNote });
  } catch (error) {
    console.error("[createFieldNote ERROR]", error);
    res
      .status(500)
      .json({ message: "Failed to save field note", error: error.message });
  }
};

export const getTechnicianFieldNotes = async (req, res) => {
  try {
    const technicianId = req.user._id;

    const [inseminations, healthRequests, technicianNotes] = await Promise.all([
      Insemination.find({
        technicianId,
        imageUrl: { $exists: true, $ne: "" },
        deletedAt: null,
      })
        .populate("farmerId", "name phoneNumber address")
        .populate("animalId", "animalId earTag breed species imageUrl")
        .sort({ createdAt: -1 })
        .lean(),
      HealthRequest.find({
        handledBy: technicianId,
        imageUrl: { $exists: true, $ne: "" },
        deletedAt: null,
      })
        .populate("farmerId", "name phoneNumber address")
        .populate("animalId", "animalId earTag breed species imageUrl")
        .sort({ createdAt: -1 })
        .lean(),
      FieldNote.find({
        technicianId,
        deletedAt: null,
      })
        .populate("technicianId", "name")
        .populate("farmerId", "name phoneNumber address")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const notes = [
      ...inseminations.map((ins) => ({
        _id: ins._id,
        id: ins._id,
        type: "insemination",
        farmerName: ins.farmerId?.name || "Unknown Farmer",
        farmer: ins.farmerId?.name || "Unknown Farmer",
        farmerPhone: ins.farmerId?.phoneNumber || "No Phone",
        animalTag: ins.animalId?.animalId || ins.animalId?.earTag || "No Tag",
        animalSpecies: ins.animalId?.species || "Cattle",
        animalBreed: ins.animalId?.breed || "Crossbreed",
        imageUrl: ins.imageUrl,
        title: "Insemination Upload",
        description: ins.comment || "No comment provided.",
        createdAt: ins.createdAt,
        status: ins.status,
        isArchived: !!ins.deletedAt,
      })),
      ...healthRequests.map((hr) => ({
        _id: hr._id,
        id: hr._id,
        type: "health",
        farmerName: hr.farmerId?.name || "Unknown Farmer",
        farmer: hr.farmerId?.name || "Unknown Farmer",
        farmerPhone: hr.farmerId?.phoneNumber || "No Phone",
        animalTag: hr.animalId?.animalId || hr.animalId?.earTag || "No Tag",
        animalSpecies: hr.animalId?.species || "Cattle",
        animalBreed: hr.animalId?.breed || "Crossbreed",
        imageUrl: hr.imageUrl,
        title: `${hr.requestType?.toUpperCase() || "HEALTH"} Request`,
        description: hr.symptoms || "No symptoms/notes provided.",
        createdAt: hr.createdAt,
        status: hr.status,
        isArchived: !!hr.deletedAt,
      })),
      ...technicianNotes.map((tn) => ({
        _id: tn._id,
        id: tn._id,
        type: "technician-note",
        farmerName: tn.farmerName || tn.farmerId?.name || "General Note",
        farmer: tn.farmerId?.name || "General Note",
        farmerPhone: tn.farmerId?.phoneNumber || "N/A",
        animalTag: "N/A",
        animalSpecies: "N/A",
        animalBreed: "N/A",
        imageUrl: tn.imageUrl,
        title: tn.title,
        description: tn.description || "No description.",
        createdAt: tn.createdAt,
        status: "recorded",
        latitude: tn.latitude,
        longitude: tn.longitude,
        author: tn.technicianId?.name || "Technician",
        isArchived: !!tn.deletedAt,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
    const { type } = req.query;

    let targetType = type;
    if (!targetType) {
      const fn = await FieldNote.findById(id);
      if (fn) {
        targetType = "technician-note";
      } else {
        const ins = await Insemination.findById(id);
        if (ins) {
          targetType = "insemination";
        } else {
          const hr = await HealthRequest.findById(id);
          if (hr) {
            targetType = "health";
          }
        }
      }
    }

    if (targetType === "insemination") {
      const ins = await Insemination.findOne({
        _id: id,
        technicianId: req.user._id,
      });
      if (!ins) {
        return res
          .status(404)
          .json({ message: "Insemination record not found or unauthorized" });
      }
      await Insemination.findByIdAndDelete(id);
    } else if (targetType === "health") {
      const hr = await HealthRequest.findOne({
        _id: id,
        handledBy: req.user._id,
      });
      if (!hr) {
        return res
          .status(404)
          .json({ message: "Health request record not found or unauthorized" });
      }
      await HealthRequest.findByIdAndDelete(id);
    } else {
      const fn = await FieldNote.findOne({
        _id: id,
        technicianId: req.user._id,
      });
      if (!fn) {
        return res
          .status(404)
          .json({ message: "Field note not found or unauthorized" });
      }
      await FieldNote.findByIdAndDelete(id);
    }

    res.status(200).json({ message: "Field note deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete field note", error: error.message });
  }
};

export const deleteFieldNoteRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, permanent } = req.query;
    const isPermanent = permanent === "true";

    if (type === "insemination") {
      if (isPermanent) {
        await Insemination.findByIdAndDelete(id);
      } else {
        await Insemination.findByIdAndUpdate(id, {
          $set: { deletedAt: new Date() },
          $unset: { activeRequestKey: 1 },
        });
      }
      res
        .status(200)
        .json({
          message: `Insemination field note ${isPermanent ? "permanently" : "soft"} deleted successfully`,
        });
    } else if (type === "health") {
      if (isPermanent) {
        await HealthRequest.findByIdAndDelete(id);
      } else {
        await HealthRequest.findByIdAndUpdate(id, {
          $set: { deletedAt: new Date() },
          $unset: { activeCaseKey: 1 },
        });
      }
      res
        .status(200)
        .json({
          message: `Health request field note ${isPermanent ? "permanently" : "soft"} deleted successfully`,
        });
    } else {
      if (isPermanent) {
        await FieldNote.findByIdAndDelete(id);
      } else {
        await FieldNote.findByIdAndUpdate(id, {
          $set: { deletedAt: new Date() },
        });
      }
      res
        .status(200)
        .json({
          message: `Field note ${isPermanent ? "permanently" : "soft"} deleted successfully`,
        });
    }
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
      return res.status(403).json({ message: "Farmers cannot claim technician requests." });
    }

    if (!["ai", "health", "breeding_verification"].includes(type)) {
      return res.status(400).json({ message: "Invalid request type." });
    }

    let updated = null;

    if (type === "ai") {
      const existing = await Insemination.findById(id);
      if (!existing) {
        return res.status(404).json({ message: "AI request record not found." });
      }
      if (existing.approvedBy) {
        return res.status(409).json({
          message: "This request has already been claimed by another technician.",
          code: "REQUEST_ALREADY_CLAIMED"
        });
      }

      updated = await Insemination.findOneAndUpdate(
        {
          _id: id,
          deletedAt: null,
          approvedBy: { $in: [null, undefined] }
        },
        {
          $set: {
            approvedBy: req.user._id,
            claimedAt: new Date(),
            status: "approved",
            activeRequestKey: activeRequestKeyForAnimal(existing.animalId),
          }
        },
        { new: true }
      )
        .populate("farmerId", "name address imageUrl phoneNumber")
        .populate("animalId", "animalId earTag species breed imageUrl");
    } else if (type === "health") {
      const existing = await HealthRequest.findById(id);
      if (!existing) {
        return res.status(404).json({ message: "Health request record not found." });
      }
      if (existing.handledBy) {
        return res.status(409).json({
          message: "This request has already been claimed by another technician.",
          code: "REQUEST_ALREADY_CLAIMED"
        });
      }

      updated = await HealthRequest.findOneAndUpdate(
        {
          _id: id,
          deletedAt: null,
          handledBy: { $in: [null, undefined] }
        },
        {
          $set: {
            handledBy: req.user._id,
            assignedTechnicianId: req.user._id,
            claimedAt: new Date(),
            status: "approved",
            activeCaseKey: activeHealthCaseKey(existing.animalId, existing.requestType),
          }
        },
        { new: true }
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
          message: "This request has already been claimed by another technician.",
          code: "REQUEST_ALREADY_CLAIMED"
        });
      }

      updated = await Task.findOneAndUpdate(
        {
          _id: id,
          taskType: "PD",
          technicianId: { $in: [null, undefined] }
        },
        {
          $set: {
            technicianId: req.user._id,
            claimedAt: new Date()
          }
        },
        { new: true }
      )
        .populate("farmerId", "name address imageUrl phoneNumber")
        .populate("animalIds", "animalId earTag species breed imageUrl");
    }

    if (!updated) {
      return res.status(409).json({
        message: "This request has already been claimed by another technician.",
        code: "REQUEST_ALREADY_CLAIMED"
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
      data: updated
    });
  } catch (error) {
    console.error("[claimRequest ERROR]", error);
    return res.status(500).json({
      message: "Failed to claim request.",
      error: error.message
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

    // Apply municipality/barangay filters if provided
    if (municipality || barangay) {
      const addressQuery = {};
      if (municipality) {
        addressQuery["address.city"] = { $regex: new RegExp(`^${municipality}$`, "i") };
      }
      if (barangay) {
        addressQuery["address.barangay"] = { $regex: new RegExp(`^${barangay}$`, "i") };
      }
      const matchingFarmers = await User.find({
        role: "farmer",
        ...addressQuery
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
    if (req.user.role !== "admin") {
      if (assignment === "mine") {
        aiQuery.approvedBy = req.user._id;
        healthQuery.handledBy = req.user._id;
        taskQuery.technicianId = req.user._id;
      } else if (assignment === "unassigned" || assignment === "available") {
        aiQuery.approvedBy = { $in: [null, undefined] };
        healthQuery.handledBy = { $in: [null, undefined] };
        taskQuery.technicianId = { $in: [null, undefined] };
        aiQuery.declinedByTechnicianIds = { $ne: req.user._id };
        healthQuery.declinedByTechnicianIds = { $ne: req.user._id };
        
        aiQuery.status = "pending";
        healthQuery.status = { $in: ["pending", "triaged", "assigned"] };
        taskQuery.status = "Pending";
      } else if (assignment === "all") {
        // No assignment filter
      } else {
        // Default: Show mine or unassigned
        aiQuery.approvedBy = { $in: [req.user._id, null, undefined] };
        healthQuery.handledBy = { $in: [req.user._id, null, undefined] };
        taskQuery.technicianId = { $in: [req.user._id, null, undefined] };
        aiQuery.declinedByTechnicianIds = { $ne: req.user._id };
        healthQuery.declinedByTechnicianIds = { $ne: req.user._id };
      }

      if (status !== "declined") {
        aiQuery.declinedByTechnicianIds = { $ne: req.user._id };
        healthQuery.declinedByTechnicianIds = { $ne: req.user._id };
      }
    } else {
      if (assignment === "mine") {
        aiQuery.approvedBy = req.user._id;
        healthQuery.handledBy = req.user._id;
        taskQuery.technicianId = req.user._id;
      } else if (assignment === "unassigned" || assignment === "available") {
        aiQuery.approvedBy = { $in: [null, undefined] };
        healthQuery.handledBy = { $in: [null, undefined] };
        taskQuery.technicianId = { $in: [null, undefined] };
        
        aiQuery.status = "pending";
        healthQuery.status = { $in: ["pending", "triaged", "assigned"] };
        taskQuery.status = "Pending";
      } else if (assignment === "all") {
        // No assignment filter
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

      aiQuery.$or = [
        { farmerId: { $in: farmerIds } },
        { animalId: { $in: animalIds } },
      ];
      healthQuery.$or = [
        { farmerId: { $in: farmerIds } },
        { animalId: { $in: animalIds } },
      ];
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
      type === "all" || type === "breeding_verification" || !type;

    const [aiRecords, healthRecords, pregnancyCheckTasks] = await Promise.all([
      fetchAI
        ? Insemination.find(aiQuery)
            .populate("farmerId", "name address imageUrl farmLocation")
            .populate("animalId", "animalId earTag species breed imageUrl")
            .populate("approvedBy", "name")
            .populate({
              path: "previousAttemptId",
              select: "attemptNumber inseminationDate outcome outcomeConfirmedAt approvedBy technicianId",
              populate: { path: "approvedBy technicianId", select: "name" },
            })
            .lean()
        : [],
      fetchHealth
        ? HealthRequest.find(healthQuery)
            .populate("farmerId", "name address imageUrl farmLocation")
            .populate("animalId", "animalId earTag species breed imageUrl")
            .populate("handledBy", "name")
            .lean()
        : [],
      fetchPregnancyChecks
        ? Task.find(taskQuery)
            .populate("farmerId", "name address imageUrl farmLocation")
            .populate("animalIds", "animalId earTag species breed imageUrl")
            .populate("technicianId", "name")
            .lean()
        : [],
    ]);

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

      let distanceKm = null;
      if (techLat !== null && !isNaN(techLat) && techLng !== null && !isNaN(techLng) && hasFarmPin) {
        distanceKm = parseFloat(getHaversineDistance(techLat, techLng, farmLoc.latitude, farmLoc.longitude).toFixed(2));
      }

      return {
        id: rec._id,
        type: "ai",
        serviceType: "Artificial Insemination",
        status: rec.status,
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
        animal: rec.animalId?.animalId || rec.animalId?.earTag || "Unknown",
        animalId: rec.animalId?._id || rec.animalId,
        earTag: rec.animalId?.earTag || "",
        breed: rec.animalId?.breed || "",
        species: rec.animalId?.species || "",
        location: formatAddress(farmer.address),
        locationLabel: barangay && city ? `${barangay}, ${city}` : (formatAddress(farmer.address) || "Unknown Location"),
        municipality: city,
        barangay: barangay,
        hasFarmPin,
        distanceKm,
        farmPinStatus: hasFarmPin ? "available" : "missing",
        preferredDate: rec.preferredDate || rec.createdAt,
        scheduledDate: rec.scheduledDate || null,
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

      let distanceKm = null;
      if (techLat !== null && !isNaN(techLat) && techLng !== null && !isNaN(techLng) && hasFarmPin) {
        distanceKm = parseFloat(getHaversineDistance(techLat, techLng, farmLoc.latitude, farmLoc.longitude).toFixed(2));
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
        animal: rec.animalId?.animalId || rec.animalId?.earTag || "Unknown",
        animalId: rec.animalId?._id || rec.animalId,
        earTag: rec.animalId?.earTag || "",
        breed: rec.animalId?.breed || "",
        species: rec.animalId?.species || "",
        location: formatAddress(farmer.address),
        locationLabel: barangay && city ? `${barangay}, ${city}` : (formatAddress(farmer.address) || "Unknown Location"),
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

      const farmer = task.farmerId || {};
      const farmLoc = farmer.farmLocation || {};
      const addr = farmer.address || {};
      const hasFarmPin = !!(farmLoc.latitude && farmLoc.longitude);
      const city = addr.city || "";
      const barangay = addr.barangay || "";

      let distanceKm = null;
      if (techLat !== null && !isNaN(techLat) && techLng !== null && !isNaN(techLng) && hasFarmPin) {
        distanceKm = parseFloat(getHaversineDistance(techLat, techLng, farmLoc.latitude, farmLoc.longitude).toFixed(2));
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
        animal: animal?.animalId || animal?.earTag || "Unknown",
        animalId: animal?._id || animal,
        earTag: animal?.earTag || "",
        breed: animal?.breed || "",
        species: animal?.species || "",
        location: formatAddress(farmer.address),
        locationLabel: barangay && city ? `${barangay}, ${city}` : (formatAddress(farmer.address) || "Unknown Location"),
        municipality: city,
        barangay: barangay,
        hasFarmPin,
        distanceKm,
        farmPinStatus: hasFarmPin ? "available" : "missing",
        preferredDate: task.dueDate || task.createdAt,
        scheduledDate: task.dueDate || null,
        assignedTechnician: task.technicianId?.name || "",
        createdAt: task.createdAt,
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
        return new Date(a.preferredDate).getTime() - new Date(b.preferredDate).getTime();
      } else if (sortByVal === "oldest") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
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
    res
      .status(500)
      .json({
        message: "Failed to fetch technician requests",
        error: error.message,
      });
  }
};
