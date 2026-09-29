import { User } from "../models/user.model.js";

const identityFieldsToClear = {
  clerkId: 1,
  pushToken: 1,
};

const farmerDisconnectUpdate = {
  $set: {
    isVerified: false,
    profileClaimStatus: "unclaimed",
    profileClaimedAt: null,
    profileClaimedByClerkId: "",
  },
  $unset: identityFieldsToClear,
};

const staffDisconnectUpdate = {
  $set: {
    isVerified: false,
    status: "suspended",
    profileClaimedAt: null,
    profileClaimedByClerkId: "",
  },
  $unset: identityFieldsToClear,
};

export const disconnectClerkIdentityFromDomainUser = async ({ clerkId } = {}) => {
  if (!clerkId) return { status: "not_found" };

  const linkedUser = await User.findOne({ clerkId }).select("_id role clerkId").lean();
  if (!linkedUser) return { status: "not_found" };

  const update = linkedUser.role === "farmer"
    ? farmerDisconnectUpdate
    : staffDisconnectUpdate;
  const disconnected = await User.findOneAndUpdate(
    { _id: linkedUser._id, clerkId },
    update,
    { returnDocument: "after" },
  );

  if (!disconnected) return { status: "not_found" };
  return {
    status: "disconnected",
    userId: disconnected._id,
    role: disconnected.role,
  };
};
