import { User } from "../models/user.model.js";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Calving } from "../models/calving.model.js";
import { Notification } from "../models/notification.model.js";
import { AIRequest } from "../models/ai-request.model.js";
import { Config } from "../models/config.model.js";
import { clerkClient } from "@clerk/clerk-sdk-node";
import cloudinary from "../config/cloudinary.js";
import { inngest } from "../config/inngest.js";

export const getTechnicianDashboardData = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // 1. FETCH ALL STATS & DATA STREAMS IN PARALLEL
    const [
      totalInseminationsRecordToday,
      totalHealthPending,
      totalAI_90,
      totalPreg_90,
      inseminations,
      healthReqs,
      animalRegistryData
    ] = await Promise.all([
      // Stats
      Insemination.countDocuments({
        $or: [
            { scheduledDate: { $gte: todayStart, $lt: todayEnd } },
            { inseminationDate: { $gte: todayStart, $lt: todayEnd } }
        ]
      }),
      HealthRequest.countDocuments({ status: "pending" }),
      Insemination.countDocuments({ inseminationDate: { $gte: ninetyDaysAgo } }),
      Pregnancy.countDocuments({ 
        createdAt: { $gte: ninetyDaysAgo },
        "pregnancyDiagnosis.result": "Pregnant"
      }),
      // Data Streams (Using .lean() for performance)
      Insemination.find({ status: { $in: ["pending", "approved", "in-progress"] } })
        .populate("farmerId", "name address")
        .populate("animalId", "earTag imageUrl breed species")
        .sort({ createdAt: -1 })
        .lean(),
        
      HealthRequest.find({ status: { $in: ["pending", "in-progress"] } })
        .populate("farmerId", "name address")
        .populate("animalId", "earTag imageUrl breed species")
        .sort({ urgency: -1, createdAt: -1 })
        .lean(),

      // Animal Registry (Fully Optimized Aggregation)
      Animal.aggregate([
        { $sort: { createdAt: -1 } },
        { $limit: 100 }, // Fetch a slightly larger pool for sorting
        
        {
          $lookup: {
            from: "users",
            localField: "farmerId",
            foreignField: "_id",
            as: "farmer"
          }
        },
        { $unwind: { path: "$farmer", preserveNullAndEmptyArrays: true } },

        {
          $lookup: {
            from: "inseminations",
            let: { animalId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$animalId", "$$animalId"] } } },
              { $sort: { createdAt: -1 } },
              { $limit: 1 }
            ],
            as: "lastIns"
          }
        },
        { $unwind: { path: "$lastIns", preserveNullAndEmptyArrays: true } },

        {
          $lookup: {
            from: "pregnancies",
            let: { animalId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$animalId", "$$animalId"] } } },
              { $sort: { createdAt: -1 } },
              { $limit: 1 }
            ],
            as: "lastPregnancy"
          }
        },
        { $unwind: { path: "$lastPregnancy", preserveNullAndEmptyArrays: true } },

        {
          $addFields: {
            lastActivityDate: {
              $max: [
                "$createdAt",
                { $ifNull: ["$lastIns.createdAt", new Date(0)] },
                { $ifNull: ["$lastPregnancy.createdAt", new Date(0)] }
              ]
            }
          }
        },
        { $sort: { lastActivityDate: -1 } },
        { $limit: 50 }
      ])
    ]);

    // 2. Fetch Success Rate from Cache or Calculate
    let successRate = totalAI_90 > 0 ? ((totalPreg_90 / totalAI_90) * 100).toFixed(1) + "%" : "84.2%";
    try {
        const cachedStats = await Config.findOne({ key: "dashboard_success_rate" }).lean();
        if (cachedStats && cachedStats.value) {
            successRate = cachedStats.value;
        }
    } catch (e) {
        console.error("Cache fetch failed", e);
    }

    // 2. FORMAT DATA
    const formatAddress = (addr) => {
       if (!addr) return "Unknown Location";
       if (typeof addr === 'string') return addr;
       if (Array.isArray(addr) && addr.length > 0) {
          const first = addr[0];
          return `${first.barangay || ''}, ${first.city || ''}`.replace(/^,|,$/g, '').trim() || "Unknown Location";
       }
       if (typeof addr === 'object') {
          return `${addr.barangay || ''}, ${addr.city || ''}`.replace(/^,|,$/g, '').trim() || "Unknown Location";
       }
       return "Unknown Location";
    };

    const formatTime = (date) => {
      if (!date) return "Not Set";
      return new Date(date).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    };

    const pendingRequests = [];
    const agendaItems = [];

    // Process Inseminations
    inseminations.forEach(ins => {
      const isMobileRequest = !ins.sireCode && ins.status === "pending";
      const item = {
        id: ins._id,
        type: 'insemination',
        status: ins.status,
        time: formatTime(ins.scheduledDate || ins.inseminationDate || ins.createdAt),
        displayDate: ins.scheduledDate || ins.inseminationDate || ins.createdAt,
        farmer: ins.farmerId?.name || "Unknown Farmer",
        location: formatAddress(ins.farmerId?.address),
        task: isMobileRequest ? `AI Request - ${ins.animalId?.earTag || "Unknown"}` : `AI Service - ${ins.animalId?.earTag || "Unknown"}`,
        urgent: isMobileRequest,
        sentTime: formatTime(ins.createdAt),
        raw: ins
      };

      if (ins.status === "pending") {
        pendingRequests.push(item);
      } else if (ins.scheduledDate >= todayStart && ins.scheduledDate < todayEnd) {
        agendaItems.push(item);
      }
    });

    // Process Health Requests
    healthReqs.forEach(req => {
      const item = {
        id: req._id,
        type: 'health',
        status: req.status,
        time: formatTime(req.scheduledDate || req.preferredDate),
        displayDate: req.scheduledDate || req.preferredDate,
        farmer: req.farmerId?.name || "Unknown Farmer",
        location: formatAddress(req.farmerId?.address),
        task: `Health Check - ${req.animalId?.earTag || "Unknown"}`,
        urgent: req.urgency === "high",
        sentTime: formatTime(req.createdAt),
        raw: req
      };

      if (req.status === "pending") {
        pendingRequests.push(item);
      } else if (req.scheduledDate >= todayStart && req.scheduledDate < todayEnd) {
        agendaItems.push(item);
      }
    });
    
    agendaItems.sort((a,b) => new Date(a.displayDate) - new Date(b.displayDate));
    pendingRequests.sort((a,b) => new Date(b.raw.createdAt) - new Date(a.raw.createdAt));

    const animalRegistry = animalRegistryData.map(a => {
      const lastIns = a.lastIns || null;
      const lastPregnancy = a.lastPregnancy || null;

      let status = "Pending";
      let sClass = "text-yellow-600";
      let dotClass = "bg-yellow-500";
      let last = "Added";
      
      if (lastPregnancy && lastPregnancy.pregnancyDiagnosis?.result === "Pregnant") {
        status = "Pregnant";
        sClass = "text-purple-600";
        dotClass = "bg-purple-500";
        last = "Pregnancy Check";
      } 
      else if (lastIns && (lastIns.status === "approved" || lastIns.status === "done" || lastIns.status === "in-progress")) {
        status = "Inseminated";
        sClass = "text-blue-600";
        dotClass = "bg-blue-500";
        last = "Insemination";
      } 
      else if (lastIns && lastIns.status === "pending") {
        status = "Pending AI";
        sClass = "text-yellow-600";
        dotClass = "bg-yellow-500";
        last = "AI Request";
      }

      return {
        id: `#${(a.earTag || a.animalId)?.toString().substring(0,4)}`,
        rawId: a._id,
        breed: a.breed || "Crossbreed",
        status,
        sClass,
        dotClass,
        last,
        farmerName: a.farmer?.name || "Unknown",
        farmerPhone: a.farmer?.phoneNumber || "No Contact",
        imageUrl: a.imageUrl || null,
        lastActionDate: a.lastActivityDate
      };
    });

    res.status(200).json({
      stats: {
        totalInseminations: totalInseminationsRecordToday,
        healthAlerts: totalHealthPending,
        successRate
      },
      pendingRequests,
      agendaItems,
      animalRegistry
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
      Insemination.find()
        .populate("farmerId", "name phoneNumber address")
        .populate("animalId", "earTag breed species imageUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Insemination.countDocuments(),
    ]);

    res.status(200).json({
      inseminations: records,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching inseminations", error: error.message });
  }
};

export const getMyReInseminations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const query = { attemptNumber: { $gt: 1 } };

    const [records, total] = await Promise.all([
      Insemination.find(query)
        .populate("farmerId", "name phoneNumber address")
        .populate("animalId", "earTag breed species imageUrl")
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
    res.status(500).json({ message: "Error fetching re-inseminations", error: error.message });
  }
};

export const getMyPregnancyChecks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      Pregnancy.find()
        .populate("farmerId", "name phoneNumber address")
        .populate("animalId", "earTag breed species imageUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Pregnancy.countDocuments(),
    ]);

    res.status(200).json({
      data: records,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching pregnancy checks", error: error.message });
  }
};

export const getMyCalvings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      Calving.find()
        .populate("farmerId", "name phoneNumber address")
        .populate("animalId", "earTag breed species imageUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Calving.countDocuments(),
    ]);

    res.status(200).json({
      data: records,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching calvings", error: error.message });
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
    res.status(500).json({ message: "Error fetching notifications", error: error.message });
  }
};

export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password").lean();
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Error fetching profile", error: error.message });
  }
};

// --- ACTION HANDLERS ---

export const walkInInsemination = async (req, res) => {
  try {
    const { farmerId, animalId, inseminationDate, sireBreed, sireCode, estrus } = req.body;

    const lastAttempt = await Insemination.findOne({ animalId }).sort({ attemptNumber: -1 });
    const attemptNumber = lastAttempt ? lastAttempt.attemptNumber + 1 : 1;

    const insemination = await Insemination.create({
      farmerId,
      animalId,
      inseminationDate: inseminationDate || new Date(),
      sireBreed,
      sireCode,
      estrus,
      attemptNumber,
      status: "approved",
      approvedBy: req.user._id,
    });

    // Notify Farmer
    await Notification.create({
      recipientId: farmerId,
      senderId: req.user._id,
      type: "ai-request",
      relatedId: insemination._id,
      title: "Insemination Recorded",
      message: `A walk-in insemination has been recorded for your animal by technician ${req.user.name}.`,
    });

    // Trigger Socket Update
    req.app.get("io").emit("dashboardUpdate", { type: "WALKIN_INSEMINATION_CREATED" });

    res.status(201).json({ message: "Walk-in insemination recorded", insemination });
  } catch (error) {
    res.status(500).json({ message: "Error recording insemination", error: error.message });
  }
};

export const updateInseminationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, technicianNote, scheduledDate } = req.body;

    const insemination = await Insemination.findByIdAndUpdate(
      id,
      { status, technicianNote, scheduledDate, approvedBy: req.user._id },
      { returnDocument: 'after' }
    ).populate("farmerId", "name");

    if (!insemination) return res.status(404).json({ message: "Record not found" });

    // Notify Farmer
    await Notification.create({
      recipientId: insemination.farmerId._id,
      senderId: req.user._id,
      type: "ai-request",
      relatedId: insemination._id,
      title: "AI Request Update",
      message: `Your AI request status has been updated to: ${status}.`,
    });

    // Trigger Socket Update
    req.app.get("io").emit("dashboardUpdate", { type: "INSEMINATION_UPDATED", status });

    // --- TRIGGER INNGEST AUTOMATION ---
    if (status === "approved" || status === "done") {
      await inngest.send({
        name: "insemination/approved",
        data: {
          inseminationId: insemination._id,
          animalId: insemination.animalId,
          farmerId: insemination.farmerId._id,
        },
      });
    }

    res.status(200).json({ message: "Status updated", insemination });
  } catch (error) {
    res.status(500).json({ message: "Error updating status", error: error.message });
  }
};

export const getAnimalHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const [inseminations, pregnancies, calvings] = await Promise.all([
      Insemination.find({ animalId: id }).sort({ createdAt: -1 }).lean(),
      Pregnancy.find({ animalId: id }).sort({ createdAt: -1 }).lean(),
      Calving.find({ animalId: id }).sort({ createdAt: -1 }).lean(),
    ]);

    const history = [
      ...inseminations.map(i => ({ ...i, eventType: "Insemination" })),
      ...pregnancies.map(p => ({ ...p, eventType: "Pregnancy Check" })),
      ...calvings.map(c => ({ ...c, eventType: "Calving" })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ message: "Error fetching animal history", error: error.message });
  }
};

export const registerFarmer = async (req, res) => {
  try {
    const { firstName, lastName, phoneNumber, email, address } = req.body;

    const fullName = `${firstName} ${lastName}`.trim();
    
    // Check if user already exists
    const existing = await User.findOne({ $or: [{ email }, { phoneNumber }] });
    if (existing) return res.status(400).json({ message: "A user with this email or phone already exists." });

    // Create Clerk User
    const clerkUser = await clerkClient.users.createUser({
      emailAddress: email ? [email] : [],
      phoneNumber: phoneNumber ? [phoneNumber] : [],
      firstName,
      lastName,
      publicMetadata: { role: "farmer", isVerified: false },
    });

    const user = await User.create({
      clerkId: clerkUser.id,
      name: fullName,
      email,
      phoneNumber,
      address,
      role: "farmer",
      isVerified: false,
    });

    res.status(201).json({ message: "Farmer registered successfully", user });
  } catch (error) {
    console.error("[registerFarmer ERROR]", error);
    res.status(500).json({ message: "Failed to register farmer", error: error.message });
  }
};

export const recordPregnancyCheck = async (req, res) => {
  try {
    const { animalId, result, technicianNote, inseminationId } = req.body;

    const animal = await Animal.findById(animalId);
    if (!animal) return res.status(404).json({ message: "Animal not found" });

    const pregnancy = await Pregnancy.create({
      animalId,
      farmerId: animal.farmerId,
      inseminationId,
      pregnancyDiagnosis: {
        date: new Date(),
        result: result, // "Pregnant" or "Empty"
      },
      targetCalvingDate: result === "Pregnant" ? new Date(Date.now() + 280 * 24 * 60 * 60 * 1000) : undefined,
    });

    // Notify Farmer
    await Notification.create({
      recipientId: animal.farmerId,
      senderId: req.user._id,
      type: "system",
      relatedId: pregnancy._id,
      title: "Pregnancy Check Result",
      message: `The pregnancy check for ${animal.earTag} resulted in: ${result}.`,
    });

    // Trigger Inngest if Pregnant
    if (result === "Pregnant") {
      await inngest.send({
        name: "pregnancy/confirmed",
        data: {
          pregnancyId: pregnancy._id,
          animalId,
          farmerId: animal.farmerId,
        },
      });
    }

    res.status(201).json({ message: "Pregnancy check recorded", pregnancy });
  } catch (error) {
    console.error("[recordPregnancyCheck ERROR]", error);
    res.status(500).json({ message: "Failed to record pregnancy check", error: error.message });
  }
};

// --- OPTIMIZED GRANULAR DASHBOARD ENDPOINTS ---

export const getDashboardStats = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [totalToday, pendingHealth] = await Promise.all([
      Insemination.countDocuments({
        $or: [
          { scheduledDate: { $gte: todayStart, $lt: todayEnd } },
          { inseminationDate: { $gte: todayStart, $lt: todayEnd } }
        ]
      }),
      HealthRequest.countDocuments({ status: "pending" })
    ]);

    let successRate = "84%";
    const cachedStats = await Config.findOne({ key: "dashboard_success_rate" }).lean();
    if (cachedStats?.value) successRate = cachedStats.value;

    res.status(200).json({ totalToday, pendingHealth, successRate });
  } catch (error) {
    res.status(500).json({ message: "Error fetching stats" });
  }
};

export const getDashboardFeed = async (req, res) => {
  try {
    const [inseminations, healthReqs] = await Promise.all([
      Insemination.find({ status: { $in: ["pending", "approved", "in-progress"] } })
        .populate("farmerId", "name address")
        .populate("animalId", "earTag imageUrl breed species")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      HealthRequest.find({ status: { $in: ["pending", "in-progress"] } })
        .populate("farmerId", "name address")
        .populate("animalId", "earTag imageUrl breed species")
        .sort({ urgency: -1, createdAt: -1 })
        .limit(20)
        .lean()
    ]);

    const formatAddress = (addr) => {
      if (!addr) return "Unknown";
      if (typeof addr === 'string') return addr;
      if (Array.isArray(addr) && addr.length > 0) addr = addr[0];
      return `${addr.barangay || ''}, ${addr.city || ''}`.replace(/^,|,$/g, '').trim() || "Unknown";
    };

    const pendingRequests = [
      ...inseminations.filter(i => i.status === 'pending').map(i => ({
        id: i._id,
        type: 'ai',
        task: `AI Service: ${i.animalId?.breed || 'Livestock'}`,
        farmer: i.farmerId?.name,
        location: formatAddress(i.farmerId?.address),
        sentTime: new Date(i.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      })),
      ...healthReqs.filter(h => h.status === 'pending').map(h => ({
        id: h._id,
        type: 'health',
        task: `Health Check: ${h.animalId?.breed || 'Livestock'}`,
        farmer: h.farmerId?.name,
        location: formatAddress(h.farmerId?.address),
        sentTime: new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }))
    ].sort((a, b) => b.id.getTimestamp() - a.id.getTimestamp());

    const agendaItems = [
      ...inseminations.filter(i => i.status !== 'pending').map(i => ({
        id: i._id,
        type: 'ai',
        task: `Insemination — ${i.animalId?.earTag}`,
        farmer: i.farmerId?.name,
        location: formatAddress(i.farmerId?.address),
        time: i.scheduledDate ? new Date(i.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Today"
      })),
      ...healthReqs.filter(h => h.status !== 'pending').map(h => ({
        id: h._id,
        type: 'health',
        task: `Medical — ${h.animalId?.earTag}`,
        farmer: h.farmerId?.name,
        location: formatAddress(h.farmerId?.address),
        time: h.scheduledDate ? new Date(h.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Today"
      }))
    ];

    res.status(200).json({ pendingRequests, agendaItems });
  } catch (error) {
    res.status(500).json({ message: "Error fetching feed" });
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
            as: "farmer"
          }
        },
        { $unwind: { path: "$farmer", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "inseminations",
            let: { animalId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$animalId", "$$animalId"] } } },
              { $sort: { createdAt: -1 } },
              { $limit: 1 }
            ],
            as: "lastIns"
          }
        },
        { $unwind: { path: "$lastIns", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "pregnancies",
            let: { animalId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$animalId", "$$animalId"] } } },
              { $sort: { createdAt: -1 } },
              { $limit: 1 }
            ],
            as: "lastPregnancy"
          }
        },
        { $unwind: { path: "$lastPregnancy", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            lastActivityDate: {
              $max: [
                "$createdAt",
                { $ifNull: ["$lastIns.createdAt", new Date(0)] },
                { $ifNull: ["$lastPregnancy.createdAt", new Date(0)] }
              ]
            }
          }
        },
        { $sort: { lastActivityDate: -1 } },
        { $limit: 50 }
    ]);

    // Format for frontend
    const formatted = animalRegistry.map(animal => ({
      rawId: animal._id,
      id: `#${animal.earTag || animal.animalId || 'N/A'}`,
      breed: animal.breed,
      status: animal.lastPregnancy?.pregnancyDiagnosis?.result === "Pregnant" ? "Pregnant" : (animal.lastIns ? "Inseminated" : "Normal"),
      lastActionDate: animal.lastActivityDate,
      last: animal.lastIns ? `Insemination (${animal.lastIns.sireBreed})` : "Enrolled in Hub",
      farmerName: animal.farmer?.name || "Unknown Owner",
      farmerPhone: animal.farmer?.phoneNumber,
      imageUrl: animal.imageUrl,
      sClass: animal.lastPregnancy?.pregnancyDiagnosis?.result === "Pregnant" ? "text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full" : "text-gray-600",
      dotClass: animal.lastPregnancy?.pregnancyDiagnosis?.result === "Pregnant" ? "bg-purple-600" : "bg-gray-400"
    }));

    res.status(200).json(formatted);
  } catch (error) {
    res.status(500).json({ message: "Error fetching registry" });
  }
};
