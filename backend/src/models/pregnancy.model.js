import mongoose from "mongoose";

const PregnancySchema = new mongoose.Schema(
  {
    animal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Animal",
      required: true,
    },

    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    insemination: {
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
  },
  { timestamps: true },
);

export const Pregnancy = mongoose.model("Pregnancy", PregnancySchema);
