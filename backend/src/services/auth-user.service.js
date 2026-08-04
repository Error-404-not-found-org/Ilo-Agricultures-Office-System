import { clerkClient } from "@clerk/clerk-sdk-node";
import { ENV } from "../config/env.js";
import { User } from "../models/user.model.js";

const APPLICATION_ROLES = new Set([
  "admin",
  "technician",
  "veterinarian",
  "farmer",
]);

export const getClerkUserId = (req) => {
  if (!req.auth) return null;
  return typeof req.auth === "function" ? req.auth().userId : req.auth.userId;
};

const findByClerkId = (clerkId) =>
  User.findOne({ clerkId }).maxTimeMS?.(3000) ?? User.findOne({ clerkId });

const getClerkIdentity = (clerkUser) => {
  const emailEntry = clerkUser.emailAddresses?.[0];
  const email = emailEntry?.emailAddress?.trim().toLowerCase();
  const username = clerkUser.username?.trim();
  const name =
    `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() ||
    username ||
    "New User";

  return {
    email,
    name,
    imageUrl: clerkUser.imageUrl || "",
    isVerified:
      emailEntry?.verification?.status === "verified" || Boolean(username),
  };
};

/**
 * Resolve the application user before idempotency middleware runs. Existing
 * Clerk users may be linked to an offline profile or provisioned on demand.
 */
export const resolveOrSyncUser = async (clerkId) => {
  let user = await findByClerkId(clerkId);
  if (user) return user;

  const clerkUser = await clerkClient.users.getUser(clerkId);
  const identity = getClerkIdentity(clerkUser);

  if (identity.email) {
    user = await User.findOne({ email: identity.email });
  }

  if (!user && identity.name !== "New User") {
    user = await User.findOne({
      name: { $regex: new RegExp(`^${identity.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      clerkId: { $exists: false },
    });
  }

  if (user) {
    user.clerkId = clerkId;
    if (identity.email && !user.email) user.email = identity.email;
    user.imageUrl = identity.imageUrl || user.imageUrl;
    user.isVerified = identity.isVerified || user.isVerified;
  } else {
    const isConfiguredAdmin =
      identity.email &&
      ENV.ADMIN_EMAIL &&
      identity.email === ENV.ADMIN_EMAIL.trim().toLowerCase();

    try {
      user = await User.create({
        clerkId,
        name: identity.name,
        email: identity.email || undefined,
        imageUrl: identity.imageUrl,
        isVerified: identity.isVerified,
        role: isConfiguredAdmin ? "admin" : "farmer",
      });
    } catch (error) {
      // A concurrent first request may have provisioned the same Clerk user.
      if (error?.code !== 11000) throw error;
      user = await findByClerkId(clerkId);
      if (!user) throw error;
    }
  }

  const metadataRole = clerkUser.publicMetadata?.role;
  if (APPLICATION_ROLES.has(metadataRole) && user.role !== metadataRole) {
    user.role = metadataRole;
  }

  if (user.isModified?.() !== false) {
    await user.save();
  }

  return user;
};
