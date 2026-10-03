import { User } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";
import {
  acquireFarmerClaimReservation,
  beginFarmerClaimCommit,
  farmerClaimStateChanged,
  finishFarmerClaimCommitAfterRollback,
  markFarmerClaimUncertain,
  releaseFarmerClaimReservation,
  unlinkedFarmerClerkFilter,
} from "./farmer-claim-reservation.service.js";
import {
  deriveFarmerInvitationStatus,
  invitationSnapshotMatch,
} from "./farmer-app-invitation.service.js";

const reconciliationRequired = () => new AppError(
  "The account connection needs office review. Please contact the Municipal Agriculture Office.",
  { status: 503, code: "FARMER_CLAIM_RECONCILIATION_REQUIRED" },
);

export const linkFarmerProfileByPhone = async ({ sourceUser, targetFarmer, phone }) => {
  const reservation = await acquireFarmerClaimReservation({ farmerId: targetFarmer._id });
  try {
    await beginFarmerClaimCommit({ ...reservation, sourceUserId: sourceUser._id });
  } catch (error) {
    // No source identity has been touched yet. A stale token cannot release a newer claim.
    await releaseFarmerClaimReservation(reservation);
    throw error;
  }
  const sourceBefore = {
    clerkId: sourceUser.clerkId,
    email: sourceUser.email,
    normalizedEmail: sourceUser.normalizedEmail,
    deletedAt: sourceUser.deletedAt,
    deactivatedBy: sourceUser.deactivatedBy,
    phoneVerification: sourceUser.phoneVerification?.toObject?.() || sourceUser.phoneVerification,
  };
  const transferEmail = Boolean(sourceBefore.email && !targetFarmer.email);
  const transferAt = new Date();
  let sourceTransferred = false;
  try {
    sourceUser.clerkId = undefined;
    // The unique normalized-email identity moves with the unique Clerk ID.
    if (transferEmail) {
      sourceUser.email = undefined;
      sourceUser.normalizedEmail = undefined;
    }
    sourceUser.deletedAt = transferAt;
    sourceUser.deactivatedBy = sourceUser._id;
    if (sourceUser.phoneVerification) {
      sourceUser.phoneVerification.otpHash = undefined;
      sourceUser.phoneVerification.otpExpiresAt = null;
    }
    await sourceUser.save();
    sourceTransferred = true;

    const now = new Date();
    const confirmation = {
      ...(targetFarmer.phoneVerification?.toObject?.() || targetFarmer.phoneVerification || {}),
      pendingPhoneNumber: "",
      pendingNormalizedPhoneNumber: "",
      otpHash: undefined,
      otpExpiresAt: null,
      isVerified: true,
      verifiedAt: now,
      failedAttempts: 0,
    };
    const consumeInvitation = deriveFarmerInvitationStatus(
      targetFarmer.farmerAppInvitation, now, targetFarmer.email,
    ) === "pending";
    const linked = await User.findOneAndUpdate(
      {
        _id: targetFarmer._id,
        role: "farmer",
        status: "active",
        deletedAt: null,
        profileClaimStatus: "unclaimed",
        "farmerClaimReservation.token": reservation.token,
        "farmerClaimReservation.phase": "committing",
        ...unlinkedFarmerClerkFilter(),
        ...invitationSnapshotMatch(targetFarmer.farmerAppInvitation),
      },
      {
        $set: {
          clerkId: sourceBefore.clerkId,
          ...(transferEmail ? { email: sourceBefore.email } : {}),
          imageUrl: sourceUser.imageUrl || targetFarmer.imageUrl,
          phoneNumber: phone.local,
          normalizedPhoneNumber: phone.normalized,
          ...(targetFarmer.address ? { "address.phoneNumber": phone.local } : {}),
          isVerified: true,
          profileClaimStatus: "claimed",
          profileClaimedAt: now,
          profileClaimedByClerkId: sourceBefore.clerkId || "",
          phoneVerification: confirmation,
          ...(consumeInvitation
            ? { "farmerAppInvitation.status": "accepted", "farmerAppInvitation.lastCheckedAt": now }
            : {}),
        },
        $unset: { farmerClaimReservation: "" },
      },
      { returnDocument: "after", runValidators: true },
    );
    if (!linked) throw farmerClaimStateChanged();
    return linked;
  } catch (error) {
    if (!sourceTransferred) {
      // A failed save can have an uncertain database outcome.
      await markFarmerClaimUncertain(reservation);
      throw reconciliationRequired();
    }
    if (error.code !== "FARMER_CLAIM_STATE_CHANGED") {
      // A thrown DB/network error may mean finalization committed but its
      // acknowledgement was lost; restoring the source could duplicate Clerk.
      await markFarmerClaimUncertain(reservation);
      throw reconciliationRequired();
    }
    try {
      const restored = await User.findOneAndUpdate(
        {
          _id: sourceUser._id,
          deletedAt: transferAt,
          $or: [{ clerkId: { $exists: false } }, { clerkId: null }],
        },
        {
          $set: {
            clerkId: sourceBefore.clerkId,
            ...(sourceBefore.email ? { email: sourceBefore.email } : {}),
            deletedAt: sourceBefore.deletedAt || null,
            deactivatedBy: sourceBefore.deactivatedBy || null,
            phoneVerification: sourceBefore.phoneVerification,
          },
        },
        { returnDocument: "after", runValidators: true },
      );
      if (!restored) throw reconciliationRequired();
      const cleared = await finishFarmerClaimCommitAfterRollback(reservation);
      if (!cleared) throw reconciliationRequired();
      throw error;
    } catch (rollbackError) {
      if (rollbackError === error) throw error;
      await markFarmerClaimUncertain(reservation);
      throw reconciliationRequired();
    }
  }
};
