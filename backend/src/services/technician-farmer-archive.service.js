import { User } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";
import {
  hasRealClerkLink,
  invitationSnapshotMatch,
  isEffectivePendingFarmerInvitation,
  revokeFarmerInvitationOrFail,
} from "./farmer-app-invitation.service.js";
import {
  noActiveFarmerClaimReservation,
  claimTransitionConflict,
  unlinkedFarmerClerkFilter,
} from "./farmer-claim-reservation.service.js";

export const archiveFarmerAsTechnician = async ({ farmerId, technicianId, now = new Date() }) => {
  const archiveLookup = User.findById(farmerId);
  const farmer = await (archiveLookup.select
    ? archiveLookup.select("+farmerClaimReservation +farmerAppInvitation.clerkInvitationId")
    : archiveLookup);
  if (!farmer || farmer.role !== "farmer") {
    throw new AppError("Farmer profile not found.", { status: 404, code: "FARMER_NOT_FOUND" });
  }
  if (farmer.deletedAt) {
    throw new AppError("This Farmer profile is already archived.", { status: 409, code: "FARMER_ALREADY_ARCHIVED" });
  }
  if (farmer.profileClaimStatus !== "unclaimed" || hasRealClerkLink(farmer)) {
    throw new AppError(
      "This Farmer can no longer be archived by a Technician because the profile is already connected to an app account. An Admin can manage this profile.",
      { status: 409, code: "FARMER_ARCHIVE_ADMIN_REQUIRED" },
    );
  }
  const claimConflict = claimTransitionConflict(farmer, now);
  if (claimConflict) throw claimConflict;
  const invitationRevoked = isEffectivePendingFarmerInvitation(farmer, now);
  if (invitationRevoked) {
    await revokeFarmerInvitationOrFail(farmer.farmerAppInvitation.clerkInvitationId);
  }

  const archived = await User.findOneAndUpdate(
    {
      _id: farmerId,
      role: "farmer",
      status: farmer.status,
      deletedAt: null,
      profileClaimStatus: "unclaimed",
      $and: [unlinkedFarmerClerkFilter(), noActiveFarmerClaimReservation(now)],
      ...invitationSnapshotMatch(farmer.farmerAppInvitation),
    },
    { $set: {
      deletedAt: now, deactivatedBy: technicianId, pushToken: "",
      ...(invitationRevoked
        ? { "farmerAppInvitation.status": "revoked", "farmerAppInvitation.lastCheckedAt": now }
        : {}),
    } },
    { returnDocument: "after", runValidators: true },
  );
  if (!archived) {
    throw new AppError("Farmer profile changed. Refresh and try again.", {
      status: 409,
      code: "FARMER_ARCHIVE_STATE_CHANGED",
    });
  }
  return archived;
};
