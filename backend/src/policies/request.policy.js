import { AppError } from "../utils/app-error.js";
import { assertTechnicianOrAdmin } from "./user.policy.js";

const requestAssigneeId = (request) =>
  request?.approvedBy?._id?.toString() || request?.approvedBy?.toString() || null;

const requestFieldId = (value) =>
  value?._id?.toString?.() || value?.toString?.() || null;

const fieldIsActorOrEmpty = (field, actorId) => ({
  $or: [
    { [field]: actorId },
    { [field]: null },
    { [field]: { $exists: false } },
  ],
});

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

export const assertAIRequestMutationOwnership = (user, request) => {
  if (user.role === "admin") return;

  const actorId = user._id.toString();
  const ownerIds = [
    requestFieldId(request?.approvedBy),
    requestFieldId(request?.technicianId),
  ].filter(Boolean);

  if (!ownerIds.includes(actorId) || ownerIds.some((id) => id !== actorId)) {
    throw new AppError(
      ownerIds.length
        ? "This AI request is assigned to another technician."
        : "Claim this AI request before changing it.",
      {
        status: ownerIds.length ? 403 : 409,
        code: ownerIds.length
          ? "AI_REQUEST_ASSIGNED_TO_OTHER"
          : "AI_REQUEST_CLAIM_REQUIRED",
      },
    );
  }
};

export const buildAIRequestMutationOwnershipGuard = ({ technicianId }) => ({
  $and: [
    fieldIsActorOrEmpty("approvedBy", technicianId),
    fieldIsActorOrEmpty("technicianId", technicianId),
    {
      $or: [
        { approvedBy: technicianId },
        { technicianId },
      ],
    },
  ],
});

export const assertHealthRequestMutationOwnership = (
  user,
  request,
  { allowUnassigned = false } = {},
) => {
  if (user.role === "admin") return;

  const actorId = user._id.toString();
  const ownerIds = [
    requestFieldId(request?.handledBy),
    requestFieldId(request?.assignedTechnicianId),
  ].filter(Boolean);

  if (ownerIds.some((id) => id !== actorId)) {
    throw new AppError(
      "This Health request is assigned to another technician.",
      { status: 403, code: "HEALTH_REQUEST_ASSIGNED_TO_OTHER" },
    );
  }

  if (!allowUnassigned && !ownerIds.includes(actorId)) {
    throw new AppError("Claim this Health request before changing it.", {
      status: 409,
      code: "HEALTH_REQUEST_CLAIM_REQUIRED",
    });
  }
};

export const buildHealthRequestMutationOwnershipGuard = ({
  technicianId,
  allowUnassigned = false,
}) => {
  const fieldsGuard = [
    fieldIsActorOrEmpty("handledBy", technicianId),
    fieldIsActorOrEmpty("assignedTechnicianId", technicianId),
  ];

  if (!allowUnassigned) {
    fieldsGuard.push({
      $or: [
        { handledBy: technicianId },
        { assignedTechnicianId: technicianId },
      ],
    });
  }

  return { $and: fieldsGuard };
};

export const assertHealthRequestAccess = (user, request) => {
  if (!request) {
    throw new AppError("Health Request record not found", { status: 404, code: "HEALTH_REQUEST_NOT_FOUND" });
  }

  // Clinical roles (admin, technician) can access any health request
  if (["admin", "technician"].includes(user.role)) {
    return;
  }

  // Farmers can only view/update their own health requests
  const farmerIdStr = request.farmerId?._id?.toString() || request.farmerId?.toString();
  if (user._id.toString() !== farmerIdStr) {
    throw new AppError("Forbidden - you do not have access to this health request", { status: 403, code: "HEALTH_REQUEST_ACCESS_DENIED" });
  }
};
