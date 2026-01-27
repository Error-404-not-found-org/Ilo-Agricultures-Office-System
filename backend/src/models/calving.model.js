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

    date: Date,
    numberOfCalves: Number,

    calfSex: {
      type: String,
      enum: ["M", "F"],
    },

    calvingEase: {
      type: String,
      enum: ["Normal", "Difficult", "Abortion", "Stillbirth"],
    },
  },
  { timestamps: true },
);

export const Calving = mongoose.model("Calving", CalvingSchema);
