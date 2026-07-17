import mongoose from "mongoose";
import { ANIMAL_REPRODUCTIVE_STATUS } from "../domain/livestock-workflow.js";
import {
  LEGACY_ANIMAL_REPRODUCTIVE_STATUS,
  normalizeAnimalReproductiveStatus,
} from "../domain/status-vocabulary.js";

const AnimalSchema = new mongoose.Schema(
  {
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    animalId: { type: String, required: true },
    earTag: { type: String, trim: true },
    normalizedEarTag: { type: String, select: false },
    brand: { type: String },

    species: {
      type: String,
      enum: ["Beef", "Dairy", "Beef Cattle", "Dairy Cattle", "Cattle", "Carabao", "Goat", "Swine"],
      required: true,
    },

    birthDate: { type: Date },

    breed: { type: String, required: true },
    color: { type: String },
    imageUrl: { type: String },
    gender: {
      type: String,
      enum: ["Male", "Female"],
      default: "Female",
    },
    reproductiveStatus: {
      type: String,
      enum: [
        ...Object.values(ANIMAL_REPRODUCTIVE_STATUS),
        ...Object.values(LEGACY_ANIMAL_REPRODUCTIVE_STATUS),
      ],
      default: ANIMAL_REPRODUCTIVE_STATUS.NORMAL,
      set: normalizeAnimalReproductiveStatus,
    },
    
    // Advanced Reproduction Tracking
    lastInseminationDate: { type: Date },
    expectedCalvingDate: { type: Date },
    lastCalvingDate: { type: Date },
    lastPregnancyLossDate: { type: Date },
    parity: { type: Number, default: 0 }, // Number of births
    sireDetails: {
      breed: { type: String },
      code: { type: String },
    },

    // Health & Performance History
    bcsHistory: [{
      score: { type: Number, min: 1, max: 9 }, // Body Condition Score
      recordedAt: { type: Date, default: Date.now }
    }],
    geneticLineage: { type: String }, // Additional notes on breed purity/lineage

    activityLogs: [{
      event: { type: String },
      date: { type: Date, default: Date.now },
      description: { type: String }
    }],

    isVerified: {
      type: Boolean,
      default: false,
    },
    // Lineage Tracking
    motherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Animal",
      default: null,
    },
    // Barangay caching for fast localized routing/listing queries
    barangay: { type: String },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

AnimalSchema.pre("validate", function normalizeEarTagForUniqueIndex() {
  const normalized = String(this.earTag || "").trim().toLowerCase();
  this.normalizedEarTag = normalized || undefined;
});

const normalizeEarTagUpdate = function normalizeEarTagUpdate() {
  const update = this.getUpdate() || {};
  const earTag = update.$set?.earTag ?? update.earTag;
  if (earTag === undefined) return;
  const trimmed = String(earTag || "").trim();
  const normalized = trimmed.toLowerCase();
  if (update.$set) update.$set.earTag = trimmed;
  else update.earTag = trimmed;
  if (normalized) {
    if (update.$set) update.$set.normalizedEarTag = normalized;
    else update.normalizedEarTag = normalized;
  } else {
    if (update.$set) delete update.$set.normalizedEarTag;
    else delete update.normalizedEarTag;
    update.$unset = { ...(update.$unset || {}), normalizedEarTag: 1 };
  }
};
AnimalSchema.pre("findOneAndUpdate", normalizeEarTagUpdate);
AnimalSchema.pre("updateOne", normalizeEarTagUpdate);
AnimalSchema.pre("updateMany", normalizeEarTagUpdate);

// Indexes for scalability
AnimalSchema.index({ farmerId: 1 });
AnimalSchema.index({ animalId: 1 });
AnimalSchema.index({ earTag: 1 });
AnimalSchema.index(
  { farmerId: 1, normalizedEarTag: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deletedAt: null,
      normalizedEarTag: { $type: "string", $gt: "" },
    },
    name: "uniq_active_ear_tag_per_farmer",
  },
);
AnimalSchema.index({ species: 1 });
AnimalSchema.index({ barangay: 1 });
AnimalSchema.index({ deletedAt: 1 });
AnimalSchema.index({ createdAt: -1 });

export const Animal = mongoose.model("Animal", AnimalSchema);
