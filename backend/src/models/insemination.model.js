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
      enum: ["Natural", "Synchronized"],
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
    technicianNote: {
      type: String,
      default: "",
    },
    // New fields from AIRequest
    imageUrl: {
      type: String,
      default: "",
    },
    comment: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

// Indexes for scalability
InseminationSchema.index({ animalId: 1, createdAt: -1 });
InseminationSchema.index({ farmerId: 1 });
InseminationSchema.index({ status: 1 });
InseminationSchema.index({ scheduledDate: 1 });
InseminationSchema.index({ inseminationDate: -1 });

export const Insemination = mongoose.model("Insemination", InseminationSchema);
