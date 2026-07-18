import mongoose from "mongoose";
import { TASK_STATUS } from "../domain/status-vocabulary.js";

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
      enum: Object.values(TASK_STATUS),
      default: TASK_STATUS.PENDING,
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
  {
    timestamps: true,
    // Task indexes are deployment-managed after read-only duplicate audits.
    autoIndex: false,
  },
);

TaskSchema.index({ taskType: 1, sourceType: 1, dueDate: 1, status: 1 });
TaskSchema.index({ taskType: 1, sourceType: 1, "metadata.inseminationId": 1 });
TaskSchema.index({ taskType: 1, "metadata.workflowStage": 1, "metadata.pregnancyId": 1, status: 1 });
// Deployment intent: allow only one continuation milestone task per Pregnancy.
// Before explicit production index deployment, run a read-only duplicate audit for this key.
TaskSchema.index(
  { taskType: 1, "metadata.workflowStage": 1, "metadata.pregnancyId": 1 },
  {
    unique: true,
    partialFilterExpression: {
      taskType: "PD",
      "metadata.workflowStage": "continuation_recheck",
      "metadata.pregnancyId": { $exists: true },
    },
    name: "uniq_pregnancy_continuation_task",
  },
);
// Deployment intent: allow only one Pending diagnostic follow-up per Pregnancy.
// Audit duplicate Pending rows read-only before explicitly deploying this index.
TaskSchema.index(
  { taskType: 1, "metadata.workflowStage": 1, "metadata.pregnancyId": 1 },
  {
    unique: true,
    partialFilterExpression: {
      taskType: "PD",
      "metadata.workflowStage": "diagnostic_follow_up",
      "metadata.pregnancyId": { $exists: true },
      status: "Pending",
    },
    name: "uniq_open_pregnancy_follow_up_task",
  },
);

export const Task = mongoose.model("Task", TaskSchema);
