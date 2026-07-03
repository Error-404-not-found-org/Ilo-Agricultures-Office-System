import mongoose from "mongoose";

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
      // Removed required: true to allow pending requests
    },

    sireCode: {
      type: String,
      // Removed required: true to allow pending requests
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "done", "in-progress", "scheduled", "cancelled"],
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
    declinedByTechnicianIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    claimedAt: {
      type: Date,
      default: null,
    },

    attemptNumber: {
      type: Number,
      default: 1,
    },
    preferredDate: {
      type: Date,
      default: Date.now,
    },
    scheduledDate: {
      type: Date,
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

    imageUrl: {
      type: String,
      default: "",
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
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancellationRequestedAt: { type: Date },

    // Status history (mirrors HealthRequest)
    statusHistory: [{
      status: { type: String, required: true },
      note: { type: String, default: "" },
      actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      createdAt: { type: Date, default: Date.now },
    }],

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Indexes for scalability
InseminationSchema.index({ animalId: 1, createdAt: -1 });
InseminationSchema.index({ farmerId: 1 });
InseminationSchema.index({ status: 1 });
InseminationSchema.index({ scheduledDate: 1 });
InseminationSchema.index({ inseminationDate: -1 });
InseminationSchema.index({ deletedAt: 1 });
InseminationSchema.index({ declinedByTechnicianIds: 1 });

export const Insemination = mongoose.model("Insemination", InseminationSchema);
