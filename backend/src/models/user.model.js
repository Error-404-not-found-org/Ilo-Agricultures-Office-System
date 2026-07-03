import mongoose from "mongoose";

const AddressSchema = new mongoose.Schema({
  // House / unit info
  houseNumber: { type: String },
  street: { type: String, required: false },
  subdivision: { type: String },

  // Philippine-specific fields
  barangay: { type: String, required: true },
  city: { type: String, required: true },
  province: { type: String, required: true },
  region: { type: String, required: false },

  zipCode: {
    type: String,
    match: [/^[0-9]{2,6}$/, "Zip code must be between 2 and 6 digits."],
    required: false,
  },
  phoneNumber: { type: String, required: false },

  landmark: { type: String },
  detectedAddress: { type: String },
  locationCapturedAt: { type: Date },
  coordinates: {
    lat: { type: Number },
    lng: { type: Number },
  },
  isDefault: { type: Boolean, default: false },
});

const FarmLocationSchema = new mongoose.Schema(
  {
    latitude: { type: Number },
    longitude: { type: Number },
    accuracy: { type: Number },
    landmark: { type: String, default: "" },
    directionsNote: { type: String, default: "" },
    detectedAddress: { type: String, default: "" },
    sameAsContactAddress: { type: Boolean, default: false },
    isConfirmed: { type: Boolean, default: false },
    confirmedAt: { type: Date, default: null },
    capturedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    capturedAt: { type: Date },
    source: {
      type: String,
      enum: ["farmer_current_location", "technician_current_location", "manual"],
      default: "manual",
    },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    clerkId: { type: String, unique: true, sparse: true },

    email: {
      type: String,
      required: false,
      sparse: true,
    },
    name: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      default: "",
    },
    phoneNumber: {
      type: String,
    },
    address: {
      type: AddressSchema,
      required: false,
    },
    farmLocation: {
      type: FarmLocationSchema,
      default: null,
    },
    role: {
      type: String,
      enum: ["admin", "technician", "veterinarian", "farmer"],
      default: "farmer",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "on-site", "on-leave", "suspended"],
      default: "active",
    },
    lastLogin: {
      type: Date,
    },
    pushToken: {
      type: String,
      default: "",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deactivatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

// Performance indexes
userSchema.index({ name: 1 });
userSchema.index({ role: 1 });
userSchema.index({ deletedAt: 1 });

export const User = mongoose.model("User", userSchema);
