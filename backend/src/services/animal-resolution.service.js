import { Animal } from "../models/animal.model.js";
import { AppError } from "../utils/app-error.js";

export const normalizeAnimalEarTag = (earTag) =>
  String(earTag || "").trim().toLowerCase();

const escapedExactRegex = (value) =>
  new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");

export const resolveAnimalContext = async ({
  animalId,
  farmerId,
  earTag,
  session,
  allowUnscopedEarTag = false,
} = {}) => {
  if (animalId) {
    const animal = await Animal.findOne({ _id: animalId, deletedAt: null }).session(session || null);
    if (animal && farmerId && String(animal.farmerId) !== String(farmerId)) {
      throw new AppError("The selected animal does not belong to the selected farmer.", {
        status: 400,
        code: "ANIMAL_FARMER_MISMATCH",
      });
    }
    return animal;
  }

  const normalizedEarTag = normalizeAnimalEarTag(earTag);
  if (!normalizedEarTag) return null;
  const tagMatch = {
    $or: [
      { normalizedEarTag },
      { normalizedEarTag: { $exists: false }, earTag: escapedExactRegex(String(earTag).trim()) },
    ],
  };

  if (farmerId) {
    return Animal.findOne({ farmerId, deletedAt: null, ...tagMatch }).session(session || null);
  }
  if (!allowUnscopedEarTag) {
    throw new AppError("Select a Farmer before resolving an animal by ear tag.", {
      status: 400,
      code: "ANIMAL_FARMER_CONTEXT_REQUIRED",
    });
  }

  const matches = await Animal.find({ deletedAt: null, ...tagMatch }).limit(2).session(session || null);
  if (matches.length > 1) {
    throw new AppError("More than one active animal uses this ear tag. Select the Farmer or animal record.", {
      status: 409,
      code: "AMBIGUOUS_EAR_TAG",
    });
  }
  return matches[0] || null;
};
