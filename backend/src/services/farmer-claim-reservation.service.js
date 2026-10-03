import { randomUUID } from "node:crypto";
import { User } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";

const CLAIM_RESERVATION_MS = 2 * 60 * 1000;

export const noActiveFarmerClaimReservation = (now = new Date()) => ({
  $or: [
    { "farmerClaimReservation.token": { $exists: false } },
    { $and: [
      { "farmerClaimReservation.expiresAt": { $lte: now } },
      { $or: [
        { "farmerClaimReservation.phase": "reserved" },
        { "farmerClaimReservation.phase": { $exists: false } },
      ] },
    ] },
  ],
});

export const claimTransitionConflict = (farmer, now = new Date()) => {
  const claim = farmer?.farmerClaimReservation;
  if (!claim?.token) return null;
  if (claim.phase === "uncertain") return new AppError(
    "This Farmer account cannot be archived until its account connection is resolved.",
    { status: 409, code: "FARMER_CLAIM_RECONCILIATION_REQUIRED" },
  );
  if (claim.phase === "committing" || claim.expiresAt > now) return new AppError(
    "This Farmer profile is being connected to an app account. Try again shortly.",
    { status: 409, code: "FARMER_CLAIM_IN_PROGRESS" },
  );
  return null;
};

export const unlinkedFarmerClerkFilter = () => ({
  $or: [
    { clerkId: { $exists: false } },
    { clerkId: null },
    { clerkId: "" },
    { clerkId: /^manual_/ },
  ],
});

export const farmerClaimStateChanged = () => new AppError(
  "This Farmer profile changed while connecting the account. Refresh and try again.",
  { status: 409, code: "FARMER_CLAIM_STATE_CHANGED" },
);

export const acquireFarmerClaimReservation = async ({ farmerId, now = new Date() }) => {
  const token = randomUUID();
  const reservation = {
    token,
    phase: "reserved",
    startedAt: now,
    expiresAt: new Date(now.getTime() + CLAIM_RESERVATION_MS),
  };
  const farmer = await User.findOneAndUpdate(
    {
      _id: farmerId,
      role: "farmer",
      status: "active",
      deletedAt: null,
      profileClaimStatus: "unclaimed",
      $and: [unlinkedFarmerClerkFilter(), noActiveFarmerClaimReservation(now)],
    },
    { $set: { farmerClaimReservation: reservation } },
    { returnDocument: "after", runValidators: true },
  );
  if (!farmer) throw farmerClaimStateChanged();
  return { farmerId, token, expiresAt: reservation.expiresAt };
};

export const beginFarmerClaimCommit = async ({ farmerId, token, sourceUserId, now = new Date() }) => {
  const farmer = await User.findOneAndUpdate(
    {
      _id: farmerId, role: "farmer", status: "active", deletedAt: null,
      profileClaimStatus: "unclaimed",
      "farmerClaimReservation.token": token,
      "farmerClaimReservation.phase": "reserved",
      "farmerClaimReservation.expiresAt": { $gt: now },
      ...unlinkedFarmerClerkFilter(),
    },
    { $set: {
      "farmerClaimReservation.phase": "committing",
      "farmerClaimReservation.sourceUserId": sourceUserId,
    } },
    { returnDocument: "after", runValidators: true },
  );
  if (!farmer) throw farmerClaimStateChanged();
  return farmer;
};

export const markFarmerClaimUncertain = async ({ farmerId, token }) => User.updateOne(
  { _id: farmerId, "farmerClaimReservation.token": token,
    "farmerClaimReservation.phase": "committing" },
  { $set: { "farmerClaimReservation.phase": "uncertain" } },
);

export const releaseFarmerClaimReservation = async ({ farmerId, token }) => {
  const result = await User.updateOne(
    { _id: farmerId, "farmerClaimReservation.token": token,
      "farmerClaimReservation.phase": "reserved" },
    { $unset: { farmerClaimReservation: "" } },
  );
  return result.modifiedCount === 1;
};

export const finishFarmerClaimCommitAfterRollback = async ({ farmerId, token }) => {
  const result = await User.updateOne(
    { _id: farmerId, "farmerClaimReservation.token": token,
      "farmerClaimReservation.phase": "committing", profileClaimStatus: "unclaimed" },
    { $unset: { farmerClaimReservation: "" } },
  );
  return result.modifiedCount === 1;
};
