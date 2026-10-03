import { accountStatusClerkUsers } from "./account-status-clerk.service.js";
import { User } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";
import {
  deriveFarmerInvitationStatus,
  hasRealClerkLink,
  invitationSnapshotMatch,
  isEffectivePendingFarmerInvitation,
  revokeFarmerInvitationOrFail,
} from "./farmer-app-invitation.service.js";
import { claimTransitionConflict, noActiveFarmerClaimReservation } from "./farmer-claim-reservation.service.js";

export const archiveFarmerAsAdmin = async ({
  farmer,
  actorId,
  now = new Date(),
  banClerk = (id) => accountStatusClerkUsers.banUser(id),
  unbanClerk = (id) => accountStatusClerkUsers.unbanUser(id),
}) => {
  if (farmer?.role !== "farmer" || farmer.deletedAt) {
    throw new AppError("Farmer profile not found.", { status: 404, code: "FARMER_NOT_FOUND" });
  }
  const claimConflict = claimTransitionConflict(farmer, now);
  if (claimConflict) throw claimConflict;

  const invitationRevoked = isEffectivePendingFarmerInvitation(farmer, now);
  if (invitationRevoked) {
    await revokeFarmerInvitationOrFail(farmer.farmerAppInvitation.clerkInvitationId);
  }
  const staleClaimedInvitation = !invitationRevoked &&
    (farmer.profileClaimStatus === "claimed" || hasRealClerkLink(farmer)) &&
    deriveFarmerInvitationStatus(farmer.farmerAppInvitation, now, farmer.email) === "pending";

  const linked = hasRealClerkLink(farmer);
  if (linked) {
    try {
      await banClerk(farmer.clerkId);
    } catch {
      throw new AppError("Could not archive because Clerk did not confirm account access was blocked.", {
        status: 502, code: "CLERK_ARCHIVE_FAILED",
      });
    }
  }

  const identityMatch = farmer.clerkId
    ? { clerkId: farmer.clerkId }
    : { $or: [{ clerkId: { $exists: false } }, { clerkId: null }, { clerkId: "" }] };
  let archived;
  try {
    archived = await User.findOneAndUpdate(
    {
      _id: farmer._id,
      role: "farmer",
      deletedAt: null,
      status: farmer.status,
      profileClaimStatus: farmer.profileClaimStatus,
      $and: [identityMatch, noActiveFarmerClaimReservation(now)],
      ...invitationSnapshotMatch(farmer.farmerAppInvitation),
    },
    {
      $set: {
        deletedAt: now,
        deactivatedBy: actorId,
        ...(invitationRevoked
          ? { "farmerAppInvitation.status": "revoked", "farmerAppInvitation.lastCheckedAt": now }
          : {}),
        ...(staleClaimedInvitation
          ? { "farmerAppInvitation.status": "accepted", "farmerAppInvitation.lastCheckedAt": now }
          : {}),
      },
      $unset: { pushToken: "" },
    },
    { returnDocument: "after", runValidators: true },
    );
  } catch {
    // The write may have committed even if its acknowledgement was lost.
    // Never unban without first confirming that the Farmer is still active.
    if (linked) {
      try {
        const current = await User.findById(farmer._id);
        if (current && !current.deletedAt && current.status !== "suspended" &&
          current.clerkId === farmer.clerkId) await unbanClerk(farmer.clerkId);
      } catch {
        // Access state needs operator reconciliation when the read or compensation fails.
      }
    }
    throw new AppError("Archive could not be reconciled with account access. Contact an Admin.", {
      status: 503, code: "FARMER_ARCHIVE_RECONCILIATION_REQUIRED",
    });
  }
  if (archived) return archived;

  if (linked) {
    try {
      const current = await User.findById(farmer._id);
      if (current && !current.deletedAt && current.status !== "suspended" &&
        current.clerkId === farmer.clerkId) {
        await unbanClerk(farmer.clerkId);
      }
    } catch {
      throw new AppError("Archive could not be reconciled with account access. Contact an Admin.", {
        status: 503, code: "FARMER_ARCHIVE_RECONCILIATION_REQUIRED",
      });
    }
  }
  throw new AppError("Farmer profile changed. Refresh and try again.", {
    status: 409, code: "FARMER_ARCHIVE_STATE_CHANGED",
  });
};
