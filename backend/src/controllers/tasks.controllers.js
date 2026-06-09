import { Task } from "../models/task.model.js";
import { User } from "../models/user.model.js";

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
    // Group them or just return them sorted? Returning sorted by category + date is good.
    const tasks = await Task.find({ 
      $or: [ { technicianId }, { technicianId: { $exists: false } }, { technicianId: null } ], 
      status: "Pending" 
    })
      .populate("farmerId", "name imageUrl phoneNumber address")
      .populate("animalIds", "animalId earTag species breed color")
      .sort({ createdAt: -1 });

    res.status(200).json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ message: "Failed to fetch tasks" });
  }
};

// POST /api/tasks
export const createTask = async (req, res) => {
  try {
    const technicianId = req.user._id;
    const { farmerId, animalIds, category, notes } = req.body;

    if (!farmerId || !category || !notes) {
      return res.status(400).json({ message: "Farmer, category, and notes are required." });
    }

    const newTask = await Task.create({
      technicianId,
      farmerId,
      animalIds: animalIds || [],
      category,
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
    const task = await Task.findOneAndUpdate(
      { _id: id, $or: [ { technicianId: req.user._id }, { technicianId: { $exists: false } }, { technicianId: null } ] },
      { status: "Completed", technicianId: req.user._id },
      { returnDocument: 'after' }
    );
    if (!task) return res.status(404).json({ message: "Task not found" });
    
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
      .populate("farmerId", "name imageUrl phoneNumber address")
      .populate("animalIds", "animalId earTag species breed color");

    if (!task) return res.status(404).json({ message: "Task not found" });

    res.status(200).json(task);
  } catch (error) {
    console.error("Error fetching task details:", error);
    res.status(500).json({ message: "Failed to fetch task details" });
  }
};
