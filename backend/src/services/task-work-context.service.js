import mongoose from "mongoose";

import { Animal } from "../models/animal.model.js";
import { Calving } from "../models/calving.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { User } from "../models/user.model.js";

const idOf = (value) => {
  let current = value;
  const seen = new Set();
  for (let depth = 0; depth < 5; depth += 1) {
    if (current == null) return null;
    if (typeof current === "string") return current;
    if (typeof current === "number" || typeof current === "bigint") return String(current);
    if (typeof current?.toHexString === "function") {
      try { return current.toHexString(); } catch { return null; }
    }
    if (typeof current !== "object" || seen.has(current)) return null;
    seen.add(current);
    const nestedId = current._id ?? current.id;
    if (nestedId == null || nestedId === current) return null;
    current = nestedId;
  }
  return null;
};

const uniqueMongoIds = (values) => [
  ...new Set(values.map(idOf).filter((value) => value && mongoose.isValidObjectId(value))),
];

const hasPresentationFields = (value, fields) =>
  value && typeof value === "object" && fields.some((field) => value[field] !== undefined);

export const resolveTaskWorkContexts = async (tasks = []) => {
  const relationships = tasks.map((task) => {
    const metadata = task.metadata || {};
    const relatedRecordType = String(task.relatedRecordType || "").toLowerCase();
    return {
      task,
      directAnimalRef:
        (Array.isArray(task.animalIds) && task.animalIds[0]) || task.animalId || metadata.animalId || null,
      directFarmerRef: task.farmerId || metadata.farmerId || null,
      pregnancyId: idOf(task.pregnancyId || metadata.pregnancyId ||
        (relatedRecordType === "pregnancy" ? task.relatedRecordId : null)),
      calvingId: idOf(task.calvingId || metadata.calvingId ||
        (relatedRecordType === "calving" ? task.relatedRecordId : null)),
      inseminationId: idOf(task.inseminationId || metadata.inseminationId ||
        (relatedRecordType === "insemination" ? task.relatedRecordId : null)),
    };
  });
  const pregnancyIds = uniqueMongoIds(relationships.map((item) => item.pregnancyId));
  const calvingIds = uniqueMongoIds(relationships.map((item) => item.calvingId));
  const inseminationIds = uniqueMongoIds(relationships.map((item) => item.inseminationId));
  const [pregnancies, calvings, inseminations] = await Promise.all([
    pregnancyIds.length ? Pregnancy.find({ _id: { $in: pregnancyIds } })
      .select("_id animalId farmerId inseminationId pregnancyDiagnosis confirmation completedAt").lean() : [],
    calvingIds.length ? Calving.find({ _id: { $in: calvingIds } })
      .select("_id animalId farmerId pregnancyId inseminationId date").lean() : [],
    inseminationIds.length ? Insemination.find({ _id: { $in: inseminationIds } })
      .select("_id animalId farmerId outcomeConfirmedAt inseminationDate completedAt").lean() : [],
  ]);
  const pregnancyById = new Map(pregnancies.map((item) => [idOf(item), item]));
  const calvingById = new Map(calvings.map((item) => [idOf(item), item]));
  const inseminationById = new Map(inseminations.map((item) => [idOf(item), item]));
  const resolved = relationships.map((relationship) => {
    const pregnancy = pregnancyById.get(relationship.pregnancyId) || null;
    const calving = calvingById.get(relationship.calvingId) || null;
    const insemination = inseminationById.get(relationship.inseminationId) || null;
    return {
      ...relationship,
      pregnancy,
      calving,
      insemination,
      animalRef: relationship.directAnimalRef || pregnancy?.animalId || calving?.animalId || insemination?.animalId || null,
      farmerRef: relationship.directFarmerRef || pregnancy?.farmerId || calving?.farmerId || insemination?.farmerId || null,
    };
  });
  const animalIds = uniqueMongoIds(resolved.map((item) => item.animalRef));
  const animals = animalIds.length ? await Animal.find({ _id: { $in: animalIds } })
    .select("_id farmerId name animalId earTag imageUrl breed species gender").lean() : [];
  const animalById = new Map(animals.map((item) => [idOf(item), item]));
  const farmerIds = uniqueMongoIds(resolved.map((item) => {
    const animal = animalById.get(idOf(item.animalRef));
    return item.farmerRef || animal?.farmerId || null;
  }));
  const farmers = farmerIds.length ? await User.find({ _id: { $in: farmerIds } })
    .select("_id name phoneNumber phone address farmLocation imageUrl avatarUrl profilePicture avatar").lean() : [];
  const farmerById = new Map(farmers.map((item) => [idOf(item), item]));

  return new Map(resolved.map((item) => {
    const fetchedAnimal = animalById.get(idOf(item.animalRef));
    const animal = fetchedAnimal ||
      (hasPresentationFields(item.animalRef, ["name", "animalId", "earTag"]) ? item.animalRef : null);
    const farmerRef = item.farmerRef || animal?.farmerId || null;
    const fetchedFarmer = farmerById.get(idOf(farmerRef));
    const farmer = fetchedFarmer ||
      (hasPresentationFields(farmerRef, ["name", "address", "farmLocation"]) ? farmerRef : null);
    return [idOf(item.task), { animal, farmer, pregnancy: item.pregnancy, calving: item.calving, insemination: item.insemination }];
  }));
};
