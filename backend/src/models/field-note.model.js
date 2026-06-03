import mongoose from "mongoose";

const FieldNoteSchema = new mongoose.Schema(
  {
    technicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    farmerName: {
      type: String,
      default: "",
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    imageUrl: {
      type: String,
      default: "",
    },
    latitude: {
      type: String,
      default: "",
    },
    longitude: {
      type: String,
      default: "",
    },
    locationName: {
      type: String,
      default: "Oton, Iloilo",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const FieldNote = mongoose.model("FieldNote", FieldNoteSchema);
