import mongoose from "mongoose";

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
    // What kind of request is this?
    requestType: {
      type: String,
      enum: ["disease", "medicine", "checkup", "injury", "other"],
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
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    imageUrl: {
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
      enum: ["pending", "in-progress", "resolved", "cancelled"],
      default: "pending",
    },
    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    technicianNote: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Indexes for scalability
HealthRequestSchema.index({ animalId: 1, createdAt: -1 });
HealthRequestSchema.index({ farmerId: 1 });
HealthRequestSchema.index({ status: 1 });
HealthRequestSchema.index({ scheduledDate: 1 });

export const HealthRequest = mongoose.model("HealthRequest", HealthRequestSchema);
