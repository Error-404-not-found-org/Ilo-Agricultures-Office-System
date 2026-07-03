import { Task } from "../models/task.model.js";
import { User } from "../models/user.model.js";
import { Insemination } from "../models/insemination.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import mongoose from "mongoose";


const TASK_TYPE_ALIASES = {
  general: "GeneralVisit",
  "general visit": "GeneralVisit",
  generalvisit: "GeneralVisit",
  visit: "GeneralVisit",
  followup: "FollowUp",
  "follow-up": "FollowUp",
  "follow up": "FollowUp",
  farminspection: "FarmInspection",
  "farm inspection": "FarmInspection",
  inspection: "FarmInspection",
  health: "Health",
  "health check": "Health",
  "health assistance": "Health",
  pregnancy: "PD",
  "pregnancy check": "PD",
  pd: "PD",
  calving: "CD",
  cd: "CD",
  ai: "AI",
  "artificial insemination": "AI",
  vaccination: "Vaccination",
  deworming: "Deworming",
  treatment: "Treatment",
  registration: "Registration",
  other: "Other",
};

const OFFICIAL_SERVICE_TASK_TYPES = new Set([
  "AI",
  "Health",
  "PD",
  "CD",
  "Calving",
  "Vaccination",
  "Deworming",
  "Treatment",
]);

const normalizeTaskType = (value = "GeneralVisit") => {
  const raw = String(value || "GeneralVisit").trim();
  const key = raw.toLowerCase().replace(/[_-]/g, " ");
  return TASK_TYPE_ALIASES[key] || TASK_TYPE_ALIASES[key.replace(/\s/g, "")] || raw;
};

// GET /api/tasks/stats
export const getDashboardStats = async (req, res) => {
  try {
    const technicianId = req.user._id;

    const tasks = await Task.find({ 
      $or: [ { technicianId }, { technicianId: { $exists: false } }, { technicianId: null } ], 
      status: "Pending" 
    });
    
    const stats = {
      urgent: tasks.filter(t => t.category === "Urgent").length,
      routine: tasks.filter(t => t.category === "Routine").length,
      followUp: tasks.filter(t => t.category === "Follow-up").length,
      total: tasks.length
    };

    res.status(200).json(stats);
  } catch (error) {
    console.error("Error fetching task stats:", error);
    res.status(500).json({ message: "Failed to fetch task statistics" });
  }
};

// GET /api/tasks
export const getTasks = async (req, res) => {
  try {
    const technicianId = req.user._id;
    const { scope, status, page, limit } = req.query;

    let query = {};
    if (scope === "mine") {
      query = {
        technicianId: req.user._id,
        status: "Pending",
      };
    } else if (scope === "available") {
      // Unassigned generic tasks only
      query = {
        technicianId: { $in: [null, undefined] },
        status: "Pending",
        taskType: { $nin: Array.from(OFFICIAL_SERVICE_TASK_TYPES) },
      };
    } else if (scope === "all") {
      query = {};
    } else {
      // Legacy fallback: mine or unassigned
      query = {
        $or: [
          { technicianId },
          { technicianId: { $exists: false } },
          { technicianId: null },
        ],
        status: "Pending",
      };
    }

    if (status && status !== "all") {
      query.status = status;
    } else if (scope === "all" && status !== "all") {
      query.status = "Pending";
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    let taskQuery = Task.find(query)
      .populate("farmerId", "name imageUrl phoneNumber address farmLocation")
      .populate("animalIds", "animalId earTag species breed color")
      .sort({ createdAt: -1 });

    if (typeof taskQuery.skip === "function") {
      taskQuery = taskQuery.skip(skip);
    }
    if (typeof taskQuery.limit === "function") {
      taskQuery = taskQuery.limit(limitNum);
    }

    const tasks = await taskQuery;

    res.status(200).json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ message: "Failed to fetch tasks" });
  }
};

// PUT /api/tasks/:id/claim
export const claimTask = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findOneAndUpdate(
      {
        _id: id,
        technicianId: { $in: [null, undefined] },
        status: "Pending",
      },
      {
        $set: {
          technicianId: req.user._id,
          claimedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!task) {
      return res.status(409).json({
        message: "This task has already been claimed by another technician or is not pending.",
        code: "TASK_ALREADY_CLAIMED",
      });
    }

    res.status(200).json({ message: "Task claimed successfully!", task });
  } catch (error) {
    console.error("Error claiming task:", error);
    res.status(500).json({ message: "Failed to claim task" });
  }
};

// POST /api/tasks
export const createTask = async (req, res) => {
  try {
    const technicianId = req.user._id;
    const {
      farmerId,
      animalIds,
      category,
      notes,
      taskType,
      dueDate,
      sourceType,
      metadata,
      priority,
    } = req.body;

    if (!farmerId || !category || !notes) {
      return res.status(400).json({ message: "Farmer, category, and notes are required." });
    }

    const normalizedTaskType = normalizeTaskType(taskType);
    const parsedDueDate = dueDate ? new Date(dueDate) : null;
    if (dueDate && Number.isNaN(parsedDueDate.getTime())) {
      return res.status(400).json({ message: "Invalid visit date." });
    }

    // 1. Same technician already has a visit at the exact selected date/time -> hard block
    if (parsedDueDate) {
      const existingVisit = await Task.findOne({
        technicianId,
        dueDate: parsedDueDate,
        status: { $in: ["Pending", "In Progress"] },
      });
      if (existingVisit) {
        return res.status(409).json({ message: "You already have a visit scheduled at this time." });
      }

      // Check Insemination and HealthRequest scheduledDate exact time conflicts
      const existingAI = await Insemination.findOne({
        approvedBy: technicianId,
        scheduledDate: parsedDueDate,
        status: { $in: ["approved", "scheduled", "in-progress"] },
        deletedAt: null,
      });
      if (existingAI) {
        return res.status(409).json({ message: "You already have a visit scheduled at this time." });
      }

      const existingHealth = await HealthRequest.findOne({
        handledBy: technicianId,
        scheduledDate: parsedDueDate,
        status: { $in: ["assigned", "approved", "scheduled", "in-progress"] },
        deletedAt: null,
      });
      if (existingHealth) {
        return res.status(409).json({ message: "You already have a visit scheduled at this time." });
      }
    }

    // 2. Same animal already has an active official service request -> hard block if visit type is AI, Health, Pregnancy Check, or Calving
    if (["AI", "Health", "PD", "CD"].includes(normalizedTaskType) && animalIds && animalIds.length > 0) {
      const activeTask = await Task.findOne({
        animalIds: { $in: animalIds },
        taskType: normalizedTaskType,
        status: { $in: ["Pending", "In Progress"] },
      });
      if (activeTask) {
        return res.status(409).json({ message: "This animal already has an active service request." });
      }

      // Check Insemination/HealthRequest if relevant
      if (normalizedTaskType === "AI") {
        const activeAI = await Insemination.findOne({
          animalId: { $in: animalIds },
          status: { $in: ["pending", "approved", "in-progress"] },
          deletedAt: null,
        });
        if (activeAI) {
          return res.status(409).json({ message: "This animal already has an active service request." });
        }
      }
      
      if (normalizedTaskType === "Health") {
        const activeHealth = await HealthRequest.findOne({
          animalId: { $in: animalIds },
          status: { $in: ["pending", "in-progress"] },
          deletedAt: null,
        });
        if (activeHealth) {
          return res.status(409).json({ message: "This animal already has an active service request." });
        }
      }
    }

    const newTask = await Task.create({
      technicianId,
      farmerId,
      animalIds: animalIds || [],
      category,
      taskType: normalizedTaskType,
      dueDate: parsedDueDate,
      sourceType: sourceType || "manual",
      metadata: metadata || {},
      priority,
      notes,
    });

    res.status(201).json({ message: "Task created successfully", task: newTask });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ message: "Failed to create task" });
  }
};

// PUT /api/tasks/:id/complete
export const completeTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { relatedRecordType, relatedRecordId } = req.body || {};
    const existingTask = await Task.findOne({
      _id: id,
      $or: [ { technicianId: req.user._id }, { technicianId: { $exists: false } }, { technicianId: null } ],
    });

    if (!existingTask) return res.status(404).json({ message: "Task not found" });

    const isOfficialTask = OFFICIAL_SERVICE_TASK_TYPES.has(existingTask.taskType);
    if (isOfficialTask && (!relatedRecordType || !relatedRecordId)) {
      return res.status(400).json({
        message: "This task must be completed through its official service form.",
      });
    }

    const task = await Task.findOneAndUpdate(
      { _id: id, $or: [ { technicianId: req.user._id }, { technicianId: { $exists: false } }, { technicianId: null } ] },
      {
        status: "Completed",
        technicianId: req.user._id,
        completedAt: new Date(),
        ...(relatedRecordType && relatedRecordId
          ? { relatedRecordType, relatedRecordId }
          : {}),
      },
      { returnDocument: 'after' }
    );
    
    res.status(200).json({ message: "Task completed!", task });
  } catch (error) {
    console.error("Error completing task:", error);
    res.status(500).json({ message: "Failed to complete task" });
  }
};

// GET /api/tasks/:id
export const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findOne({
      _id: id,
      $or: [ { technicianId: req.user._id }, { technicianId: { $exists: false } }, { technicianId: null } ]
    })
      .populate("farmerId", "name imageUrl phoneNumber address farmLocation")
      .populate("animalIds", "animalId earTag species breed color");

    if (!task) return res.status(404).json({ message: "Task not found" });

    const isUnclaimed = !task.technicianId;
    const isFarmerRole = req.user.role === "farmer";
    const isOwnFarmer = isFarmerRole && task.farmerId?._id?.toString() === req.user._id.toString();

    const taskObj = task.toObject();
    if (isUnclaimed && !isOwnFarmer && req.user.role !== "admin") {
      if (taskObj.farmerId) {
        taskObj.farmerId.phoneNumber = "";
        if (taskObj.farmerId.address) {
          taskObj.farmerId.address.landmark = "";
          taskObj.farmerId.address.street = "";
          taskObj.farmerId.address.houseNumber = "";
          taskObj.farmerId.address.coordinates = null;
        }
        if (taskObj.farmerId.farmLocation) {
          taskObj.farmerId.farmLocation.landmark = "";
          taskObj.farmerId.farmLocation.directionsNote = "";
          taskObj.farmerId.farmLocation.latitude = null;
          taskObj.farmerId.farmLocation.longitude = null;
        }
      }
    }

    if (task.taskType === "PD") {
      const inseminationQuery = task.metadata?.inseminationId
        ? {
            $or: [
              { verificationTaskId: task._id },
              { _id: task.metadata.inseminationId },
            ],
            deletedAt: null,
          }
        : { verificationTaskId: task._id, deletedAt: null };

      const insemination = await Insemination.findOne(inseminationQuery)
        .populate("animalId", "animalId earTag species breed color");
      taskObj.insemination = insemination || null;
    }

    res.status(200).json(taskObj);
  } catch (error) {
    console.error("Error fetching task details:", error);
    res.status(500).json({ message: "Failed to fetch task details" });
  }
};
