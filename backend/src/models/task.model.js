import mongoose from "mongoose";

const TaskSchema = new mongoose.Schema(
  {
    technicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    animalIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Animal",
      },
    ],
    taskType: {
      type: String,
      enum: ["AI", "PD", "CD", "Vaccination", "Deworming", "Treatment", "Registration", "Other"],
      default: "Other",
    },
    category: {
      type: String,
      enum: ["Urgent", "Routine", "Follow-up", "Emergency"],
      required: true,
    },
    priority: {
      type: Number,
      default: 2, // 1: High, 2: Medium, 3: Low
    },
    notes: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "Cancelled"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

export const Task = mongoose.model("Task", TaskSchema);
