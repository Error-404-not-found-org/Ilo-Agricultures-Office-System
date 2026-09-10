import mongoose from "mongoose";

export const PREGNANCY_LOSS_REPORT_STATUS = Object.freeze({
  PENDING_REVIEW: "pending_review",
  CONFIRMED: "confirmed",
  NOT_CONFIRMED: "not_confirmed",
  NEEDS_VISIT: "needs_visit",
});

const PregnancyLossReportSchema = new mongoose.Schema(
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
    },
    inseminationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Insemination",
      required: true,
    },
    reportedAt: { type: Date, default: Date.now, required: true },
    observationDate: { type: Date, required: true },
    notes: { type: String, trim: true, maxlength: 2000, default: "" },
    evidencePhotos: {
      type: [{ type: String, trim: true }],
      default: [],
      validate: {
        validator: (photos) => photos.length <= 3,
        message: "Maximum of 3 evidence photos allowed.",
      },
    },
    status: {
      type: String,
      enum: Object.values(PREGNANCY_LOSS_REPORT_STATUS),
      default: PREGNANCY_LOSS_REPORT_STATUS.PENDING_REVIEW,
      required: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    reviewNotes: { type: String, trim: true, maxlength: 2000, default: "" },
    confirmedCalvingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Calving",
      default: null,
    },
  },
  {
    timestamps: true,
    // Duplicate active reports are guarded at the service boundary. Deployment
    // indexes remain explicit because production autoIndex is disabled.
    autoIndex: false,
  },
);

export const PregnancyLossReport = mongoose.model(
  "PregnancyLossReport",
  PregnancyLossReportSchema,
);
