import mongoose from "mongoose";
import { CALVING_EASE } from "../domain/status-vocabulary.js";

const CalvingSchema = new mongoose.Schema(
  {
    animalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Animal",
      required: true,
    },
    
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    pregnancyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pregnancy",
      required: true,
      unique: true,
    },
    inseminationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Insemination",
      required: true,
    },

    date: {
      type: Date,
      default: Date.now,
    },
    numberOfCalves: {
      type: Number,
      default: 1,
    },
    totalDelivered: { type: Number, default: 0, min: 0 },
    calves: [{
      sex: { type: String, enum: ["M", "F"] },
      earTag: String,
      animalId: { type: mongoose.Schema.Types.ObjectId, ref: "Animal" }
    }],
    outcome: {
      type: String,
      enum: ["live_birth", "mixed", "abortion", "stillbirth"],
      required: true,
    },
    // Pregnancy-loss offspring are deliberately embedded here instead of
    // being registered as active Animal documents.
    nonLivingCalves: [{
      sex: { type: String, enum: ["M", "F"] },
      earTag: { type: String, default: "" },
      color: { type: String, default: "" },
      brand: { type: String, default: "" },
    }],
    livingCalfCount: { type: Number, default: 0, min: 0 },
    stillbornCount: { type: Number, default: 0, min: 0 },
    calvingEase: {
      type: String,
      enum: Object.values(CALVING_EASE),
      default: CALVING_EASE.NATURAL
    },
    technicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    locationAddress: {
      type: String,
    },
    technicianNote: String,
    isSeen: {
      type: Boolean,
      default: false,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Indexes for scalability
CalvingSchema.index({ animalId: 1 });
CalvingSchema.index({ inseminationId: 1 });
CalvingSchema.index({ deletedAt: 1 });

export const Calving = mongoose.model("Calving", CalvingSchema);
