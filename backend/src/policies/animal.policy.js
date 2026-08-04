import { AppError } from "../utils/app-error.js";

export const assertAnimalAccess = (user, animal) => {
  if (!animal) throw new AppError("Animal not found", { status: 404, code: "ANIMAL_NOT_FOUND" });
  const farmerIdStr = animal.farmerId?._id?.toString() || animal.farmerId?.toString();
  if (user.role === "farmer" && farmerIdStr !== user._id.toString()) {
    throw new AppError("You do not have access to this animal", { status: 403, code: "ANIMAL_ACCESS_DENIED" });
  }
};

export const assertClinicalRole = (user) => {
  if (!["technician", "veterinarian", "admin"].includes(user.role)) {
    throw new AppError("Clinical access is required", { status: 403, code: "CLINICAL_ACCESS_REQUIRED" });
  }
};
