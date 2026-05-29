import mongoose from "mongoose";

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
        enum: ["Pregnant", "Empty"],
      },
    },

    // Optional target calving date
    targetCalvingDate: Date,

    // Optional technician notes
    technicianNote: String,
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Indexes for scalability
PregnancySchema.index({ animalId: 1, createdAt: -1 });
PregnancySchema.index({ farmerId: 1 });
PregnancySchema.index({ deletedAt: 1 });

export const Pregnancy = mongoose.model("Pregnancy", PregnancySchema);
