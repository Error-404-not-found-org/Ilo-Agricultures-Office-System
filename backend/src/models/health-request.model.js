import mongoose from "mongoose";
import { HEALTH_STATUS } from "../domain/livestock-workflow.js";
import { isActiveHealthRequestStatus } from "../domain/status-vocabulary.js";

const HealthRequestSchema = new mongoose.Schema(
  {
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    animalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Animal",
      required: true,
    },
    activeCaseKey: {
      type: String,
      default: undefined,
    },
    // What kind of request is this?
    requestType: {
      type: String,
      enum: [
        "disease", "medicine", "checkup", "injury", "vaccination", "deworming",
        "weakness", "abnormal_behavior", "loss_of_appetite", "pregnancy_complication",
        "wound", "fever", "difficult_calving", "other"
      ],
      default: "disease",
    },
    // Description of symptoms or issue
    symptoms: {
      type: String,
      required: true,
    },
    // 'low' = can wait, 'medium' = soon, 'high' = urgent / emergency
    urgency: {
      type: String,
      enum: ["low", "medium", "high", "emergency"],
      default: "medium",
    },
    imageUrl: {
      type: String,
      default: "",
    },
    photos: {
      type: [String],
      default: [],
    },
    farmerNotes: { type: String, default: "" },
    preferredDate: {
      type: Date,
      default: Date.now,
    },
    scheduledDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: Object.values(HEALTH_STATUS),
      default: HEALTH_STATUS.PENDING,
    },
    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    declinedByTechnicianIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    claimedAt: {
      type: Date,
      default: null,
    },
    assignedTechnicianId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedVeterinarianId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    technicianNote: {
      type: String,
      default: "",
    },
    diagnosis: {
      type: String,
      default: "",
    },
    findings: { type: String, default: "" },
    treatment: {
      type: String,
      default: "", // Medicine or procedures given
    },
    medicineGiven: { type: String, default: "" },
    dosage: { type: String, default: "" },
    withdrawalPeriodDays: { type: Number },
    withdrawalEndDate: { type: Date },
    followUpDate: { type: Date },
    resolutionNotes: { type: String, default: "" },
    resolvedAt: { type: Date },
    statusHistory: [{
      status: { type: String, required: true },
      note: { type: String, default: "" },
      actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      createdAt: { type: Date, default: Date.now },
    }],
    advice: {
      type: String,
      default: "", // Advice for the farmer
    },
    // Cancellation tracking
    cancellationStatus: {
      type: String,
      enum: ["none", "requested", "approved", "rejected"],
      default: "none",
    },
    cancellationReason: { type: String, default: "" },
    cancellationResponseReason: { type: String, default: "" },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancellationRequestedAt: { type: Date },
    cancellationRespondedAt: { type: Date },
    // Hides a terminal request from its farmer without deleting the official
    // service history used by technicians and administrators.
    farmerDismissedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Indexes for scalability
HealthRequestSchema.index({ animalId: 1, createdAt: -1 });
HealthRequestSchema.index({ farmerId: 1 });
HealthRequestSchema.index({ farmerId: 1, farmerDismissedAt: 1, createdAt: -1 });
HealthRequestSchema.index({ status: 1 });
HealthRequestSchema.index({ urgency: -1, createdAt: -1 });
HealthRequestSchema.index({ scheduledDate: 1 });
HealthRequestSchema.index({ assignedTechnicianId: 1, status: 1 });
HealthRequestSchema.index({ assignedVeterinarianId: 1, status: 1 });
HealthRequestSchema.index({ deletedAt: 1 });
HealthRequestSchema.index({ declinedByTechnicianIds: 1 });
HealthRequestSchema.index(
  { activeCaseKey: 1 },
  { unique: true, sparse: true, name: "uniq_active_health_case_per_animal_type" },
);

HealthRequestSchema.pre("validate", function setActiveCaseKey() {
  this.activeCaseKey =
    !this.deletedAt && isActiveHealthRequestStatus(this.status)
      ? `${this.animalId}:${this.requestType || "disease"}`
      : undefined;
});

export const HealthRequest = mongoose.model("HealthRequest", HealthRequestSchema);
