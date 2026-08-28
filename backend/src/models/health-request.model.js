import mongoose from "mongoose";
import { HEALTH_STATUS } from "../domain/livestock-workflow.js";
import {
  HEALTH_HANDLING_METHOD,
  isActiveHealthRequestStatus,
} from "../domain/status-vocabulary.js";
import { CANONICAL_HEALTH_REQUEST_TYPE } from "../domain/health-request-vocabulary.js";
import {
  HEALTH_OBSERVED_SIGN,
  HEALTH_REQUEST_DESCRIPTION_MAX_LENGTH,
  HEALTH_REQUEST_DETAILS_VERSION,
} from "../domain/health-request-input.js";

const HealthRequestDetailsSchema = new mongoose.Schema(
  {
    version: {
      type: Number,
      enum: [HEALTH_REQUEST_DETAILS_VERSION],
      required: true,
    },
    assistanceRequested: {
      type: String,
      enum: Object.values(CANONICAL_HEALTH_REQUEST_TYPE),
      required: true,
    },
    observedSigns: {
      type: [{ type: String, enum: Object.values(HEALTH_OBSERVED_SIGN) }],
      default: [],
    },
    farmerDescription: {
      type: String,
      trim: true,
      maxlength: HEALTH_REQUEST_DESCRIPTION_MAX_LENGTH,
      default: "",
    },
  },
  { _id: false },
);

const HealthRequestPickupResponseSchema = new mongoose.Schema(
  {
    item: { type: String, trim: true },
    availabilityConfirmed: { type: Boolean },
    instructions: { type: String, trim: true },
    dosageOrUseInstructions: { type: String, trim: true },
    withdrawalGuidance: { type: String, trim: true },
  },
  { _id: false },
);

const HealthRequestTechnicianResponseSchema = new mongoose.Schema(
  {
    pickup: {
      type: HealthRequestPickupResponseSchema,
      default: undefined,
    },
  },
  { _id: false },
);

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
    // Durable identity for a Technician walk-in submission. This survives the
    // short-lived HTTP idempotency cache so a stale retry can recover the
    // already committed request instead of creating another service record.
    sourceOperationKey: {
      type: String,
      trim: true,
      select: false,
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
    requestDetails: {
      type: HealthRequestDetailsSchema,
      default: undefined,
    },
    handlingMethod: {
      type: String,
      enum: Object.values(HEALTH_HANDLING_METHOD),
      default: undefined,
    },
    technicianResponse: {
      type: HealthRequestTechnicianResponseSchema,
      default: undefined,
    },
    preferredDate: {
      type: Date,
    },
    scheduledDate: {
      type: Date,
    },
    visitPeriod: {
      type: String,
      enum: ["morning", "afternoon"],
      trim: true,
      lowercase: true,
    },
    serviceStartedAt: {
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
    dispatch: {
      location: {
        municipalityCode: { type: String },
        municipalityName: { type: String },
        localityType: { type: String, enum: ["municipality", "city", "unresolved"] },
        provinceCode: { type: String },
        provinceName: { type: String },
        barangayCode: { type: String },
        barangayName: { type: String },
        source: {
          type: String,
          enum: ["confirmed_farm_location", "canonical_contact_address", "legacy_address_fallback", "unresolved"],
        },
        psgcVersion: { type: String },
      },
      stage: { type: String, enum: ["local", "adjacent", "regional"], default: "local" },
      resolutionStatus: { type: String, enum: ["resolved", "legacy_fallback", "unresolved"] },
      version: { type: Number, default: 1 },
      resolvedAt: { type: Date },
    },
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

HealthRequestSchema.index({ deletedAt: 1 });
HealthRequestSchema.index({ declinedByTechnicianIds: 1 });
HealthRequestSchema.index(
  { activeCaseKey: 1 },
  { unique: true, sparse: true, name: "uniq_active_health_case_per_animal_type" },
);
HealthRequestSchema.index(
  { handledBy: 1, sourceOperationKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      handledBy: { $type: "objectId" },
      sourceOperationKey: { $type: "string" },
    },
    name: "uniq_walkin_health_operation_per_technician",
  },
);

HealthRequestSchema.pre("validate", function setActiveCaseKey() {
  this.activeCaseKey =
    !this.deletedAt && isActiveHealthRequestStatus(this.status)
      ? `${this.animalId}:${this.requestType || "disease"}`
      : undefined;
});

export const HealthRequest = mongoose.model("HealthRequest", HealthRequestSchema);
