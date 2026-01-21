import mongoose from "mongoose";

const AnimalSchema = new mongoose.Schema(
  {
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    earTag: String,

    species: {
      type: String,
      enum: ["Beef", "Dairy", "Carabao", "Goat", "Swine"],
      required: true,
    },

    breed: { type: String, required: true },
    color: { type: String },
    imageUrl: { type: String },
  },
  { timestamps: true },
);

export const Animal = mongoose.model("Animal", AnimalSchema);
