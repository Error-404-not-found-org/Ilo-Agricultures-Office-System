import mongoose from "mongoose";

const AddressSchema = new mongoose.Schema({
  // House / unit info
  houseNumber: { type: String },
  street: { type: String, required: true },
  subdivision: { type: String },

  // Philippine-specific fields
  barangay: { type: String, required: true },
  city: { type: String, required: true },
  province: { type: String, required: true },
  region: { type: String, required: true },

  zipCode: {
    type: String,
    match: [/^[0-9]{2,6}$/, "Zip code must be between 2 and 6 digits."],
    required: true,
  },
  phoneNumber: { type: String, required: true },

  landmark: { type: String },

  isDefault: { type: Boolean, default: false },
});

const userSchema = new mongoose.Schema(
  {
    clerkId: { type: String, unique: true, sparse: true },

    email: {
      type: String,
      required: true,
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
  },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);
