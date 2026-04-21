import mongoose from "mongoose";

const AIRequestSchema = new mongoose.Schema(
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
    imageUrl: {
      type: String,
      default: "",
    },
    comment: {
      type: String,
      default: "",
    },
    preferredDate: {
      type: Date,
      default: Date.now,
    },
    scheduledDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "done"],
      default: "pending",
    },
    // Technician or admin who handled the request
    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Optional technician note / response
    technicianNote: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export const AIRequest = mongoose.model("AIRequest", AIRequestSchema);
