import mongoose from "mongoose";
import { PREGNANCY_RESULT } from "../domain/status-vocabulary.js";

const PregnancySchema = new mongoose.Schema(
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

    inseminationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Insemination",
      required: true,
      unique: true,
    },

    pregnancyDiagnosis: {
      date: Date,
      result: {
        type: String,
        enum: Object.values(PREGNANCY_RESULT),
      },
    },

    // Optional target calving date
    targetCalvingDate: Date,

    // Optional technician notes
    technicianNote: String,
    cycleStatus: {
      type: String,
      enum: ["active", "completed", "lost"],
      default: "active",
      index: true,
    },

    confirmation: {
      methodCode: {
        type: String,
        enum: [
          "blood_pag",
          "milk_pag",
          "ultrasound",
          "rectal_palpation",
          "clinical_examination",
          "other_approved",
          null,
        ],
        default: null,
      },
      stage: {
        type: String,
        enum: ["early", "standard", "legacy_unclassified"],
        default: "legacy_unclassified",
      },
      confirmedAt: { type: Date, default: null },
      confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      policyVersion: { type: String, default: null },
      earliestThresholdSnapshot: { type: Number, min: 0, default: null },
      recheckRequired: { type: Boolean, default: false },
      recheckDueAt: { type: Date, default: null },
    },
    recheckStatus: {
      type: String,
      enum: [
        "not_required",
        "pending",
        "continuing",
        "loss_detected",
        "follow_up_required",
      ],
      default: "not_required",
      index: true,
    },
    completedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Indexes for scalability
PregnancySchema.index({ animalId: 1, createdAt: -1 });
PregnancySchema.index({ farmerId: 1 });
PregnancySchema.index({ deletedAt: 1 });

PregnancySchema.methods.getConfirmationMetadata = function getConfirmationMetadata() {
  return this.confirmation?.stage
    ? this.confirmation
    : { stage: "legacy_unclassified", methodCode: null };
};

export const Pregnancy = mongoose.model("Pregnancy", PregnancySchema);
