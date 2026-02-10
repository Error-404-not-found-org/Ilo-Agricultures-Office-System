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
    match: /^[0-9]{4}$/,
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
  },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);
