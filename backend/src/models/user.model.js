import mongoose from "mongoose";
import { USER_ROLES } from "../domain/userRoles.js";

const AdministrativeAreaSchema = new mongoose.Schema(
  {
    municipalityCode: { type: String },
    municipalityName: { type: String },
    localityType: { type: String, enum: ["municipality", "city"] },
    provinceCode: { type: String },
    provinceName: { type: String },
    barangayCode: { type: String },
    barangayName: { type: String },
    psgcVersion: { type: String },
  },
  { _id: false }
);

const AddressSchema = new mongoose.Schema({
  houseNumber: { type: String },
  street: { type: String, required: false },
  subdivision: { type: String },
  barangay: { type: String, required: true }, // legacy
  city: { type: String, required: true }, // legacy
  district: { type: String, required: false },
  province: { type: String, required: true }, // legacy
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
  administrativeArea: {
    type: AdministrativeAreaSchema,
    default: null,
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
    administrativeArea: {
      type: AdministrativeAreaSchema,
      default: null,
    },
    administrativeAreaSource: {
      type: String,
      enum: [
        "psgc_selection",
        "trusted_geocoder",
        "legacy_text_match",
        "unresolved",
      ],
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
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.FARMER,
    },
    dispatchProfile: {
      serviceMunicipalities: [
        {
          municipalityCode: { type: String },
          municipalityName: { type: String },
          localityType: {
            type: String,
            enum: ["municipality", "city"],
          },
          provinceCode: { type: String },
          provinceName: { type: String },
          source: {
            type: String,
            enum: ["admin_assigned", "technician_registration"],
            default: "admin_assigned",
          },
          assignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          assignedAt: { type: Date },
        },
      ],
      serviceCapabilities: [
        {
          type: String,
          enum: ["AI", "HEALTH", "PREGNANCY_DIAGNOSIS", "CALVING"],
        },
      ],
      availabilityStatus: {
        type: String,
        enum: ["available", "busy", "off_duty"],
        default: "off_duty",
      },
      acceptsNewRequests: {
        type: Boolean,
        default: false,
      },
      legacyCoverageFallback: {
        municipalityCode: { type: String },
        municipalityName: { type: String },
        source: { type: String, default: "legacy_address_fallback" },
        requiresAdminConfirmation: { type: Boolean, default: true },
      },
      profileVersion: {
        type: Number,
        default: 1,
      },
      updatedAt: { type: Date },
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
