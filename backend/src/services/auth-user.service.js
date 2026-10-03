import { clerkClient } from "@clerk/clerk-sdk-node";
import { ENV } from "../config/env.js";
import { User } from "../models/user.model.js";
import {
  deriveFarmerInvitationStatus,
  invitationSnapshotMatch,
} from "./farmer-app-invitation.service.js";
import {
  noActiveFarmerClaimReservation,
  unlinkedFarmerClerkFilter,
} from "./farmer-claim-reservation.service.js";

// Custom error for controlled failure handling
export class AuthResolutionError extends Error {
  constructor(message, status, code, retryable = false) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export const getClerkUserId = (req) => {
  if (!req.auth) return null;
  return typeof req.auth === "function" ? req.auth().userId : req.auth.userId;
};

const findByClerkId = (clerkId) => {
  const lookup = User.findOne({ clerkId });
  const selected = lookup.select?.("+farmerAppInvitation.clerkInvitationId") ?? lookup;
  return selected.maxTimeMS?.(3000) ?? selected;
};

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : null;

const hasRealClerkLink = (user) =>
  Boolean(user?.clerkId) && !String(user.clerkId).startsWith("manual_");

const assertAccountIsActive = (user) => {
  if (user.status === "suspended") {
    throw new AuthResolutionError("Account has been suspended.", 403, "ACCOUNT_SUSPENDED", false);
  }
  if (user.deletedAt || user.status === "deleted") {
    throw new AuthResolutionError("Account has been deactivated.", 403, "ACCOUNT_DELETED", false);
  }
};

const loadVerifiedClerkIdentity = async (clerkId) => {
  let clerkUser;
  try {
    clerkUser = await clerkClient.users.getUser(clerkId);
  } catch {
    throw new AuthResolutionError("Failed to fetch identity from authentication provider.", 503, "USER_SYNC_UNAVAILABLE", true);
  }

  const emailEntry = clerkUser.primaryEmailAddress || clerkUser.emailAddresses?.find(
    (entry) => entry.id === clerkUser.primaryEmailAddressId
  );
  const email = normalizeEmail(emailEntry?.emailAddress);

  if (!email) {
    throw new AuthResolutionError("A primary email address is required.", 400, "PRIMARY_EMAIL_REQUIRED", false);
  }
  if (emailEntry?.verification?.status !== "verified") {
    throw new AuthResolutionError("Your primary email address must be verified.", 403, "EMAIL_NOT_VERIFIED", false);
  }

  return { clerkUser, email, imageUrl: clerkUser.imageUrl || "" };
};

const claimFarmerProfile = async ({ user, clerkId, imageUrl }) => {
  if (user.role !== "farmer") return false;
  const now = new Date();
  const consumeInvitation = deriveFarmerInvitationStatus(
    user.farmerAppInvitation, now, user.email,
  ) === "pending";
  const claimed = await User.findOneAndUpdate(
    {
      _id: user._id,
      role: "farmer",
      status: "active",
      deletedAt: null,
      profileClaimStatus: { $in: ["none", "unclaimed", "claimed"] },
      $and: [
        { $or: [...unlinkedFarmerClerkFilter().$or, { clerkId }] },
        noActiveFarmerClaimReservation(now),
      ],
      ...invitationSnapshotMatch(user.farmerAppInvitation),
    },
    { $set: {
      clerkId,
      isVerified: true,
      profileClaimStatus: "claimed",
      profileClaimedAt: user.profileClaimedAt || now,
      profileClaimedByClerkId: clerkId,
      imageUrl: imageUrl || user.imageUrl,
      ...(consumeInvitation
        ? { "farmerAppInvitation.status": "accepted", "farmerAppInvitation.lastCheckedAt": now }
        : {}),
    } },
    { returnDocument: "after", runValidators: true },
  );
  if (!claimed) {
    throw new AuthResolutionError(
      "This Farmer profile changed while connecting the account. Refresh and try again.",
      409, "FARMER_CLAIM_STATE_CHANGED", false,
    );
  }
  return claimed;
};

/**
 * Resolve a Staff Portal identity without invoking public Farmer provisioning.
 * Existing Farmers are returned unchanged so the client can show its specific
 * Staff-access rejection; unknown identities never create a MongoDB profile.
 */
export const resolveStaffUser = async (clerkId) => {
  if (!clerkId) {
    throw new AuthResolutionError("Authentication is required.", 401, "AUTH_REQUIRED", false);
  }

  let user = await findByClerkId(clerkId);
  if (user) {
    assertAccountIsActive(user);
    return user;
  }

  const { email, imageUrl } = await loadVerifiedClerkIdentity(clerkId);
  const existingLookup = User.findOne({
    $or: [{ normalizedEmail: email }, { email }],
  });
  user = await (existingLookup.select
    ? existingLookup.select("+farmerAppInvitation.clerkInvitationId")
    : existingLookup);

  if (!user) {
    throw new AuthResolutionError(
      "This account does not have a BreedSmart staff profile.",
      404,
      "STAFF_PROFILE_NOT_FOUND",
      false,
    );
  }

  assertAccountIsActive(user);
  if (hasRealClerkLink(user) && user.clerkId !== clerkId) {
    throw new AuthResolutionError("This email is linked to another account.", 409, "IDENTITY_LINK_CONFLICT", false);
  }

  if (user.role === "farmer") {
    return user;
  }

  if (!["admin", "technician"].includes(user.role)) {
    throw new AuthResolutionError(
      "This account does not have access to the BreedSmart staff workspace.",
      403,
      "STAFF_ACCESS_DENIED",
      false,
    );
  }

  if (
    user.role === "technician" &&
    !hasRealClerkLink(user) &&
    !["pending", "unclaimed"].includes(user.profileClaimStatus)
  ) {
    throw new AuthResolutionError(
      "This technician profile cannot be claimed by this identity.",
      409,
      "IDENTITY_LINK_CONFLICT",
      false,
    );
  }

  user.clerkId = clerkId;
  user.isVerified = true;
  user.imageUrl = imageUrl || user.imageUrl;
  if (user.role === "technician") {
    user.profileClaimStatus = "claimed";
    user.profileClaimedAt ||= new Date();
    user.profileClaimedByClerkId = clerkId;
  }
  await user.save();
  return user;
};

/**
 * Resolve the application user before idempotency middleware runs.
 * Validates primary email, links accounts safely, and enforces role security.
 */
export const resolveOrSyncUser = async (clerkId) => {
  if (!clerkId) {
    throw new AuthResolutionError("Authentication is required.", 401, "AUTH_REQUIRED", false);
  }

  // 1. Existing Clerk Link
  let user = await findByClerkId(clerkId);
  if (user) {
    if (user.status === "suspended") {
      throw new AuthResolutionError("Account has been suspended.", 403, "ACCOUNT_SUSPENDED", false);
    }
    if (user.deletedAt || user.status === "deleted") {
      throw new AuthResolutionError("Account has been deactivated.", 403, "ACCOUNT_DELETED", false);
    }
    if (
      user.role === "farmer" &&
      (user.profileClaimStatus !== "claimed" || !user.profileClaimedAt)
    ) {
      user = await claimFarmerProfile({ user, clerkId, imageUrl: user.imageUrl });
    }
    return user;
  }

  // 2. Fetch Clerk User
  let clerkUser;
  try {
    clerkUser = await clerkClient.users.getUser(clerkId);
  } catch (error) {
    throw new AuthResolutionError("Failed to fetch identity from authentication provider.", 503, "USER_SYNC_UNAVAILABLE", true);
  }

  const emailEntry = clerkUser.primaryEmailAddress || clerkUser.emailAddresses?.find(
    (entry) => entry.id === clerkUser.primaryEmailAddressId
  );

  const email = normalizeEmail(emailEntry?.emailAddress);

  if (!email) {
    throw new AuthResolutionError("A primary email address is required.", 400, "PRIMARY_EMAIL_REQUIRED", false);
  }

  if (emailEntry?.verification?.status !== "verified") {
    throw new AuthResolutionError("Your primary email address must be verified.", 403, "EMAIL_NOT_VERIFIED", false);
  }

  const name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "New User";
  const imageUrl = clerkUser.imageUrl || "";

  // 3. Look for existing profile by email
  const existingFarmerLookup = User.findOne({
    $or: [{ normalizedEmail: email }, { email }],
  });
  user = await (existingFarmerLookup.select
    ? existingFarmerLookup.select("+farmerAppInvitation.clerkInvitationId")
    : existingFarmerLookup);

  if (user) {
    if (user.status === "suspended") {
      throw new AuthResolutionError("Account has been suspended.", 403, "ACCOUNT_SUSPENDED", false);
    }
    if (user.deletedAt || user.status === "deleted") {
      throw new AuthResolutionError("Account has been deactivated.", 403, "ACCOUNT_DELETED", false);
    }

    if (hasRealClerkLink(user) && user.clerkId !== clerkId) {
      throw new AuthResolutionError("This email is linked to another account.", 409, "IDENTITY_LINK_CONFLICT", false);
    }

    // 4. Claim Invited Technician
    if (
      user.role === "technician" &&
      (user.profileClaimStatus === "pending" || user.profileClaimStatus === "unclaimed") &&
      !user.clerkId
    ) {
      user.clerkId = clerkId;
      user.isVerified = true;
      user.profileClaimStatus = "claimed";
      user.profileClaimedAt = new Date();
      user.profileClaimedByClerkId = clerkId;
      user.imageUrl = imageUrl || user.imageUrl;
      // Preserve role
    } else if (user.role === "farmer") {
      return claimFarmerProfile({ user, clerkId, imageUrl });
    } else {
      // Standard claiming / attaching Clerk ID
      user.clerkId = clerkId;
      user.isVerified = true;
      user.imageUrl = imageUrl || user.imageUrl;
    }

    if (user.isModified?.() !== false) {
      await user.save();
    }
    return user;
  }

  // 5. Create New Public Profile (Farmer only)
  try {
    user = await User.create({
      clerkId,
      name,
      email,
      imageUrl,
      isVerified: true,
      role: "farmer", // Strict public registration
      status: "active",
      profileClaimStatus: "claimed",
      profileClaimedAt: new Date(),
      profileClaimedByClerkId: clerkId,
    });
  } catch (error) {
    // Duplicate key recovery
    if (error?.code === 11000) {
      user = await findByClerkId(clerkId);
      if (user) return user;

      const recoveredLookup = User.findOne({
        $or: [{ normalizedEmail: email }, { email }],
      });
      user = await (recoveredLookup.select
        ? recoveredLookup.select("+farmerAppInvitation.clerkInvitationId")
        : recoveredLookup);
      if (user) {
        assertAccountIsActive(user);
        if (hasRealClerkLink(user) && user.clerkId !== clerkId) {
          throw new AuthResolutionError("This email is linked to another account.", 409, "IDENTITY_LINK_CONFLICT", false);
        }
        if (user.role === "farmer") {
          return claimFarmerProfile({ user, clerkId, imageUrl });
        } else {
          user.clerkId = clerkId;
          user.isVerified = true;
          await user.save();
        }
        return user;
      }
    }
    throw new AuthResolutionError("Failed to provision user profile.", 503, "USER_SYNC_UNAVAILABLE", true);
  }

  return user;
};
