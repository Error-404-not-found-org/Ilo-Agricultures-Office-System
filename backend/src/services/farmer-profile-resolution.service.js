import { clerkClient } from "@clerk/clerk-sdk-node";
import { User } from "../models/user.model.js";
import { normalizePhilippineMobileNumber } from "../utils/phone.js";
import { AppError } from "../utils/app-error.js";
import { ENV } from "../config/env.js";

export const getFarmerInvitationRedirectUrl = () =>
  ENV.FARMER_INVITATION_REDIRECT_URL.trim();

export const normalizeFarmerEmail = (value) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized || undefined;
};

export const normalizeFarmerPhone = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return {
      local: undefined,
      normalized: undefined,
    };
  }

  try {
    const compactPhone = String(value).trim().replace(/[^\d+]/g, "");
    const phone = normalizePhilippineMobileNumber(compactPhone);
    return {
      local: phone.local,
      normalized: phone.normalized,
    };
  } catch (error) {
    throw new AppError(error.message || "Invalid Philippine phone number.", {
      status: 400,
      code: "INVALID_PHONE",
    });
  }
};

const idsMatch = (left, right) => String(left?._id || left) === String(right?._id || right);

const hasRealClerkLink = (farmer) =>
  Boolean(farmer?.clerkId) && !String(farmer.clerkId).startsWith("manual_");

export const classifyFarmerProfile = (farmer) => {
  if (!farmer) return "fresh";
  if (farmer.deletedAt || farmer.status === "deleted") return "deleted";
  if (farmer.status === "suspended" || farmer.profileClaimStatus === "blocked") {
    return "suspended";
  }
  if (farmer.profileClaimStatus === "claimed" || hasRealClerkLink(farmer)) {
    return "claimed";
  }
  return "unclaimed";
};

const findByEmail = (email) => {
  if (!email) return null;
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return User.findOne({
    $or: [
      { normalizedEmail: email },
      { email: { $regex: new RegExp(`^${escaped}$`, "i") } },
    ],
  });
};

const findByPhone = ({ local, normalized }) => {
  if (!local && !normalized) return null;
  const candidates = [
    normalized ? { normalizedPhoneNumber: normalized } : null,
    local ? { phoneNumber: local } : null,
    normalized ? { phoneNumber: normalized } : null,
  ].filter(Boolean);
  return User.findOne({ $or: candidates });
};

export const resolveFarmerIdentity = async ({ email, phoneNumber }) => {
  const normalizedEmail = normalizeFarmerEmail(email);
  const phone = normalizeFarmerPhone(phoneNumber);
  const [emailMatch, phoneMatch] = await Promise.all([
    findByEmail(normalizedEmail),
    findByPhone(phone),
  ]);

  if (emailMatch && phoneMatch && !idsMatch(emailMatch, phoneMatch)) {
    throw new AppError(
      "The submitted email and phone number belong to different Farmer profiles. Review the existing accounts before continuing.",
      {
        status: 409,
        code: "FARMER_IDENTITY_CONFLICT",
      },
    );
  }

  const farmer = emailMatch || phoneMatch || null;
  if (farmer && farmer.role !== "farmer") {
    throw new AppError(
      "The submitted identity is already connected to a non-Farmer account.",
      {
        status: 409,
        code: "FARMER_IDENTITY_CONFLICT",
      },
    );
  }
  const classification = classifyFarmerProfile(farmer);
  if (classification === "deleted" || classification === "suspended") {
    throw new AppError(
      "This Farmer profile is not currently active. Restore or reactivate the existing account instead of creating another profile.",
      {
        status: 409,
        code: "FARMER_ACCOUNT_UNAVAILABLE",
      },
    );
  }

  return {
    farmer,
    classification,
    matchedBy: emailMatch ? "email" : phoneMatch ? "phone" : null,
    normalizedEmail,
    phone,
  };
};

const inviteFarmer = async ({ email, redirectUrl, expiresInDays }) => {
  const payload = {
    emailAddress: email,
    publicMetadata: { role: "farmer" },
    ignoreExisting: true,
    ...(redirectUrl ? { redirectUrl } : {}),
    ...(expiresInDays ? { expiresInDays } : {}),
  };
  return clerkClient.invitations.createInvitation(payload);
};

const revokeInvitationBestEffort = async (invitation) => {
  if (!invitation?.id || typeof clerkClient?.invitations?.revokeInvitation !== "function") {
    return;
  }
  try {
    await clerkClient.invitations.revokeInvitation(invitation.id);
  } catch (error) {
    console.error(
      "[Farmer Profile Resolution] Failed to revoke invitation after profile creation failure:",
      error?.message,
    );
  }
};

/**
 * Resolve an existing Farmer or create one Technician/Admin-assisted profile.
 * invitationMode:
 * - required: explicit registration fails if Clerk invitation fails
 * - best-effort: clinical walk-in recording may continue if Clerk fails
 * - none: create/reuse a local profile without contacting Clerk
 */
export const resolveOrCreateAssistedFarmer = async ({
  email,
  phoneNumber,
  name,
  address,
  imageUrl = "",
  source,
  invitationMode = "none",
  inviteExistingUnclaimed = false,
  allowClaimedExisting = false,
  redirectUrl,
  expiresInDays,
  isVerified = false,
}) => {
  const identity = await resolveFarmerIdentity({ email, phoneNumber });
  let shouldAttachInvitedEmail = false;
  if (
    identity.farmer &&
    identity.classification === "unclaimed" &&
    identity.matchedBy === "phone" &&
    identity.normalizedEmail
  ) {
    const existingEmail = normalizeFarmerEmail(identity.farmer.email);
    if (existingEmail && existingEmail !== identity.normalizedEmail) {
      throw new AppError(
        "The submitted email does not match the existing Farmer profile found by phone number.",
        {
          status: 409,
          code: "FARMER_IDENTITY_CONFLICT",
        },
      );
    }
    if (!existingEmail) {
      shouldAttachInvitedEmail = inviteExistingUnclaimed;
    }
  }
  const shouldInvite = Boolean(identity.normalizedEmail) && (
    identity.classification === "fresh" ||
    (identity.classification === "unclaimed" && inviteExistingUnclaimed)
  );

  if (identity.classification === "claimed" && !allowClaimedExisting) {
    throw new AppError(
      "A Farmer account already exists for these details. Ask the Farmer to sign in or use account recovery.",
      {
        status: 409,
        code: "FARMER_ACCOUNT_ALREADY_ACTIVE",
      },
    );
  }

  let invitation = null;
  let invitationError = null;
  if (shouldInvite && invitationMode !== "none") {
    try {
      invitation = await inviteFarmer({
        email: identity.normalizedEmail,
        redirectUrl,
        expiresInDays,
      });
    } catch (error) {
      invitationError = error;
      if (invitationMode === "required") {
        throw new AppError(
          error?.errors?.[0]?.longMessage ||
            error?.errors?.[0]?.message ||
            "The Farmer profile was not created because the invitation could not be sent.",
          {
            status: 400,
            code: "CLERK_INVITATION_FAILED",
          },
        );
      }
      console.error(
        `[Farmer Profile Resolution:${source || "unknown"}] Clerk invitation failed:`,
        error?.message,
      );
    }
  }

  if (identity.farmer) {
    if (shouldAttachInvitedEmail && invitation) {
      try {
        identity.farmer.email = identity.normalizedEmail;
        identity.farmer.normalizedEmail = identity.normalizedEmail;
        if (typeof identity.farmer.save === "function") {
          await identity.farmer.save();
        }
      } catch (error) {
        await revokeInvitationBestEffort(invitation);
        throw error;
      }
    }
    return {
      farmer: identity.farmer,
      created: false,
      reused: true,
      classification: identity.classification,
      matchedBy: identity.matchedBy,
      invitationAttempted: shouldInvite && invitationMode !== "none",
      invitationSent: Boolean(invitation),
      invitationResent: Boolean(invitation),
      invitationError: invitationError?.message,
    };
  }

  let farmer;
  try {
    farmer = await User.create({
      name: String(name || "").trim() || "Registered Farmer",
      email: identity.normalizedEmail,
      phoneNumber: identity.phone.local,
      normalizedPhoneNumber: identity.phone.normalized || "",
      address,
      imageUrl,
      role: "farmer",
      status: "active",
      isVerified,
      registeredByTechnician: true,
      profileClaimStatus: "unclaimed",
    });
  } catch (error) {
    await revokeInvitationBestEffort(invitation);
    throw error;
  }

  return {
    farmer,
    created: true,
    reused: false,
    classification: "fresh",
    matchedBy: null,
    invitationAttempted: shouldInvite && invitationMode !== "none",
    invitationSent: Boolean(invitation),
    invitationResent: false,
    invitationError: invitationError?.message,
  };
};
