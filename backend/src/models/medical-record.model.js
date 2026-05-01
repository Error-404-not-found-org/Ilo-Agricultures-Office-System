import mongoose from "mongoose";

const MedicalRecordSchema = new mongoose.Schema(
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
    technicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["Vaccination", "Treatment", "Deworming", "Check-up", "Weight Log"],
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    details: {
      medicineName: String,
      dosage: String,
      diagnosis: String,
      treatment: String,
      weight: Number, // in kg, if type is 'Weight Log'
    },
    note: String,
    followUpDate: Date,
    imageUrl: String,
  },
  { timestamps: true }
);

// Indexes for fast profile lookups
MedicalRecordSchema.index({ animalId: 1, date: -1 });
MedicalRecordSchema.index({ type: 1 });

export const MedicalRecord = mongoose.model("MedicalRecord", MedicalRecordSchema);
