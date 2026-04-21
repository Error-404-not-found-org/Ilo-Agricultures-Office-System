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
      required: true,
    },

    estrus: {
      type: String,
      enum: ["Natural", "Synchronized"],
    },

    sireBreed: {
      type: String,
      required: true,
    },

    sireCode: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "done"],
      default: "pending",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    attemptNumber: {
      type: Number,
      required: true,
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
  },
  { timestamps: true },
);

export const Insemination = mongoose.model("Insemination", InseminationSchema);
