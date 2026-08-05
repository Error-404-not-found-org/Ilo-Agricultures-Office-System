import mongoose from "mongoose";

const AddressSchema = new mongoose.Schema({
  houseNumber: { type: String },
  street: { type: String, required: false },
  subdivision: { type: String },
  barangay: { type: String, required: true },
  city: { type: String, required: true },
  district: { type: String, required: false },
  province: { type: String, required: true },
  region: { type: String, required: false },
  zipCode: {
    type: String,
    match: [/^[0-9]{2,6}$/, "Zip code must be between 2 and 6 digits."],
    required: false,
  },
  phoneNumber: {
    type: String,
    required: false,
  },
  landmark: { type: String },
  detectedAddress: { type: String },
  locationCapturedAt: { type: Date },
  coordinates: {
    lat: { type: Number },
    lng: { type: Number },
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
});

const FarmLocationSchema = new mongoose.Schema(
  {
    latitude: { type: Number },
    longitude: { type: Number },
    accuracy: { type: Number },
    landmark: {
      type: String,
      default: "",
    },
    directionsNote: {
      type: String,
      default: "",
    },
    detectedAddress: {
      type: String,
      default: "",
    },
    sameAsContactAddress: {
      type: Boolean,
      default: false,
    },
    isConfirmed: {
      type: Boolean,
      default: false,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    capturedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    capturedAt: {
      type: Date,
    },
    source: {
      type: String,
      enum: [
        "farmer_current_location",
        "technician_current_location",
        "manual",
      ],
      default: "manual",
    },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    clerkId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    email: {
      type: String,
      required: false,
      trim: true,
    },
    normalizedEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: undefined,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      default: "",
    },
    phoneNumber: {
      type: String,
    },
    normalizedPhoneNumber: {
      type: String,
      default: "",
      index: true,
    },
    registeredByTechnician: {
      type: Boolean,
      default: false,
    },
    profileClaimStatus: {
      type: String,
      enum: ["none", "unclaimed", "claimed", "blocked"],
      default: "none",
    },
    profileClaimedAt: {
      type: Date,
      default: null,
    },
    profileClaimedByClerkId: {
      type: String,
      default: "",
    },
    phoneVerification: {
      pendingPhoneNumber: {
        type: String,
        default: "",
      },
      pendingNormalizedPhoneNumber: {
        type: String,
        default: "",
      },
      isVerified: {
        type: Boolean,
        default: false,
      },
      verifiedAt: {
        type: Date,
        default: null,
      },
      lastOtpSentAt: {
        type: Date,
        default: null,
      },
      failedAttempts: {
        type: Number,
        default: 0,
      },
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
  {
    timestamps: true,
  },
);

/**
 * Normalize email addresses before validating and saving a document.
 *
 * Empty or missing email values remain undefined so multiple users without
 * an email do not conflict with the partial unique index.
 */
userSchema.pre("validate", function normalizeUserEmail() {
  if (typeof this.email === "string" && this.email.trim()) {
    const normalizedEmail = this.email.trim().toLowerCase();

    this.email = normalizedEmail;
    this.normalizedEmail = normalizedEmail;
  } else {
    this.email = undefined;
    this.normalizedEmail = undefined;
  }
});

userSchema.pre("findOneAndUpdate", function normalizeUpdatedEmail() {
  const update = this.getUpdate();

  if (!update) return;

  const email = update.email ?? update.$set?.email;

  if (email === undefined) return;

  if (typeof email === "string" && email.trim()) {
    const normalizedEmail = email.trim().toLowerCase();

    if (update.$set) {
      update.$set.email = normalizedEmail;
      update.$set.normalizedEmail = normalizedEmail;
    } else {
      update.email = normalizedEmail;
      update.normalizedEmail = normalizedEmail;
    }
  } else {
    if (!update.$unset) {
      update.$unset = {};
    }

    update.$unset.email = 1;
    update.$unset.normalizedEmail = 1;

    if (update.$set) {
      delete update.$set.email;
      delete update.$set.normalizedEmail;
    } else {
      delete update.email;
      delete update.normalizedEmail;
    }
  }

  this.setUpdate(update);
});

userSchema.index({ name: 1 });
userSchema.index({ role: 1 });
userSchema.index({ deletedAt: 1 });

userSchema.index(
  { normalizedEmail: 1 },
  {
    unique: true,
    partialFilterExpression: {
      normalizedEmail: { $type: "string" },
    },
    name: "uniq_users_normalized_email",
  },
);

export const User = mongoose.model("User", userSchema);
