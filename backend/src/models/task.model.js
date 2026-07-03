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
      enum: [
        "GeneralVisit",
        "FarmInspection",
        "FollowUp",
        "Health",
        "AI",
        "PD",
        "CD",
        "Calving",
        "Vaccination",
        "Deworming",
        "Treatment",
        "Registration",
        "Other",
      ],
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
    dueDate: {
      type: Date,
      default: null,
    },
    sourceType: {
      type: String,
      enum: [
        "manual",
        "client_profile",
        "task_scheduler",
        "automatic_pd_followup",
        "farmer_requested_verification",
      ],
      default: "manual",
    },
    relatedRecordType: {
      type: String,
      enum: [null, "insemination", "health", "pregnancy", "calving"],
      default: null,
    },
    relatedRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

TaskSchema.index({ taskType: 1, sourceType: 1, dueDate: 1, status: 1 });
TaskSchema.index({ taskType: 1, sourceType: 1, "metadata.inseminationId": 1 });

export const Task = mongoose.model("Task", TaskSchema);
