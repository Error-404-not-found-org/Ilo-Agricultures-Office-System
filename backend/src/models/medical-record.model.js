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
    healthRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HealthRequest",
    },
    type: {
      type: String,
      enum: ["Vaccination", "Treatment", "Deworming", "Check-up", "Weight Log", "General Note"],
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    isHistoricalEntry: {
      type: Boolean,
      default: false,
      index: true,
    },
    lateEntryReason: {
      type: String,
      trim: true,
    },
    performedByName: {
      type: String,
      trim: true,
    },
    entrySource: {
      type: String,
      enum: ["technician_entry", "historical_entry"],
      default: "technician_entry",
    },
    details: {
      medicineName: String,
      dosage: String,
      diagnosis: String,
      treatment: String,
      weight: Number, // in kg, if type is 'Weight Log'
      withdrawalPeriodDays: Number,
      withdrawalEndDate: Date,
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
MedicalRecordSchema.index({ healthRequestId: 1 }, { unique: true, sparse: true });

export const MedicalRecord = mongoose.model("MedicalRecord", MedicalRecordSchema);
