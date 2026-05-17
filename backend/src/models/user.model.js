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
  coordinates: {
    lat: { type: Number },
    lng: { type: Number },
  },
  isDefault: { type: Boolean, default: false },
});

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
    role: {
      type: String,
      enum: ["admin", "technician", "farmer"],
      default: "farmer",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "on-site", "on-leave"],
      default: "active",
    },
    pushToken: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

// Performance indexes
userSchema.index({ name: 1 });
userSchema.index({ role: 1 });

export const User = mongoose.model("User", userSchema);
