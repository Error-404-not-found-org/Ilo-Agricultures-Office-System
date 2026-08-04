import { AppError } from "../utils/app-error.js";

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

  // Technicians and Veterinarians can view farmer profiles (read-only)
  if (["technician", "veterinarian"].includes(requester.role) && targetUser.role === "farmer") {
    return;
  }

  throw new AppError("Forbidden - you do not have access to view this user profile", { status: 403, code: "USER_ACCESS_DENIED" });
};

export const assertCanUpdateUser = (requester, targetUser, updates = {}) => {
  if (!targetUser) {
    throw new AppError("User not found", { status: 404, code: "USER_NOT_FOUND" });
  }

  // Admins can update any user and modify any field
  if (requester.role === "admin") {
    return;
  }

  // Technicians and Veterinarians must not freely modify farmer/other profiles
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
  if (!["admin", "technician", "veterinarian"].includes(user.role)) {
    throw new AppError("Forbidden - clinical access is required", { status: 403, code: "CLINICAL_ACCESS_REQUIRED" });
  }
};
