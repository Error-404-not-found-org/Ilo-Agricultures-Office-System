import { clerkClient } from "@clerk/clerk-sdk-node";
import { ENV } from "../config/env.js";
import { User } from "../models/user.model.js";

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

const findByClerkId = (clerkId) =>
  User.findOne({ clerkId }).maxTimeMS?.(3000) ?? User.findOne({ clerkId });

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : null;

const hasRealClerkLink = (user) =>
  Boolean(user?.clerkId) && !String(user.clerkId).startsWith("manual_");

const claimFarmerProfile = async ({ user, clerkId, imageUrl }) => {
  if (user.role !== "farmer") return false;
  user.clerkId = clerkId;
  user.isVerified = true;
  user.profileClaimStatus = "claimed";
  user.profileClaimedAt ||= new Date();
  user.profileClaimedByClerkId = clerkId;
  user.imageUrl = imageUrl || user.imageUrl;
  await user.save();
  return true;
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
      await claimFarmerProfile({ user, clerkId, imageUrl: user.imageUrl });
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
  user = await User.findOne({
    $or: [{ normalizedEmail: email }, { email }],
  });

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
      await claimFarmerProfile({ user, clerkId, imageUrl });
      return user;
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

      user = await User.findOne({
        $or: [{ normalizedEmail: email }, { email }],
      });
      if (user) {
        if (hasRealClerkLink(user) && user.clerkId !== clerkId) {
          throw new AuthResolutionError("This email is linked to another account.", 409, "IDENTITY_LINK_CONFLICT", false);
        }
        if (user.role === "farmer") {
          await claimFarmerProfile({ user, clerkId, imageUrl });
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
