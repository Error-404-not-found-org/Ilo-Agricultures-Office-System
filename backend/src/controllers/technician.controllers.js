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
import { inngest } from "../config/inngest.js";
import {
  verifyPostpartumWindow,
  calculateTargetCalvingDate,
} from "../utils/cattleCore.js";

export const getTechnicianDashboardData = async (req, res) => {
  try {
    const { fullAgenda } = req.query;
    const isFull = fullAgenda === "true";

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
        status: { $in: ["pending", "approved", "in-progress"] },
        deletedAt: null,
      })
        .populate("farmerId", "name address")
        .populate("animalId", "animalId earTag imageUrl breed species")
        .populate("approvedBy", "name")
        .sort({ createdAt: -1 })
        .lean(),

      HealthRequest.find({
        status: { $in: ["pending", "in-progress"] },
        deletedAt: null,
      })
        .populate("farmerId", "name address")
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

    const formatTime = (date) => {
      if (!date) return "Not Set";
      return new Date(date).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Manila",
      });
    };

    const pendingRequests = [];
    const agendaItems = [];

    // Process Inseminations
    inseminations.forEach((ins) => {
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
        ["pending", "approved", "in-progress"].includes(ins.status) &&
        new Date(itemDisplayDate) < todayStart;

      const item = {
        id: ins._id,
        type: "insemination",
        status: ins.status,
        time: formatTime(itemDisplayDate),
        displayDate: itemDisplayDate,
        farmer: ins.farmerId?.name || "Unknown Farmer",
        location: formatAddress(ins.farmerId?.address),
        task: isMobileRequest
          ? `AI Request (Attempt #${ins.attemptNumber || 1}) - ${ins.animalId?.animalId || ins.animalId?.earTag || "Unknown"}`
          : `AI Service (Attempt #${ins.attemptNumber || 1}) - ${ins.animalId?.animalId || ins.animalId?.earTag || "Unknown"}`,
        urgent: isMobileRequest,
        overdue: isOverdue,
        sentTime: formatTime(ins.createdAt),
        raw: ins,
      };

      if (["pending", "approved", "in-progress"].includes(ins.status)) {
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
      const itemDisplayDate =
        req.status === "resolved" || req.status === "done"
          ? req.scheduledDate || req.preferredDate || req.createdAt // Health doesn't have inseminationDate
          : req.scheduledDate || req.preferredDate || req.createdAt;

      const isOverdue =
        ["pending", "in-progress"].includes(req.status) &&
        new Date(itemDisplayDate) < todayStart;

      const item = {
        id: req._id,
        type: "health",
        status: req.status,
        time: formatTime(itemDisplayDate),
        displayDate: itemDisplayDate,
        farmer: req.farmerId?.name || "Unknown Farmer",
        location: formatAddress(req.farmerId?.address),
        task: `Health Check - ${req.animalId?.animalId || req.animalId?.earTag || "Unknown"}`,
        urgent: req.urgency === "high",
        overdue: isOverdue,
        sentTime: formatTime(req.createdAt),
        raw: req,
      };

      if (["pending", "in-progress"].includes(req.status)) {
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

    const [records, total] = await Promise.all([
      Insemination.find({ deletedAt: null })
        .populate("farmerId", "name phoneNumber address")
        .populate("animalId", "animalId earTag breed species imageUrl")
        .populate("pregnancyId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Insemination.countDocuments({ deletedAt: null }),
    ]);

    res.status(200).json({
      inseminations: records,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
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
        .populate("animalId", "animalId earTag breed species imageUrl color brand")
        .populate("calves.animalId", "animalId earTag breed species color brand")
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
            const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").trim();
            const normalizedClientUrl = /^https?:\/\//i.test(clientUrl) ? clientUrl : `https://${clientUrl}`;
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
        barangay: farmer.address?.barangay || "Not Provided",
        isVerified: true,
      });
    }

    // Gender check
    if (animal.gender !== "Female") {
      return res.status(400).json({
        message:
          "Insemination is restricted to female animals only. This animal is registered as Male.",
      });
    }

    // --- DOUBLE REQUEST CONFIRMATION / DUPLICATE CHECK ---
    const existingActiveRequest = await Insemination.findOne({
      animalId: animal._id,
      status: { $in: ["pending", "approved", "in-progress"] },
    });

    if (existingActiveRequest) {
      return res.status(400).json({
        message: `Active AI request (${existingActiveRequest.status}) already exists for this animal.`,
      });
    }

    // 3. Record Insemination
    const lastAttempt = await Insemination.findOne({
      animalId: animal._id,
    }).sort({ attemptNumber: -1 });
    const attemptNumber = lastAttempt ? lastAttempt.attemptNumber + 1 : 1;

    // Combine date and time into a single timestamp
    const entryDateString =
      inseminationDetails?.inseminationDate ||
      new Date().toISOString().split("T")[0];
    const entryTimeString = inseminationDetails?.time || "08:00";
    const entryDate = new Date(
      `${entryDateString}T${entryTimeString}:00+08:00`,
    );

    const insemination = await Insemination.create({
      farmerId: farmer._id,
      animalId: animal._id,
      inseminationDate: entryDate,
      scheduledDate: entryDate, // Ensure walk-ins show up on the schedule
      preferredDate: entryDate, // Ensure requested date matches for walk-ins
      sireBreed: inseminationDetails?.sireBreed,
      sireCode: inseminationDetails?.sireCode,
      estrus: inseminationDetails?.estrus || "Natural",
      attemptNumber,
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
      .status(500)
      .json({ message: "Error recording insemination", error: error.message });
  }
};

export const updateInseminationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      technicianNote,
      scheduledDate,
      sireBreed,
      sireCode,
      estrus,
    } = req.body;

    const existing = await Insemination.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Record not found" });
    }

    // Concurrency guard: check if already assigned to another technician
    if (
      existing.approvedBy &&
      existing.approvedBy.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      const assignedTech = await User.findById(existing.approvedBy);
      return res.status(403).json({
        message: `This request is already being assisted by technician: ${assignedTech?.name || "another technician"}.`,
      });
    }

    const updateData = {
      status,
      technicianNote,
      scheduledDate,
      sireBreed,
      sireCode,
      estrus,
      approvedBy: req.user._id,
    };

    // If marking as done, set the official insemination date to now (if not already set)
    if (status === "done") {
      updateData.inseminationDate = new Date();
    }

    const insemination = await Insemination.findByIdAndUpdate(id, updateData, {
      returnDocument: "after",
    })
      .populate("farmerId", "name")
      .populate("animalId", "earTag");

    if (!insemination)
      return res.status(404).json({ message: "Record not found" });

    // --- IMMEDIATE STATUS SYNC ---
    if (status === "done") {
      await Animal.findByIdAndUpdate(insemination.animalId, {
        reproductiveStatus: "Inseminated",
      });
      console.log(
        `[Status Sync] Animal ${insemination.animalId} set to Inseminated via updateInseminationStatus.`,
      );
    }

    // Notify Farmer — status-specific messages
    if (insemination.farmerId && insemination.farmerId._id) {
      const animalTag = insemination.animalId?.earTag || "your animal";
      const techName = req.user?.name || "a technician";

      let notifTitle = "AI Request Update";
      let notifMessage = "";

      if (status === "approved") {
        const rescheduled = scheduledDate ? ` The visit has been scheduled on ${new Date(scheduledDate).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}.` : " No schedule date has been set yet.";
        notifTitle = "AI Request Accepted";
        notifMessage = `Your artificial insemination request for animal ${animalTag} has been accepted by Technician: ${techName}.${rescheduled}`;
      } else if (status === "in-progress") {
        const rescheduled = scheduledDate ? ` The visit is rescheduled to ${new Date(scheduledDate).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}.` : "";
        notifTitle = "AI Request In Progress";
        notifMessage = `Your artificial insemination request for animal ${animalTag} is now in progress with Technician: ${techName}.${rescheduled}`;
      } else if (status === "done") {
        notifTitle = "AI Request Completed";
        notifMessage = `Great news! The artificial insemination for animal ${animalTag} has been successfully completed by Technician: ${techName}.`;
      } else if (status === "rejected") {
        notifTitle = "AI Request Rejected";
        notifMessage = `Your artificial insemination request for animal ${animalTag} has been declined by Technician: ${techName}. Please contact the office for more details.`;
      } else {
        notifMessage = `Your artificial insemination request for animal ${animalTag} has been updated to: ${status} by Technician: ${techName}.`;
      }

      await Notification.create({
        recipientId: insemination.farmerId._id,
        senderId: req.user._id,
        type: "ai-request",
        relatedId: insemination._id,
        title: notifTitle,
        message: notifMessage,
      });
    }

    // Trigger Socket Update
    req.app
      .get("io")
      .emit("dashboardUpdate", { type: "INSEMINATION_UPDATED", status });

    // --- TRIGGER INNGEST AUTOMATION ---
    if (status === "done") {
      try {
        await inngest.send({
          name: "insemination/approved",
          data: {
            inseminationId: insemination._id,
            animalId: insemination.animalId?._id || insemination.animalId,
            farmerId: insemination.farmerId?._id || insemination.farmerId,
          },
        });
      } catch (inngestError) {
        console.error("Inngest Automation Error:", inngestError);
        // We still consider the status updated, but we notify the user that background tasks might be delayed
        return res.status(200).json({
          message:
            "Status updated, but background automation encountered an issue. Please contact support if reminders are not sent.",
          insemination,
          automationError: true,
        });
      }
    }

    res
      .status(200)
      .json({ message: "Status updated successfully", insemination });
  } catch (error) {
    console.error("UpdateInseminationStatus Error:", error);
    res.status(500).json({
      message: "Failed to update mission status. Internal Server Error.",
      error: error.message,
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
      timeline.push({
        _id: c._id,
        relatedId: c._id,
        type: "Calving",
        title: "Calving Event",
        description: `Successful birth of ${c.numberOfCalves} calf/calves. Sex distribution: [${sexDist}]. Ease: ${c.calvingEase}.`,
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
        const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").trim();
        const normalizedClientUrl = /^https?:\/\//i.test(clientUrl) ? clientUrl : `https://${clientUrl}`;
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
    const { animalId, result, technicianNote, inseminationId } = req.body;
    console.log(
      `[recordPregnancyCheck] Recording result for Animal: ${animalId}, Insem: ${inseminationId}, Result: ${result}`,
    );

    if (!animalId || !result || !inseminationId) {
      return res.status(400).json({
        message: "Missing required fields: animalId, result, or inseminationId",
      });
    }

    const animal = await Animal.findById(animalId);
    if (!animal) return res.status(404).json({ message: "Animal not found" });

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

    // Create NEW record instead of updating an upsert
    const pregnancy = await Pregnancy.create({
      animalId,
      farmerId: animal.farmerId,
      inseminationId,
      technicianNote,
      pregnancyDiagnosis: {
        date: new Date(),
        result: result, // "Pregnant" or "Empty"
      },
      targetCalvingDate:
        result === "Pregnant"
          ? calculateTargetCalvingDate(new Date(), animal.species, undefined, animal.breed)
          : undefined,
    });

    // Update Insemination outcome and ensure status is marked as done
    await Insemination.findByIdAndUpdate(inseminationId, {
      status: "done",
      outcome: result === "Pregnant" ? "Pregnant" : "Failed (Negative PD)",
      pregnancyId: pregnancy._id,
    });

    // Update Animal Reproductive Status
    await Animal.findByIdAndUpdate(animalId, {
      reproductiveStatus: result === "Pregnant" ? "Pregnant" : "Normal",
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
          type: "system",
          relatedId: pregnancy._id,
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
    res.status(500).json({
      message: "Failed to record pregnancy check",
      error: error.message,
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
      numberOfCalves,
      calves,
      technicianNote,
    } = req.body;

    // 1. Validate Mother & Pregnancy
    const mother = await Animal.findOne({ _id: animalId, deletedAt: null });
    if (!mother)
      return res.status(404).json({ message: "Mother animal not found" });

    // Chronological Calving Postpartum Firewall
    if (mother.lastCalvingDate) {
      const windowCheck = verifyPostpartumWindow(
        mother.lastCalvingDate,
        date || new Date(),
        mother.species,
        mother.breed,
      );
      if (!windowCheck.isSafe) {
        return res.status(422).json({
          message: `Warning: Calving event occurs too close to the previous calving event. Only ${windowCheck.daysPassed} days have passed, but the voluntary waiting period for ${mother.species} is ${windowCheck.requiredDays} days.`,
        });
      }
    }

    const pregnancy = await Pregnancy.findOne({
      _id: pregnancyId,
      deletedAt: null,
    }).populate("inseminationId");
    if (!pregnancy)
      return res.status(404).json({ message: "Pregnancy record not found" });

    // Check if calving record already exists to prevent E11000 duplicate key error
    const existingCalving = await Calving.findOne({ pregnancyId: pregnancy._id, deletedAt: null });
    if (existingCalving) {
      if (mother.reproductiveStatus === "Pregnant") {
         await Animal.findByIdAndUpdate(animalId, { $set: { reproductiveStatus: "Normal" } });
      }
      return res.status(400).json({ message: "A calving record already exists for this pregnancy." });
    }

    // Extract sire info from insemination if available
    const sireBreed = pregnancy.inseminationId?.sireBreed || "Unknown";

    // 2. Register Each Calf as a New Animal
    const registeredCalves = [];
    const calfRecordsForBirth = [];

    for (let i = 0; i < calves.length; i++) {
      const calfData = calves[i];

      // Generate a unique ID for the calf
      const calfAnimalId = `ANM-${Date.now().toString().slice(-6)}-${i}`;

      const newCalf = await Animal.create({
        earTag:
          calfData.earTag || `CALF-${Date.now().toString().slice(-4)}-${i}`,
        animalId: calfAnimalId,
        species: mother.species,
        breed:
          sireBreed !== "Unknown"
            ? `${mother.breed} x ${sireBreed}`
            : mother.breed,
        farmerId: mother.farmerId,
        motherId: mother._id,
        isVerified: true,
        gender: calfData.sex === "M" ? "Male" : "Female",
        color: calfData.color || mother.color || "Not Provided",
        brand: calfData.brand || mother.brand || "",
        birthDate: date || new Date(),
        barangay: mother.barangay || "Not Provided",
        activityLogs: [
          {
            event: "Initial Registration",
            date: new Date(),
            description: `Automatically registered via calving event from mother ${mother.earTag || mother.animalId}.`,
          },
        ],
      });

      registeredCalves.push(newCalf);
      calfRecordsForBirth.push({
        sex: calfData.sex,
        earTag: newCalf.earTag,
        animalId: newCalf._id,
      });
    }

    // 3. Create Calving Record
    const calving = await Calving.create({
      animalId,
      farmerId: mother.farmerId,
      pregnancyId,
      date: date || new Date(),
      numberOfCalves: numberOfCalves || registeredCalves.length,
      calves: calfRecordsForBirth,
      calvingEase,
      technicianId: req.user._id,
      technicianNote,
    });

    // 4. Update Mother's Status, lastCalvingDate & Increment Parity
    await Animal.findByIdAndUpdate(animalId, {
      $set: {
        reproductiveStatus: "Normal",
        lastCalvingDate: date || new Date(),
      },
      $inc: { parity: 1 }, // Track number of births
      $push: {
        activityLogs: {
          event: "Calving",
          date: new Date(),
          description: `Gave birth to ${numberOfCalves} calf/calves. Ease: ${calvingEase}.`,
        },
      },
    });

    // 5. Notify Farmer
    if (mother.farmerId) {
      const calfSexList = calves
        .map((c) => (c.sex === "M" ? "Male" : "Female"))
        .join(", ");
      await Notification.create({
        recipientId: mother.farmerId,
        senderId: req.user._id,
        type: "system",
        title: "🍼 New Calving Recorded",
        message: `Congratulations! Your animal Tag #${mother.earTag || mother.animalId} successfully calved ${registeredCalves.length} offspring (${calfSexList}).`,
      });
    }

    // 6. Trigger Inngest & Socket
    try {
      await inngest.send({
        name: "livestock/calving-recorded",
        data: {
          animalId,
          farmerId: mother.farmerId,
          numberOfCalves: registeredCalves.length,
          offspringIds: registeredCalves.map((c) => c._id),
        },
      });
    } catch (inngestErr) {
      console.error("[recordCalving INNGEST ERROR]", inngestErr.message);
    }

    req.app.get("io").emit("dashboardUpdate", {
      type: "CALVING_RECORDED",
      motherId: animalId,
      calvingId: calving._id,
    });

    res.status(201).json({
      message: "Calving and offspring registered successfully",
      calving,
      offspring: registeredCalves,
    });
  } catch (error) {
    console.error("[recordCalving ERROR]", error);
    res
      .status(500)
      .json({ message: "Failed to record calving", error: error.message });
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
    const [inseminations, healthReqs] = await Promise.all([
      Insemination.find({
        status: { $in: ["pending", "approved", "in-progress"] },
        deletedAt: null,
      })
        .populate("farmerId", "name address")
        .populate("animalId", "animalId earTag imageUrl breed species")
        .populate("approvedBy", "name")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      HealthRequest.find({
        status: { $in: ["pending", "in-progress"] },
        deletedAt: null,
      })
        .populate("farmerId", "name address")
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
    const formattedMonthly = monthlyData.map((m) => ({
      month: new Date(m._id.year, m._id.month - 1).toLocaleString("en-US", {
        month: "short",
      }),
      ai: m.ai,
    }));

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
  try {
    const { id } = req.params;
    const record = await Pregnancy.findByIdAndDelete(id);
    if (!record) return res.status(404).json({ message: "Record not found" });

    // Cleanup linked calving if any
    await Calving.deleteMany({ pregnancyId: id });

    res.status(200).json({ message: "Pregnancy check deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete record", error: error.message });
  }
};

export const deleteCalving = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Calving.findByIdAndDelete(id);
    if (!record) return res.status(404).json({ message: "Record not found" });

    res.status(200).json({ message: "Calving event deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete record", error: error.message });
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

    const noteQuery = isTech 
      ? { technicianId: userId } 
      : {};

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
      const ins = await Insemination.findOne({ _id: id, technicianId: req.user._id });
      if (!ins) {
        return res.status(404).json({ message: "Insemination record not found or unauthorized" });
      }
      await Insemination.findByIdAndDelete(id);
    } else if (targetType === "health") {
      const hr = await HealthRequest.findOne({ _id: id, handledBy: req.user._id });
      if (!hr) {
        return res.status(404).json({ message: "Health request record not found or unauthorized" });
      }
      await HealthRequest.findByIdAndDelete(id);
    } else {
      const fn = await FieldNote.findOne({ _id: id, technicianId: req.user._id });
      if (!fn) {
        return res.status(404).json({ message: "Field note not found or unauthorized" });
      }
      await FieldNote.findByIdAndDelete(id);
    }

    res.status(200).json({ message: "Field note deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete field note", error: error.message });
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
        });
      }
      res
        .status(200)
        .json({ message: `Insemination field note ${isPermanent ? "permanently" : "soft"} deleted successfully` });
    } else if (type === "health") {
      if (isPermanent) {
        await HealthRequest.findByIdAndDelete(id);
      } else {
        await HealthRequest.findByIdAndUpdate(id, {
          $set: { deletedAt: new Date() },
        });
      }
      res
        .status(200)
        .json({ message: `Health request field note ${isPermanent ? "permanently" : "soft"} deleted successfully` });
    } else {
      if (isPermanent) {
        await FieldNote.findByIdAndDelete(id);
      } else {
        await FieldNote.findByIdAndUpdate(id, {
          $set: { deletedAt: new Date() },
        });
      }
      res.status(200).json({ message: `Field note ${isPermanent ? "permanently" : "soft"} deleted successfully` });
    }
  } catch (error) {
    res
      .status(500)
      .json({
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
      { new: true }
    );
    if (!calving) {
      return res.status(404).json({ message: "Calving record not found" });
    }
    res.status(200).json({ message: "Calving record marked as seen", calving });
  } catch (error) {
    res.status(500).json({ message: "Error marking calving as seen", error: error.message });
  }
};
