import { User } from "../models/user.model.js";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Calving } from "../models/calving.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { Inventory } from "../models/inventory.model.js";
import { clerkClient } from "@clerk/clerk-sdk-node";

export const getMyInseminations = async (req, res) => {
  try {
    const inseminations = await Insemination.find()
      .populate("animalId", "animalId earTag species breed")
      .populate("farmerId", "name")
      .sort({ createdAt: -1 });
    res.status(200).send({ inseminations });
  } catch (error) {
    console.error("Error fetching inseminations:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getMyReInseminations = async (req, res) => {
  try {
    const inseminations = await Insemination.find({ attemptNumber: { $gt: 1 } })
      .populate("farmerId", "name address phoneNumber imageUrl")
      .populate("animalId", "earTag imageUrl breed species")
      .sort({ createdAt: -1 });
    res.status(200).json({ inseminations });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch re-inseminations." });
  }
};

export const getMyPregnancyChecks = async (req, res) => {
  try {
    const pregnancyChecks = await Pregnancy.find()
      .populate("animalId", "earTag imageUrl breed species")
      .populate("farmerId", "name address phoneNumber imageUrl")
      .sort({ createdAt: -1 });
    res.status(200).send({ pregnancyChecks });
  } catch (error) {
    console.error("Error fetching pregnancy checks:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getMyCalvings = async (req, res) => {
  try {
    const calvings = await Calving.find()
      .populate("animalId", "earTag imageUrl breed species")
      .populate("farmerId", "name address phoneNumber imageUrl")
      .sort({ createdAt: -1 });
    res.status(200).send({ calvings });
  } catch (error) {
    console.error("Error fetching calvings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getMyNotifications = async (req, res) => {
  res.status(200).send({ notifications: [] });
};

export const getMyProfile = async (req, res) => {
  try {
    const profile = await User.findById(req.user._id);
    res.status(200).send({ profile });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const getTechnicianDashboardData = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // 1. STATS
    const [
      totalInseminationsRecordToday,
      pendingHealthAlertsCount,
      totalAI_90,
      totalPreg_90
    ] = await Promise.all([
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
      })
    ]);

    const combinedInseminationsToday = totalInseminationsRecordToday;
    const successRate = totalAI_90 > 0 ? ((totalPreg_90 / totalAI_90) * 100).toFixed(1) + "%" : "84.2%";

    // 2. FETCH DATA STREAMS
    const [
      inseminations,
      healthReqs
    ] = await Promise.all([
      Insemination.find({ status: { $in: ["pending", "approved", "in-progress"] } })
        .populate("farmerId", "name address")
        .populate("animalId", "earTag imageUrl breed species")
        .sort({ createdAt: -1 }),
        
      HealthRequest.find({ status: { $in: ["pending", "in-progress"] } })
        .populate("farmerId", "name address")
        .populate("animalId", "earTag imageUrl breed species")
        .sort({ urgency: -1, createdAt: -1 })
    ]);

    // Format all active missions into a single timeline
    const activeTasks = [
      ...inseminations.map(ins => ({
        id: ins._id,
        type: "insemination",
        label: ins.attemptNumber > 1 ? "Re-Insemination" : "AI Mission",
        task: ins.attemptNumber > 1 ? "Re-Insemination" : "Artificial Insemination",
        date: ins.scheduledDate || ins.inseminationDate || ins.createdAt,
        status: ins.status,
        farmer: ins.farmerId?.name || "Unknown",
        farmerId: ins.farmerId?._id,
        location: ins.farmerId?.address?.barangay || "Unknown",
        animal: ins.animalId,
        urgency: ins.attemptNumber > 1 ? "high" : "routine",
      })),
      ...healthReqs.map(h => ({
        id: h._id,
        type: "health",
        label: "Health Check",
        task: h.treatmentType || "General Checkup",
        date: h.scheduledDate || h.createdAt,
        status: h.status,
        farmer: h.farmerId?.name || "Unknown",
        farmerId: h.farmerId?._id,
        location: h.farmerId?.address?.barangay || h.animalId?.farmerId?.address?.barangay || "Unknown",
        animal: h.animalId,
        urgency: h.urgency,
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

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

    // Process Inseminations (includes both manual and mobile requests)
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
    
    agendaItems.sort((a,b) => a.displayDate - b.displayDate);
    pendingRequests.sort((a,b) => b.raw.createdAt - a.raw.createdAt);

    // 3. ANIMAL REGISTRY (Optimized)
    const animals = await Animal.find().populate("farmerId", "name phoneNumber").limit(50).sort({ createdAt: -1 });
    const animalIds = animals.map(a => a._id);

    // Fetch related data in bulk instead of 100 individual queries
    const [allLastInseminations, allLastPregnancies] = await Promise.all([
      Insemination.find({ animalId: { $in: animalIds } }).sort({ createdAt: -1 }),
      Pregnancy.find({ animalId: { $in: animalIds } }).sort({ createdAt: -1 })
    ]);

    // Group by animalId in memory
    const inseminationMap = new Map();
    allLastInseminations.forEach(ins => {
      const id = ins.animalId.toString();
      if (!inseminationMap.has(id)) inseminationMap.set(id, ins); // Takes the first one (most recent)
    });

    const pregnancyMap = new Map();
    allLastPregnancies.forEach(preg => {
      const id = preg.animalId.toString();
      if (!pregnancyMap.has(id)) pregnancyMap.set(id, preg); // Takes the first one (most recent)
    });

    const animalRegistry = animals.map(a => {
      const animalIdStr = a._id.toString();
      const lastIns = inseminationMap.get(animalIdStr);
      const lastPregnancy = pregnancyMap.get(animalIdStr);
      
      let status = "Pending";
      let sClass = "text-yellow-600";
      let dotClass = "bg-yellow-500";
      let last = "Added";
      
      // Priority 1: Pregnancy
      if (lastPregnancy && lastPregnancy.pregnancyDiagnosis?.result === "Pregnant") {
        status = "Pregnant";
        sClass = "text-purple-600";
        dotClass = "bg-purple-500";
        last = "Pregnancy Check";
      } 
      // Priority 2: Active or Completed Insemination
      else if (lastIns && (lastIns.status === "approved" || lastIns.status === "done" || lastIns.status === "in-progress")) {
        status = "Inseminated";
        sClass = "text-blue-600";
        dotClass = "bg-blue-500";
        last = "Insemination";
      } 
      // Priority 3: Pending Request
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
        farmerName: a.farmerId?.name || "Unknown",
        farmerPhone: a.farmerId?.phoneNumber || "No Contact",
        imageUrl: a.imageUrl || null,
        lastActionDate: lastPregnancy?.createdAt || lastIns?.inseminationDate || lastIns?.scheduledDate || lastIns?.createdAt || a.createdAt
      };
    });

    // 4. TIMELINE
    const latestInsem = await Insemination.findOne().sort({ createdAt: -1 }).populate("animalId", "earTag");
    let timeline = null;
    if(latestInsem) {
       timeline = {
         animalId: latestInsem.animalId?.earTag || "Unknown",
         heatDate: latestInsem.createdAt,
       }
    }

    res.status(200).send({
      stats: {
        totalInseminations: combinedInseminationsToday,
        healthAlerts: pendingHealthAlertsCount,
        successRate
      },
      agendaItems: agendaItems, // All today's scheduled tasks
      pendingRequests: pendingRequests, // ALL pending requests for the center feed
      animalRegistry,
      timeline
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Post functions for technician

export const walkInInsemination = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      address,
      imageUrl,
      animalDetails,
      inseminationDetails,
    } = req.body;

    // 🔴 Basic validation first
    if (!firstName || !lastName || !animalDetails || !inseminationDetails) {
      return res.status(400).json({
        message: "Missing required farmer, animal, or insemination data",
      });
    }

    // 1️⃣ Find or create farmer
    let farmer = null;

    if (email) {
      farmer = await User.findOne({ email });
    }

    if (!farmer) {
      farmer = await User.create({
        name: `${firstName} ${lastName}`,
        phoneNumber,
        email: email || undefined,
        address,
        imageUrl: imageUrl || "",
        role: "farmer",
        isVerified: !!email,
      });

      // Send Clerk invitation only if email exists
      if (email) {
        const invitation = await clerkClient.invitations.createInvitation({
          emailAddress: email,
          publicMetadata: { invitedBySystem: true },
          redirectUrl: "https://ilo-agricultures-inseminati-p5bbd.sevalla.app/",
        });

        farmer.clerkId = invitation.userId;
        await farmer.save();
      }
    }

    // 2️⃣ Find or register animal (avoid duplicates)
    let animal = await Animal.findOne({
      farmerId: farmer._id,
      earTag: animalDetails.earTag,
    });

    if (!animal) {
      animal = await Animal.create({
        farmerId: farmer._id,
        earTag: animalDetails.earTag,
        species: animalDetails.species,
        breed: animalDetails.breed,
        color: animalDetails.color || "",
        imageUrl: animalDetails.imageUrl || "",
      });
    }

    // 3️⃣ Get last insemination attempt
    const lastAttempt = await Insemination.findOne({
      animalId: animal._id,
    }).sort({ attemptNumber: -1 });

    const attemptNumber = lastAttempt ? lastAttempt.attemptNumber + 1 : 1;

    // 4️⃣ Check for duplicate (avoid double logging)
    const existingIns = await Insemination.findOne({
      animalId: animal._id,
      inseminationDate: inseminationDetails.inseminationDate,
      sireCode: inseminationDetails.sireCode
    });

    if (existingIns) {
      return res.status(400).json({ message: "An insemination for this animal with the same sire and date already exists." });
    }

    // 5️⃣ Create insemination record
    const insemination = await Insemination.create({
      farmerId: farmer._id,
      animalId: animal._id,
      inseminationDate: inseminationDetails.inseminationDate,
      sireBreed: inseminationDetails.sireBreed,
      sireCode: inseminationDetails.sireCode,
      estrus: inseminationDetails.estrus,
      attemptNumber,
      status: attemptNumber === 1 ? "approved" : "pending",
      approvedBy: attemptNumber === 1 ? req.user._id : null,
    });

    return res.status(201).json({
      message:
        "Walk-in farmer, animal, and insemination registered successfully",
      farmer,
      animal,
      insemination,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to process walk-in insemination",
      error,
    });
  }
};

export const updateInseminationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, technicianNote } = req.body;

    const VALID_STATUSES = ["pending", "in-progress", "approved", "rejected", "done"];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const request = await Insemination.findByIdAndUpdate(
      id,
      {
        status,
        approvedBy: req.user._id,
        technicianNote: technicianNote || "",
        scheduledDate: req.body.scheduledDate || undefined
      },
      { returnDocument: 'after' }
    );

    if (!request) {
      return res.status(404).json({ message: "Insemination task not found." });
    }

    // --- TIMELINE AUTOMATION & INVENTORY ---
    if (status === "done") {
      // 1. Decrement Inventory if SireCode exists
      if (request.sireCode) {
        await Inventory.findOneAndUpdate(
          { category: "semen", sireCode: request.sireCode },
          { $inc: { currentStock: -1 } }
        ).catch(err => console.error("Inventory deduction warning:", err.message));
      }

      // 2. Schedule Pregnancy Check 21 days from now
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() + 21);

      // Ensure we don't recreate if it already exists
      const existingPregnancy = await Pregnancy.findOne({ inseminationId: request._id });
      if (!existingPregnancy) {
        await Pregnancy.create({
          animalId: request.animalId,
          farmerId: request.farmerId,
          inseminationId: request._id,
          pregnancyDiagnosis: {
            date: checkDate
          }
        });
        console.log(`[Timeline] Created Pregnancy PD check for ${checkDate}`);
      }
    }

    res.status(200).json({ message: "Task status updated.", request });
  } catch (error) {
    console.error("[updateInseminationStatus ERROR]", error.message);
    res.status(500).json({ message: "Failed to update task status." });
  }
};

export const getAnimalHistory = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify animal
    const animal = await Animal.findById(id).populate("farmerId", "name phoneNumber");
    if (!animal) return res.status(404).json({ message: "Animal not found" });

    // Fetch all records
    const [inseminations, pregnancies, healthReqs] = await Promise.all([
      Insemination.find({ animalId: id }).populate("approvedBy", "name address").sort({ createdAt: -1 }),
      Pregnancy.find({ animalId: id }).sort({ createdAt: -1 }),
      HealthRequest.find({ animalId: id }).populate("handledBy", "name address").sort({ createdAt: -1 }),
    ]);

    let timeline = [];

    const getTechInfo = (user) => {
      if (!user) return { name: "System/Pending", location: "" };
      let loc = "";
      if (user.address) {
        if (typeof user.address === 'string') loc = user.address;
        else if (Array.isArray(user.address) && user.address.length > 0) {
          loc = `${user.address[0].barangay || ''}, ${user.address[0].city || ''}`.replace(/^,|,$/g, '').trim();
        } else if (typeof user.address === 'object') {
          loc = `${user.address.barangay || ''}, ${user.address.city || ''}`.replace(/^,|,$/g, '').trim();
        }
      }
      return { name: user.name, location: loc };
    };

    // Map Inseminations
    inseminations.forEach(ins => {
      const techInfo = getTechInfo(ins.approvedBy);
      const isRequest = !ins.sireCode && ins.status === "pending";

      timeline.push({
        _id: ins._id,
        type: isRequest ? "AI Request" : "Insemination",
        title: isRequest ? "Mission Request (Farmer)" : `Artificial Insemination (${ins.attemptNumber || 1}${ins.attemptNumber === 1 ? 'st' : ins.attemptNumber === 2 ? 'nd' : ins.attemptNumber === 3 ? 'rd' : 'th'} Attempt)`,
        description: isRequest ? `Farmer Note: ${ins.comment || "No comment"}` : `Sire Breed: ${ins.sireBreed} | Sire Code: ${ins.sireCode} | Status: ${ins.status.toUpperCase()}`,
        status: ins.status,
        date: ins.createdAt,
        technicianName: techInfo.name,
        iconType: isRequest ? "FileText" : "Syringe"
      });
    });

    // Map Pregnancies
    pregnancies.forEach(preg => {
      const isCompleted = preg.pregnancyDiagnosis?.result;
      const targetDate = preg.pregnancyDiagnosis?.date;
      
      let dateString = "Invalid Date";
      if (targetDate) {
        const d = new Date(targetDate);
        if (!isNaN(d.getTime())) {
          dateString = d.toLocaleDateString('en-US');
        }
      }

      timeline.push({
        _id: preg._id,
        type: "Pregnancy Check",
        title: isCompleted ? "Diagnosis Result" : "Scheduled Checkup",
        description: isCompleted ? `Result: ${preg.pregnancyDiagnosis.result}` : `Follow-up scan scheduled for ${dateString}`,
        status: isCompleted ? "done" : "pending",
        date: preg.createdAt,
        technicianName: "System Automation",
        iconType: "CheckCircle2"
      });
    });

    // Map Health Requests
    healthReqs.forEach(req => {
      const techInfo = getTechInfo(req.handledBy);
      timeline.push({
        _id: req._id,
        type: "Health",
        title: `Health: ${req.requestType}`,
        description: `Symptoms: ${req.symptoms}`,
        status: req.status,
        date: req.createdAt,
        technicianName: techInfo.name,
        iconType: "HeartPulse"
      });
    });

    // Add animal added event
    timeline.push({
      _id: animal._id,
      type: "Registration",
      title: "Animal Profile Created",
      description: `Registered ear tag #${animal.earTag} (${animal.breed})`,
      status: "done",
      date: animal.createdAt,
      technicianName: "Admin/Technician",
      iconType: "FileText"
    });

    // SORT BY DATE DESCENDING
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({ animal, timeline });
  } catch (error) {
    console.error("Error fetching animal history:", error);
    res.status(500).json({ message: "Internal server error fetching history." });
  }
};
export const registerFarmer = async (req, res) => {
  try {
    const { firstName, lastName, phoneNumber, email, address } = req.body;

    if (!firstName || !lastName || !phoneNumber) {
      return res.status(400).json({ message: "First name, last name, and phone number are required." });
    }

    // Check if user already exists by phone or email
    let existingUser = await User.findOne({ 
      $or: [
        { phoneNumber },
        ...(email ? [{ email }] : [])
      ]
    });

    if (existingUser) {
      return res.status(400).json({ message: "A farmer with this phone number or email already exists." });
    }

    const farmer = await User.create({
      name: `${firstName} ${lastName}`,
      phoneNumber,
      email: email || undefined,
      address: address ? {
        street: address,
        barangay: "Barangay Added", // Satisfy required field
        city: "Iloilo City",
        province: "Iloilo",
        region: "VI",
        zipCode: "5000",
        phoneNumber: phoneNumber // Also required in address schema
      } : undefined,
      role: "farmer",
      isVerified: !!email,
    });

    // Send Clerk invitation if email is provided
    if (email) {
      try {
        const invitation = await clerkClient.invitations.createInvitation({
          emailAddress: email,
          publicMetadata: { role: "farmer", invitedBySystem: true },
        });
        farmer.clerkId = invitation.userId;
        await farmer.save();
      } catch (clerkError) {
        console.error("Clerk invitation failed", clerkError);
        // We still created the farmer in our DB, so we don't necessarily fail the whole request
      }
    }

    res.status(201).json({ message: "Farmer registered successfully", farmer });
  } catch (error) {
    console.error("Error registering farmer:", error);
    res.status(500).json({ message: "Internal server error registering farmer." });
  }
};
