import { AppError } from "../utils/app-error.js";

const OPERATIONAL_USER_ROLES = Object.freeze([
  "farmer",
  "technician",
]);

const OPERATIONALLY_MANAGEABLE_USER_ROLES = new Set(OPERATIONAL_USER_ROLES);

const operationalTargetError = () =>
  new AppError(
    "Admin accounts cannot be managed through operational user-management actions.",
    {
      status: 403,
      code: "OPERATIONAL_USER_TARGET_FORBIDDEN",
    },
  );

export const assertOperationallyManageableUser = (targetUser) => {
  if (!targetUser) {
    throw new AppError("User not found", {
      status: 404,
      code: "USER_NOT_FOUND",
    });
  }

  if (!OPERATIONALLY_MANAGEABLE_USER_ROLES.has(targetUser.role)) {
    throw operationalTargetError();
  }
};

export const assertOperationalUserRole = (role) => {
  if (!OPERATIONALLY_MANAGEABLE_USER_ROLES.has(role)) {
    throw operationalTargetError();
  }
};

export const getOperationalUserRoleFilter = (requestedRole) => {
  if (
    requestedRole === undefined ||
    requestedRole === null
  ) {
    return { $in: [...OPERATIONAL_USER_ROLES] };
  }

  assertOperationalUserRole(requestedRole);
  return requestedRole;
};

export const assertCanReadUser = (requester, targetUser) => {
  if (!targetUser) {
    throw new AppError("User not found", { status: 404, code: "USER_NOT_FOUND" });
  }

  // Admins can read any user profile
  if (requester.role === "admin") {
    return;
  }

  // Users can read their own profiles
  if (requester._id.toString() === targetUser._id.toString()) {
    return;
  }

  // Technicians can view farmer profiles (read-only)
  if (["technician"].includes(requester.role) && targetUser.role === "farmer") {
    return;
  }

  throw new AppError("Forbidden - you do not have access to view this user profile", { status: 403, code: "USER_ACCESS_DENIED" });
};

export const assertCanUpdateUser = (requester, targetUser, updates = {}) => {
  if (!targetUser) {
    throw new AppError("User not found", { status: 404, code: "USER_NOT_FOUND" });
  }

  // Operational Admin management is limited to Farmer and Technician targets.
  if (requester.role === "admin") {
    assertOperationallyManageableUser(targetUser);
    return;
  }

  // Technicians must not freely modify farmer/other profiles
  if (requester._id.toString() !== targetUser._id.toString()) {
    throw new AppError("Forbidden - you do not have permission to modify other users' profiles", { status: 403, code: "USER_UPDATE_DENIED" });
  }

  // Users modifying their own profiles can only modify safe fields
  // Unsafe fields: role, status, deletedAt, deactivatedBy, clerkId, isVerified
  const unsafeFields = ["role", "status", "deletedAt", "deactivatedBy", "clerkId", "isVerified"];
  for (const field of unsafeFields) {
    if (updates[field] !== undefined && updates[field] !== targetUser[field]) {
      throw new AppError(`Forbidden - role, status, and administrative fields can only be modified by an administrator`, { status: 403, code: "ADMIN_ONLY_FIELD" });
    }
  }
};

// Retained for backward compatibility
export const assertUserAccess = (requester, targetUser) => {
  assertCanReadUser(requester, targetUser);
};

export const assertAdmin = (user) => {
  if (user.role !== "admin") {
    throw new AppError("Forbidden - administrator role is required", { status: 403, code: "ADMIN_ROLE_REQUIRED" });
  }
};

export const assertTechnicianOrAdmin = (user) => {
  if (!["admin", "technician"].includes(user.role)) {
    throw new AppError("Forbidden - staff access is required", { status: 403, code: "STAFF_ACCESS_REQUIRED" });
  }
};

export const assertClinicalRole = (user) => {
  if (!["admin", "technician"].includes(user.role)) {
    throw new AppError("Forbidden - clinical access is required", { status: 403, code: "CLINICAL_ACCESS_REQUIRED" });
  }
};
