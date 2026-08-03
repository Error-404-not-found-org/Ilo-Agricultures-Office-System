import { AppError } from "../utils/app-error.js";
import { assertTechnicianOrAdmin } from "./user.policy.js";

const requestAssigneeId = (request) =>
  request?.approvedBy?._id?.toString() || request?.approvedBy?.toString() || null;

export const assertAIRequestAccess = (user, request) => {
  if (!request) {
    throw new AppError("AI Request record not found", { status: 404, code: "AI_REQUEST_NOT_FOUND" });
  }

  // Admins and technicians can access any AI request
  if (["admin", "technician"].includes(user.role)) {
    return;
  }

  // Farmers can only view/update their own AI requests
  const farmerIdStr = request.farmerId?._id?.toString() || request.farmerId?.toString();
  if (user._id.toString() !== farmerIdStr) {
    throw new AppError("Forbidden - you do not have access to this AI request", { status: 403, code: "AI_REQUEST_ACCESS_DENIED" });
  }
};

export const assertAIRequestStatusAccess = (user, request) => {
  assertTechnicianOrAdmin(user);

  if (!request) {
    throw new AppError("AI Request record not found", {
      status: 404,
      code: "AI_REQUEST_NOT_FOUND",
    });
  }

  if (user.role === "admin") return;

  const assignedTechnicianId = requestAssigneeId(request);
  if (!assignedTechnicianId) {
    throw new AppError(
      "Claim this AI request before updating its status.",
      {
        status: 409,
        code: "AI_REQUEST_CLAIM_REQUIRED",
      },
    );
  }

  if (assignedTechnicianId !== user._id.toString()) {
    throw new AppError(
      "This AI request is assigned to another technician.",
      {
        status: 403,
        code: "AI_REQUEST_ASSIGNED_TO_OTHER",
      },
    );
  }
};

// Reusable MongoDB condition for assignment-sensitive AI mutations. Future
// claim-and-schedule work may opt into pending/unassigned rows; ordinary status
// updates must remain limited to the technician who already owns the request.
export const buildAIRequestAssignmentGuard = ({
  technicianId,
  allowPendingUnassigned = false,
}) => {
  const assignedToActor = { approvedBy: technicianId };
  if (!allowPendingUnassigned) return assignedToActor;

  return {
    $or: [
      assignedToActor,
      { status: "pending", approvedBy: null },
      { status: "pending", approvedBy: { $exists: false } },
    ],
  };
};

export const assertHealthRequestAccess = (user, request) => {
  if (!request) {
    throw new AppError("Health Request record not found", { status: 404, code: "HEALTH_REQUEST_NOT_FOUND" });
  }

  // Clinical roles (admin, technician, veterinarian) can access any health request
  if (["admin", "technician", "veterinarian"].includes(user.role)) {
    return;
  }

  // Farmers can only view/update their own health requests
  const farmerIdStr = request.farmerId?._id?.toString() || request.farmerId?.toString();
  if (user._id.toString() !== farmerIdStr) {
    throw new AppError("Forbidden - you do not have access to this health request", { status: 403, code: "HEALTH_REQUEST_ACCESS_DENIED" });
  }
};
