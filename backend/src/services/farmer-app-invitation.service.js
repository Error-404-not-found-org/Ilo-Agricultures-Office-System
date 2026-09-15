import { clerkClient } from "@clerk/clerk-sdk-node";
import { User } from "../models/user.model.js";
import { ENV } from "../config/env.js";
import { AppError } from "../utils/app-error.js";

export const FARMER_APP_INVITATION_DURATION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const hasRealClerkLink = (farmer) =>
  Boolean(farmer?.clerkId) && !String(farmer.clerkId).startsWith("manual_");

const clerkErrorDetails = (error) => {
  const values = [
    error?.code,
    error?.errors?.[0]?.code,
    error?.errors?.[0]?.message,
    error?.errors?.[0]?.longMessage,
    error?.message,
  ].filter(Boolean).join(" ").toLowerCase();
  return values;
};

const isClerkInvitationConflictError = (error) => {
  const details = clerkErrorDetails(error);
  return /invitation/.test(details) && /already|exist|pending|duplicate/.test(details);
};

const isClerkExistingAccountError = (error) => {
  const details = clerkErrorDetails(error);
  const codes = [error?.code, error?.errors?.[0]?.code]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return codes.includes("form_identifier_exists") ||
    /existing (user|account)|(?:user|account) already exists|email.*taken/.test(details);
};

const invitationFailure = (error) => {
  if (isClerkInvitationConflictError(error)) {
    return new AppError(
      "An active invitation already exists for this email. Use Resend Invitation to replace it.",
      { status: 409, code: "FARMER_INVITATION_ALREADY_PENDING" },
    );
  }
  if (isClerkExistingAccountError(error)) {
    return new AppError(
      "An account already exists for this email. Ask the Farmer to sign in so BreedSmart can safely verify and link the account.",
      { status: 409, code: "CLERK_ACCOUNT_EXISTS_SIGN_IN_REQUIRED" },
    );
  }
  return new AppError(
    "The Farmer invitation service is temporarily unavailable. Try again.",
    { status: 503, code: "FARMER_INVITATION_SERVICE_UNAVAILABLE" },
  );
};

export const deriveFarmerInvitationStatus = (
  snapshot,
  now = new Date(),
  currentEmail,
) => {
  if (!snapshot?.status) return null;
  if (
    snapshot.status === "pending" &&
    currentEmail !== undefined &&
    normalizeEmail(snapshot.email) !== normalizeEmail(currentEmail)
  ) {
    return "expired";
  }
  if (
    snapshot.status === "pending" &&
    snapshot.expiresAt &&
    new Date(snapshot.expiresAt).getTime() <= new Date(now).getTime()
  ) {
    return "expired";
  }
  return snapshot.status;
};

export const assertFarmerCanBeInvited = (farmer) => {
  if (!farmer || farmer.role !== "farmer" || farmer.deletedAt) {
    throw new AppError("Farmer profile not found.", {
      status: 404,
      code: "FARMER_NOT_FOUND",
    });
  }
  if (farmer.status === "suspended" || farmer.profileClaimStatus === "blocked") {
    throw new AppError("Blocked Farmers cannot receive app invitations.", {
      status: 409,
      code: "FARMER_ACCOUNT_BLOCKED",
    });
  }
  if (farmer.profileClaimStatus === "claimed" || hasRealClerkLink(farmer)) {
    throw new AppError("This Farmer already has a connected app account.", {
      status: 409,
      code: "FARMER_ALREADY_CONNECTED",
    });
  }
  const email = normalizeEmail(farmer.email);
  if (!email) {
    throw new AppError("Add the Farmer's email before sending an invitation.", {
      status: 400,
      code: "FARMER_EMAIL_REQUIRED",
    });
  }
  return email;
};

const assertFarmerInvitationCanBeManaged = (farmer) => {
  if (!farmer || farmer.role !== "farmer" || farmer.deletedAt) {
    throw new AppError("Farmer profile not found.", {
      status: 404,
      code: "FARMER_NOT_FOUND",
    });
  }
  if (farmer.status === "suspended" || farmer.profileClaimStatus === "blocked") {
    throw new AppError("Blocked Farmers cannot manage app invitations.", {
      status: 409,
      code: "FARMER_ACCOUNT_BLOCKED",
    });
  }
  if (farmer.profileClaimStatus === "claimed" || hasRealClerkLink(farmer)) {
    throw new AppError("This Farmer already has a connected app account.", {
      status: 409,
      code: "FARMER_ALREADY_CONNECTED",
    });
  }
};

const buildSnapshot = (invitation, email, now) => {
  const createdAt = Number(invitation?.createdAt);
  const sentAt = Number.isFinite(createdAt) ? new Date(createdAt) : new Date(now);
  return {
    clerkInvitationId: invitation.id,
    status: "pending",
    email,
    sentAt,
    expiresAt: new Date(
      sentAt.getTime() + FARMER_APP_INVITATION_DURATION_DAYS * DAY_MS,
    ),
    lastCheckedAt: new Date(now),
  };
};

const createClerkInvitation = async ({ email, now }) => {
  try {
    const invitation = await clerkClient.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: { role: "farmer" },
      ignoreExisting: false,
      redirectUrl: ENV.FARMER_INVITATION_REDIRECT_URL.trim(),
      expiresInDays: FARMER_APP_INVITATION_DURATION_DAYS,
    });
    if (!invitation?.id) throw new Error("Clerk returned no invitation ID.");
    return buildSnapshot(invitation, email, now);
  } catch (error) {
    throw invitationFailure(error);
  }
};

const saveSnapshot = async (farmer, snapshot) => {
  farmer.farmerAppInvitation = snapshot;
  if (typeof farmer.save === "function") await farmer.save();
  return snapshot;
};

const reconcilePendingInvitation = async (farmer, now) => {
  const snapshot = farmer.farmerAppInvitation;
  if (deriveFarmerInvitationStatus(snapshot, now) !== "pending") return;

  try {
    const invitations = await clerkClient.invitations.getInvitationList({
      status: "pending",
    });
    const current = (Array.isArray(invitations) ? invitations : invitations?.data || [])
      .find((item) => item.id === snapshot.clerkInvitationId);
    if (current) {
      await clerkClient.invitations.revokeInvitation(snapshot.clerkInvitationId);
    }
    await saveSnapshot(farmer, {
      ...snapshot,
      status: current ? "revoked" : "expired",
      lastCheckedAt: new Date(now),
    });
  } catch (error) {
    throw invitationFailure(error);
  }
};

export const sendFarmerAppInvitation = async ({ farmer, now = new Date() }) => {
  const email = assertFarmerCanBeInvited(farmer);
  if (deriveFarmerInvitationStatus(farmer.farmerAppInvitation, now) === "pending") {
    throw new AppError(
      "This Farmer already has an active invitation. Use Resend Invitation to replace it.",
      { status: 409, code: "FARMER_INVITATION_ALREADY_PENDING" },
    );
  }
  const snapshot = await createClerkInvitation({ email, now });
  await saveSnapshot(farmer, snapshot);
  return snapshot;
};

export const resendFarmerAppInvitation = async ({ farmer, now = new Date() }) => {
  const email = assertFarmerCanBeInvited(farmer);
  await reconcilePendingInvitation(farmer, now);
  const snapshot = await createClerkInvitation({ email, now });
  await saveSnapshot(farmer, snapshot);
  return snapshot;
};

export const cancelFarmerAppInvitation = async ({ farmer, now = new Date() }) => {
  assertFarmerInvitationCanBeManaged(farmer);
  const snapshot = farmer.farmerAppInvitation;
  if (!snapshot || snapshot.status === "revoked") return snapshot || null;

  const effectiveStatus = deriveFarmerInvitationStatus(snapshot, now);
  if (effectiveStatus === "expired") {
    return saveSnapshot(farmer, {
      ...snapshot,
      status: "expired",
      lastCheckedAt: new Date(now),
    });
  }
  if (effectiveStatus !== "pending") return snapshot;

  try {
    const pendingInvitations = await clerkClient.invitations.getInvitationList({
      status: "pending",
    });
    const pending = (
      Array.isArray(pendingInvitations)
        ? pendingInvitations
        : pendingInvitations?.data || []
    ).find((item) => item.id === snapshot.clerkInvitationId);

    if (pending) {
      await clerkClient.invitations.revokeInvitation(snapshot.clerkInvitationId);
      return saveSnapshot(farmer, {
        ...snapshot,
        status: "revoked",
        lastCheckedAt: new Date(now),
      });
    }

    const allInvitations = await clerkClient.invitations.getInvitationList();
    const current = (
      Array.isArray(allInvitations) ? allInvitations : allInvitations?.data || []
    ).find((item) => item.id === snapshot.clerkInvitationId);
    const reconciledStatus = ["accepted", "revoked", "expired"].includes(current?.status)
      ? current.status
      : "expired";
    return saveSnapshot(farmer, {
      ...snapshot,
      status: reconciledStatus,
      lastCheckedAt: new Date(now),
    });
  } catch (error) {
    throw invitationFailure(error);
  }
};

export const createFarmerInvitationSnapshot = async ({ email, now = new Date() }) => {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw new AppError("Add the Farmer's email before sending an invitation.", {
      status: 400,
      code: "FARMER_EMAIL_REQUIRED",
    });
  }
  return createClerkInvitation({ email: normalized, now });
};

export const revokeFarmerInvitationSnapshotBestEffort = async (snapshot) => {
  if (!snapshot?.clerkInvitationId) return;
  try {
    await clerkClient.invitations.revokeInvitation(snapshot.clerkInvitationId);
  } catch (error) {
    console.error(
      "[Farmer App Invitation] Failed to revoke invitation during rollback:",
      error?.message,
    );
  }
};

export const loadInvitableFarmer = (farmerId) =>
  User.findOne({ _id: farmerId, role: "farmer", deletedAt: null })
    .select("+farmerAppInvitation.clerkInvitationId");
