import crypto from "crypto";
import mongoose from "mongoose";
import cloudinary from "../config/cloudinary.js";
import { Animal } from "../models/animal.model.js";
import { Calving } from "../models/calving.model.js";
import { Notification } from "../models/notification.model.js";
import { Task } from "../models/task.model.js";
import { AppError } from "../utils/app-error.js";

const normalizeCalves = (calves) => {
  if (!Array.isArray(calves) || calves.length === 0) {
    throw new AppError("At least one calf record is required.", {
      status: 400,
      code: "CALF_RECORD_REQUIRED",
    });
  }

  const normalized = calves.map((calf, index) => {
    const earTag = String(calf.earTag || "").trim();
    const sex = String(calf.sex || "").trim().toUpperCase();
    if (!earTag) {
      throw new AppError(`Calf #${index + 1} requires an ear tag.`, {
        status: 400,
        code: "CALF_EAR_TAG_REQUIRED",
      });
    }
    if (!["M", "F"].includes(sex)) {
      throw new AppError(`Calf #${index + 1} requires a valid sex.`, {
        status: 400,
        code: "CALF_SEX_INVALID",
      });
    }
    return { ...calf, earTag, sex };
  });

  const seen = new Set();
  for (const calf of normalized) {
    const key = calf.earTag.toLowerCase();
    if (seen.has(key)) {
      throw new AppError(`Duplicate calf ear tag detected: ${calf.earTag}`, {
        status: 409,
        code: "DUPLICATE_CALF_EAR_TAG",
      });
    }
    seen.add(key);
  }

  return normalized;
};

const uploadCalfImages = async (calves) =>
  Promise.all(
    calves.map(async (calf, index) => {
      if (!calf.imageUrl?.startsWith("data:image")) return calf.imageUrl || "";
      try {
        const upload = await cloudinary.uploader.upload(calf.imageUrl, {
          folder: "livestock_profiles",
        });
        return upload.secure_url;
      } catch (error) {
        console.error(`[Calving] Calf image upload failed at index ${index}:`, error.message);
        return "";
      }
    }),
  );

export const persistCalving = async ({
  mother,
  pregnancy,
  calves,
  date,
  calvingEase,
  numberOfCalves,
  technicianNote,
  actor,
  taskId,
}) => {
  const normalizedCalves = normalizeCalves(calves);
  if (
    numberOfCalves !== undefined &&
    Number(numberOfCalves) !== normalizedCalves.length
  ) {
    throw new AppError("The number of calves does not match the calf records.", {
      status: 400,
      code: "CALF_COUNT_MISMATCH",
    });
  }

  if (String(pregnancy.animalId) !== String(mother._id)) {
    throw new AppError("The pregnancy record does not belong to this mother.", {
      status: 409,
      code: "PREGNANCY_MOTHER_MISMATCH",
    });
  }

  const calvingDate = date ? new Date(date) : new Date();
  if (Number.isNaN(calvingDate.getTime())) {
    throw new AppError("Invalid calving date.", {
      status: 400,
      code: "CALVING_DATE_INVALID",
    });
  }
  if (calvingDate.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new AppError("Calving date cannot be in the future.", {
      status: 400,
      code: "CALVING_DATE_IN_FUTURE",
    });
  }

  // Uploads are external side effects, so complete them before opening the DB transaction.
  const imageUrls = await uploadCalfImages(normalizedCalves);
  const sireBreed = pregnancy.inseminationId?.sireBreed || "Unknown";
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const existingCalving = await Calving.findOne({
        pregnancyId: pregnancy._id,
        deletedAt: null,
      }).session(session);
      if (existingCalving) {
        throw new AppError("A calving record already exists for this pregnancy.", {
          status: 409,
          code: "CALVING_ALREADY_RECORDED",
        });
      }

      const existingCalf = await Animal.findOne({
        farmerId: mother.farmerId,
        earTag: { $in: normalizedCalves.map((calf) => calf.earTag) },
        deletedAt: null,
      })
        .session(session)
        .select("earTag");
      if (existingCalf) {
        throw new AppError(`Ear tag ${existingCalf.earTag} is already in use.`, {
          status: 409,
          code: "CALF_EAR_TAG_IN_USE",
        });
      }

      const calfDocuments = normalizedCalves.map((calf, index) => ({
        earTag: calf.earTag,
        animalId: `ANM-${crypto.randomUUID().slice(0, 12).toUpperCase()}`,
        species: mother.species,
        breed:
          sireBreed !== "Unknown"
            ? `${mother.breed} x ${sireBreed}`
            : mother.breed,
        farmerId: mother.farmerId,
        motherId: mother._id,
        imageUrl: imageUrls[index],
        isVerified: actor.role !== "farmer",
        gender: calf.sex === "M" ? "Male" : "Female",
        color: calf.color || mother.color || "Not Provided",
        brand: calf.brand || mother.brand || "",
        birthDate: calvingDate,
        barangay: mother.barangay || "Not Provided",
        activityLogs: [
          {
            event: "Initial Registration",
            date: new Date(),
            description: `Registered through the calving record of mother ${mother.earTag || mother.animalId}.`,
          },
        ],
      }));

      const offspring = await Animal.insertMany(calfDocuments, { session });
      const calfRecords = offspring.map((calf, index) => ({
        sex: normalizedCalves[index].sex,
        earTag: calf.earTag,
        animalId: calf._id,
      }));

      const [calving] = await Calving.create(
        [
          {
            animalId: mother._id,
            farmerId: mother.farmerId,
            pregnancyId: pregnancy._id,
            date: calvingDate,
            numberOfCalves: offspring.length,
            calves: calfRecords,
            calvingEase,
            technicianId: actor.role === "farmer" ? undefined : actor._id,
            technicianNote,
          },
        ],
        { session },
      );

      await Animal.findByIdAndUpdate(
        mother._id,
        {
          $set: {
            reproductiveStatus: "Post-partum",
            lastCalvingDate: calvingDate,
          },
          $inc: { parity: 1 },
          $push: {
            activityLogs: {
              event: "Calving",
              date: new Date(),
              description: `Gave birth to ${offspring.length} calf/calves. Ease: ${calvingEase}.`,
            },
          },
        },
        { session },
      );

      if (taskId) {
        const task = await Task.findOneAndUpdate(
          {
            _id: taskId,
            farmerId: mother.farmerId,
            animalIds: mother._id,
            taskType: { $in: ["CD", "Calving"] },
            status: { $nin: ["Completed", "Cancelled"] },
            $or: [{ technicianId: actor._id }, { technicianId: null }],
          },
          { $set: { status: "Completed", relatedRecordType: "calving", relatedRecordId: calving._id, completedAt: new Date(), technicianId: actor._id } },
          { returnDocument: "after", session },
        );
        if (!task) throw new AppError("The calving task is not active or does not belong to this animal.", { status: 409, code: "TASK_RECORD_MISMATCH" });
      }

      if (actor.role !== "farmer" && mother.farmerId) {
        const sexList = normalizedCalves
          .map((calf) => (calf.sex === "M" ? "Male" : "Female"))
          .join(", ");
        await Notification.create(
          [
            {
              recipientId: mother.farmerId,
              senderId: actor._id,
              type: "system",
              relatedId: calving._id,
              title: "🍼 New Calving Recorded",
              message: `Congratulations! Your animal Tag #${mother.earTag || mother.animalId} successfully calved ${offspring.length} offspring (${sexList}).`,
            },
          ],
          { session },
        );
      }

      result = { calving, offspring };
    });
  } finally {
    await session.endSession();
  }

  return result;
};
