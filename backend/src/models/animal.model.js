import mongoose from "mongoose";

const AnimalSchema = new mongoose.Schema(
  {
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    animalId: { type: String, required: true },
    earTag: { type: String },
    brand: { type: String },

    species: {
      type: String,
      enum: ["Beef", "Dairy", "Carabao", "Goat", "Swine"],
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
      enum: ["Normal", "In Heat", "Inseminated", "Likely Pregnant", "Pregnant", "Dry", "Lactating"],
      default: "Normal",
    },
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
  },
  { timestamps: true },
);

// Indexes for scalability
AnimalSchema.index({ farmerId: 1 });
AnimalSchema.index({ animalId: 1 });
AnimalSchema.index({ earTag: 1 });
AnimalSchema.index({ species: 1 });
AnimalSchema.index({ createdAt: -1 });

export const Animal = mongoose.model("Animal", AnimalSchema);
