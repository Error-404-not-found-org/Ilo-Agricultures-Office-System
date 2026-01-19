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
    email: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      default: "",
    },
    clerkId: {
      type: String,
      unique: true,
      required: true,
    },
    address: {
      type: AddressSchema,
      required: false,
    },
  },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);
