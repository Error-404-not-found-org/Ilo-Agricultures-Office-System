import mongoose from "mongoose";
import {
  AI_STATUS,
  isActiveAIRequestStatus,
} from "../domain/status-vocabulary.js";

const InseminationSchema = new mongoose.Schema(
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

    inseminationDate: {
      type: Date,
      // Removed required: true to allow pending requests
    },

    estrus: {
      type: String,
      enum: ["Natural", "Synchronized", "Induced"],
    },

    sireBreed: {
      type: String,
      trim: true,
      maxlength: 100,
      // Removed required: true to allow pending requests
    },

    sireCode: {
      type: String,
      trim: true,
      maxlength: 64,
      // Removed required: true to allow pending requests
    },

    semenDosesUsed: {
      type: Number,
      min: 1,
      default: function defaultSemenDosesUsedForNewCompletion() {
        return this.isNew && this.status === AI_STATUS.DONE ? 1 : undefined;
      },
      validate: {
        validator: Number.isSafeInteger,
        message: "Semen doses used must be a whole number.",
      },
      // Historical hydrated records remain undefined. Completion APIs also
      // normalize this default before conditional update operations.
    },

    status: {
      type: String,
      enum: Object.values(AI_STATUS),
      default: "pending",
    },

    // The technician who actually performed the AI
    technicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Materialized only while this request is active. A sparse unique index
    // makes the one-active-request-per-animal rule safe under concurrency.
    activeRequestKey: {
      type: String,
      default: undefined,
    },
    declinedByTechnicianIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    claimedAt: {
      type: Date,
      default: null,
    },

    // Set only by the Previous AI workflow. Missing remains the backwards-
    // compatible value for ordinary live/request-linked AI records.
    entryMode: {
      type: String,
      enum: ["history_only", "continue_tracking"],
      default: undefined,
    },
    attemptNumber: {
      type: Number,
      default: function defaultAttemptNumber() {
        return this.entryMode === "history_only" ? undefined : 1;
      },
    },
    previousAttemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Insemination",
      default: null,
    },
    attemptSeriesId: {
      type: mongoose.Schema.Types.ObjectId,
      default: function defaultAttemptSeriesId() {
        return this.entryMode === "history_only"
          ? undefined
          : new mongoose.Types.ObjectId();
      },
    },
    preferredDate: {
      type: Date,
    },
    scheduledDate: {
      type: Date,
    },
    scheduledAt: {
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
    // Immutable lifecycle evidence for the transition to a performed AI
    // service. Historical rows may legitimately omit this field.
    completedAt: {
      type: Date,
      default: null,
    },
    earlyStartMinutes: {
      type: Number,
      min: 0,
    },
    // Supporting Data for UNIP Form No. 2
    technicianNote: {
      type: String,
      default: "",
    },

    // Results tracking
    isSuccess: { type: Boolean, default: null }, // Legacy support
    outcome: {
      type: String,
      enum: [
        "Pending",
        "Pregnant",
        "Failed (Re-heat)",
        "Failed (Aborted)",
        "Failed (Negative PD)",
      ],
      default: "Pending",
    },
    pregnancyId: { type: mongoose.Schema.Types.ObjectId, ref: "Pregnancy" },
    breedingCycleStatus: {
      type: String,
      enum: ["active", "completed", "lost"],
      default: "active",
      index: true,
    },
    breedingCycleCompletedAt: { type: Date, default: null },
    outcomeVerificationStatus: {
      type: String,
      enum: ["pending", "reported", "verified"],
      default: "pending",
    },
    outcomeConfirmationSource: {
      type: String,
      enum: [
        "farmer_possible_pregnancy",
        "farmer_return_to_heat",
        "technician_pregnancy_diagnosis",
        "technician_negative_pd",
        "technician_return_to_heat",
        "technician_accepted_farmer_report",
        "legacy",
        null,
      ],
      default: null,
    },
    outcomeConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    outcomeConfirmedAt: { type: Date },
    failureReason: {
      type: String,
      enum: ["return_to_heat", "negative_pd", "aborted", "other", null],
      default: null,
    },

    imageUrl: {
      type: String,
      default: "",
    },
    photos: {
      type: [String],
      default: [],
    },
    comment: {
      type: String,
      default: "",
    },
    heatSigns: {
      type: [String],
      default: [],
    },
    farmerOutcomeReport: {
      type: String,
      enum: ["possible_pregnancy", "return_to_heat", "unsure", null],
      default: null,
    },
    observationSource: {
      type: String,
      enum: ["farmer", "technician", "farmer_app", "technician_phone", "technician_field", "paper_record", null],
      default: null,
    },
    observationRecordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    farmerOutcomeReportedAt: { type: Date },
    farmerObservationSigns: {
      type: [String],
      default: [],
    },
    farmerObservationNotes: {
      type: String,
      default: "",
    },
    evidencePhotos: {
      type: [String],
      default: [],
    },
    farmerPregnancyReport: {
      type: Boolean,
      default: false,
    },
    farmerPregnancyReportedAt: { type: Date },
    farmerPregnancyNotes: {
      type: String,
      default: "",
    },
    farmerPregnancyPhotos: {
      type: [String],
      default: [],
    },
    pregnancyReportVerificationStatus: {
      type: String,
      enum: ["not_requested", "pending", "more_info_requested", "accepted", "rejected"],
      default: "not_requested",
    },
    pregnancyReportReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    pregnancyReportReviewedAt: { type: Date },
    verificationRequested: {
      type: Boolean,
      default: false,
    },
    verificationStatus: {
      type: String,
      enum: ["not_requested", "pending", "verified", "rejected"],
      default: "not_requested",
    },
    verificationTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: { type: Date },
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
    // Farmer-only presentation preference. The official request remains
    // available to technicians, administrators, records, and audits.
    farmerDismissedAt: { type: Date, default: null },

    // Status history (mirrors HealthRequest)
    statusHistory: [{
      status: { type: String, required: true },
      note: { type: String, default: "" },
      actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      createdAt: { type: Date, default: Date.now },
    }],

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
  { timestamps: true },
);

// Indexes for scalability
InseminationSchema.index({ animalId: 1, createdAt: -1 });
InseminationSchema.index({ farmerId: 1 });
InseminationSchema.index({ farmerId: 1, farmerDismissedAt: 1, createdAt: -1 });
InseminationSchema.index({ status: 1 });
InseminationSchema.index({ scheduledDate: 1 });
InseminationSchema.index({ inseminationDate: -1 });
InseminationSchema.index({ deletedAt: 1 });
InseminationSchema.index({ declinedByTechnicianIds: 1 });
InseminationSchema.index({ previousAttemptId: 1 });
InseminationSchema.index({ attemptSeriesId: 1, attemptNumber: 1 });
InseminationSchema.index(
  { activeRequestKey: 1 },
  { unique: true, sparse: true, name: "uniq_active_ai_request_per_animal" },
);

InseminationSchema.pre("validate", function setActiveRequestKey() {
  this.activeRequestKey =
    !this.deletedAt && isActiveAIRequestStatus(this.status)
      ? String(this.animalId)
      : undefined;
});

export const Insemination = mongoose.model("Insemination", InseminationSchema);
