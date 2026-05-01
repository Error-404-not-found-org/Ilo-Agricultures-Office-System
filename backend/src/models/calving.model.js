import mongoose from "mongoose";

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

    date: {
      type: Date,
      default: Date.now,
    },
    numberOfCalves: {
      type: Number,
      default: 1,
    },
    calves: [{
      sex: { type: String, enum: ["M", "F"] },
      earTag: String,
      weight: Number,
      animalId: { type: mongoose.Schema.Types.ObjectId, ref: "Animal" }
    }],
    calvingEase: {
      type: String,
      enum: ["Normal", "Difficult", "Abortion", "Stillbirth"],
      default: "Normal"
    },
    technicianNote: String,
  },
  { timestamps: true },
);

export const Calving = mongoose.model("Calving", CalvingSchema);
