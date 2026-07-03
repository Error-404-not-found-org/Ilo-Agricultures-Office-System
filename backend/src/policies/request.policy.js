import { AppError } from "../utils/app-error.js";

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
