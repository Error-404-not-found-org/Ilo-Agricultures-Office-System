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
      enum: ["pending", "approved", "rejected", "done", "in-progress"],
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
      enum: ["Pending", "Pregnant", "Failed (Re-heat)", "Failed (Aborted)", "Failed (Negative PD)"],
      default: "Pending"
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

export const Insemination = mongoose.model("Insemination", InseminationSchema);
