import crypto from "crypto";
import mongoose from "mongoose";
import cloudinary from "../config/cloudinary.js";
import { getBreedProfile } from "../utils/cattleCore.js";
import { Animal } from "../models/animal.model.js";
import { AnimalTimelineEvent } from "../models/animal-timeline-event.model.js";
import { AuditLog } from "../models/audit-log.model.js";
import { Calving } from "../models/calving.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Notification } from "../models/notification.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Task } from "../models/task.model.js";
import { AppError } from "../utils/app-error.js";
import { CALVING_OUTCOMES, inferCalvingOutcome } from "../domain/calving-outcome.js";

const LIVE_BIRTH_EASES = new Set(["Natural", "Normal", "Difficult", "Cesarean"]);
const COMPATIBLE_MATERNAL_STATES = new Set(["Pregnant", "Dry"]);
const DAY_MS = 24 * 60 * 60 * 1000;
const EARLY_CALVING_TOLERANCE_DAYS = 30;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveOutcome = (outcome, calvingEase) => {
  const resolved = inferCalvingOutcome({ outcome, calvingEase });
  if (outcome) {
    if (resolved === CALVING_OUTCOMES.ABORTION || (resolved && LIVE_BIRTH_EASES.has(calvingEase))) return resolved;
  } else if (resolved && (LIVE_BIRTH_EASES.has(calvingEase) || ["Abortion", "Stillbirth"].includes(calvingEase))) {
    return resolved;
  }
  throw new AppError("Invalid calving outcome.", {
    status: 400,
    code: "CALVING_OUTCOME_INVALID",
  });
};

const normalizeLivingCalves = (calves) => {
  if (!Array.isArray(calves) || calves.length === 0) {
    throw new AppError("At least one living calf record is required.", {
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

const normalizeLossCalves = (calves, outcome) => {
  const submitted = Array.isArray(calves) ? calves : [];
  if (outcome === "abortion") return [];
  if (submitted.length === 0) {
    throw new AppError("At least one stillborn calf detail is required.", {
      status: 400,
      code: "STILLBORN_CALF_REQUIRED",
    });
  }
  return submitted.map((calf, index) => {
    const sex = String(calf.sex || "").trim().toUpperCase();
    if (sex && !["M", "F"].includes(sex)) {
      throw new AppError(`Stillborn calf #${index + 1} has an invalid sex.`, {
        status: 400,
        code: "CALF_SEX_INVALID",
      });
    }
    return {
      sex: sex || undefined,
      earTag: String(calf.earTag || "").trim(),
      color: String(calf.color || "").trim(),
      brand: String(calf.brand || "").trim(),
    };
  });
};

const uploadCalfImages = async (calves) =>
  Promise.all(
    calves.map(async (calf, index) => {
      if (!calf.imageUrl?.startsWith("data:image")) {
        return { url: calf.imageUrl || "", publicId: null };
      }
      try {
        const upload = await cloudinary.uploader.upload(calf.imageUrl, {
          folder: "livestock_profiles",
        });
        return { url: upload.secure_url, publicId: upload.public_id };
      } catch (error) {
        console.error(`[Calving] Calf image upload failed at index ${index}:`, error.message);
        return { url: "", publicId: null };
      }
    }),
  );

const cleanupUploadedImages = async (uploads) => {
  const publicIds = uploads.map((upload) => upload.publicId).filter(Boolean);
  await Promise.allSettled(publicIds.map(async (publicId) => {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error(`[Calving] Failed to clean up uploaded image ${publicId}:`, error.message);
    }
  }));
};

export const getCalvingReadiness = ({
  mother,
  pregnancy,
  insemination,
  at = new Date(),
}) => {
  if (pregnancy?.pregnancyDiagnosis?.result !== "Pregnant") {
    return {
      isEligible: false,
      code: "PREGNANCY_NOT_CONFIRMED",
      reason: "A technician-confirmed pregnancy is required.",
      gestationDays: null,
      minimumDays: null,
      earliestEligibleDate: null,
    };
  }

  const aiDate = new Date(insemination?.inseminationDate);
  const checkDate = new Date(at);
  if (Number.isNaN(aiDate.getTime()) || Number.isNaN(checkDate.getTime())) {
    return {
      isEligible: false,
      code: "CALVING_READINESS_UNAVAILABLE",
      reason: "Calving readiness cannot be calculated without a valid AI date.",
      gestationDays: null,
      minimumDays: null,
      earliestEligibleDate: null,
    };
  }

  const { avgGestationDays } = getBreedProfile(
    mother?.species,
    mother?.breed,
  );
  const minimumDays = avgGestationDays - EARLY_CALVING_TOLERANCE_DAYS;
  // Calving forms capture a calendar date, while AI records can include a
  // timestamp. Compare UTC calendar days so an AI time does not create an
  // off-by-one result or make the displayed eligible date fail at midnight.
  const aiCalendarDay = Date.UTC(
    aiDate.getUTCFullYear(),
    aiDate.getUTCMonth(),
    aiDate.getUTCDate(),
  );
  const checkCalendarDay = Date.UTC(
    checkDate.getUTCFullYear(),
    checkDate.getUTCMonth(),
    checkDate.getUTCDate(),
  );
  const gestationDays = Math.floor(
    (checkCalendarDay - aiCalendarDay) / DAY_MS,
  );
  const earliestEligibleDate = new Date(
    aiCalendarDay + minimumDays * DAY_MS,
  );
  const isEligible = gestationDays >= minimumDays;

  return {
    isEligible,
    code: isEligible ? "CALVING_WINDOW_OPEN" : "CALVING_TOO_EARLY",
    reason: isEligible
      ? `Live-birth recording is available at Day ${gestationDays}.`
      : `Live-birth recording becomes available on Day ${minimumDays}. Pregnancy loss can still be recorded when clinically applicable.`,
    gestationDays,
    minimumDays,
    averageGestationDays: avgGestationDays,
    daysRemaining: Math.max(0, minimumDays - gestationDays),
    earliestEligibleDate,
    expectedCalvingDate: pregnancy?.targetCalvingDate || null,
  };
};

const validateChronology = ({ calvingDate, mother, pregnancy, insemination, outcome }) => {
  const aiDate = new Date(insemination.inseminationDate);
  const diagnosisDate = new Date(pregnancy.pregnancyDiagnosis?.date);

  if (Number.isNaN(aiDate.getTime())) {
    throw new AppError("The related insemination has no valid AI date.", {
      status: 409,
      code: "INSEMINATION_DATE_REQUIRED",
    });
  }
  if (Number.isNaN(diagnosisDate.getTime())) {
    throw new AppError("The pregnancy has no valid technician diagnosis date.", {
      status: 409,
      code: "PREGNANCY_NOT_CONFIRMED",
    });
  }
  if (calvingDate < aiDate) {
    throw new AppError("Calving date cannot be before the AI date.", {
      status: 422,
      code: "CALVING_BEFORE_AI",
    });
  }
  if (calvingDate < diagnosisDate) {
    throw new AppError("Calving date cannot be before the pregnancy diagnosis.", {
      status: 422,
      code: "CALVING_BEFORE_PREGNANCY_DIAGNOSIS",
    });
  }
  if (mother.lastCalvingDate && calvingDate <= new Date(mother.lastCalvingDate)) {
    throw new AppError("Calving date conflicts with the mother's previous calving date.", {
      status: 422,
      code: "CALVING_CONFLICTS_PREVIOUS",
    });
  }

  if (outcome !== "abortion") {
    const readiness = getCalvingReadiness({
      mother,
      pregnancy,
      insemination,
      at: calvingDate,
    });
    if (!readiness.isEligible) {
      throw new AppError(
        `Calving is too early for ${mother.species}; at least ${readiness.minimumDays} gestation days are required.`,
        {
          status: 422,
          code: readiness.code,
          details: readiness,
        },
      );
    }
  }
};

const normalizeDatabaseError = (error) => {
  if (error?.code === 11000) {
    if (error?.keyPattern?.pregnancyId) {
      return new AppError("A calving record already exists for this pregnancy.", {
        status: 409,
        code: "CALVING_ALREADY_RECORDED",
      });
    }
    if (error?.keyPattern?.earTag || error?.keyPattern?.normalizedEarTag) {
      return new AppError("A submitted calf ear tag is already in use.", {
        status: 409,
        code: "CALF_EAR_TAG_IN_USE",
      });
    }
  }
  return error;
};

const taskActorFilter = (actor) =>
  actor.role === "farmer"
    ? {}
    : { $or: [{ technicianId: actor._id }, { technicianId: null }] };

const findMatchingCalvingTask = async ({
  taskId,
  mother,
  pregnancy,
  inseminationId,
  existingCalving,
  actor,
  session,
}) => {
  const baseFilter = {
    farmerId: mother.farmerId,
    animalIds: mother._id,
    taskType: { $in: ["CD", "Calving"] },
    status: { $in: ["Pending", "In Progress"] },
    ...taskActorFilter(actor),
  };

  if (taskId) {
    const suppliedTask = await Task.findOne({
      ...baseFilter,
      _id: taskId,
      $and: [
        {
          $or: [
            { relatedRecordType: "pregnancy", relatedRecordId: pregnancy._id },
            { "metadata.inseminationId": inseminationId },
            {
              $or: [
                { relatedRecordId: null },
                { relatedRecordId: { $exists: false } },
              ],
              "metadata.inseminationId": { $exists: false },
            },
          ],
        },
      ],
    }).session(session || null);
    if (!suppliedTask) {
      if (existingCalving) {
        const completedMatchingTask = await Task.findOne({
          _id: taskId,
          farmerId: mother.farmerId,
          animalIds: mother._id,
          taskType: { $in: ["CD", "Calving"] },
          status: "Completed",
          relatedRecordType: "calving",
          relatedRecordId: existingCalving._id,
        }).session(session || null);
        if (completedMatchingTask) return null;
      }
      throw new AppError("The calving task is inactive or does not match this record.", {
        status: 409,
        code: "TASK_RECORD_MISMATCH",
      });
    }
    return suppliedTask;
  }

  const pregnancyTask = await Task.findOne({
    ...baseFilter,
    relatedRecordType: "pregnancy",
    relatedRecordId: pregnancy._id,
  })
    .sort({ dueDate: 1, createdAt: 1 })
    .session(session || null);
  if (pregnancyTask) return pregnancyTask;

  const inseminationTask = await Task.findOne({
    ...baseFilter,
    "metadata.inseminationId": inseminationId,
  })
    .sort({ dueDate: 1, createdAt: 1 })
    .session(session || null);
  if (inseminationTask) return inseminationTask;

  return Task.findOne({
    ...baseFilter,
    sourceType: { $in: ["task_scheduler", "client_profile", "manual"] },
    $and: [
      {
        $or: [
          { relatedRecordId: null },
          { relatedRecordId: { $exists: false } },
        ],
      },
      { "metadata.inseminationId": { $exists: false } },
    ],
  })
    .sort({ dueDate: 1, createdAt: 1 })
    .session(session || null);
};

const completeCalvingTask = async ({ task, calving, actor, session }) => {
  if (!task) return null;
  const completedTask = await Task.findOneAndUpdate(
    { _id: task._id, status: { $in: ["Pending", "In Progress"] } },
    {
      $set: {
        status: "Completed",
        relatedRecordType: "calving",
        relatedRecordId: calving._id,
        completedAt: new Date(),
        ...(actor.role === "farmer" ? {} : { technicianId: actor._id }),
      },
    },
    { returnDocument: "after", session },
  );
  if (!completedTask) {
    throw new AppError("The calving task has already been completed.", {
      status: 409,
      code: "TASK_RECORD_MISMATCH",
    });
  }
  return completedTask;
};

const loadAndValidateContext = async ({ motherId, pregnancyId, taskId, actor, calvingDate, outcome, session }) => {
  const currentMother = await Animal.findOne({ _id: motherId, deletedAt: null }).session(session || null);
  if (!currentMother) {
    throw new AppError("Mother animal not found.", { status: 404, code: "MOTHER_NOT_FOUND" });
  }
  const currentPregnancy = await Pregnancy.findOne({ _id: pregnancyId, deletedAt: null }).session(session || null);
  if (!currentPregnancy) {
    throw new AppError("Pregnancy record not found.", { status: 404, code: "PREGNANCY_NOT_FOUND" });
  }
  if (String(currentPregnancy.animalId) !== String(currentMother._id)) {
    throw new AppError("The pregnancy record does not belong to this mother.", { status: 409, code: "PREGNANCY_MOTHER_MISMATCH" });
  }
  if (actor.role === "farmer" && String(currentMother.farmerId) !== String(actor._id)) {
    throw new AppError("You cannot record calving for another farmer's animal.", {
      status: 403,
      code: "CALVING_ACCESS_DENIED",
    });
  }

  const existingCalving = await Calving.findOne({
    pregnancyId: currentPregnancy._id,
    animalId: currentMother._id,
    farmerId: currentMother.farmerId,
    deletedAt: null,
  })
    .populate("calves.animalId")
    .session(session || null);
  const canonicalInseminationId =
    existingCalving?.inseminationId || currentPregnancy.inseminationId;
  if (existingCalving) {
    const task = await findMatchingCalvingTask({
      taskId,
      mother: currentMother,
      pregnancy: currentPregnancy,
      inseminationId: canonicalInseminationId,
      existingCalving,
      actor,
      session,
    });
    return {
      currentMother,
      currentPregnancy,
      insemination: null,
      task,
      existingCalving,
    };
  }
  if (
    currentPregnancy.pregnancyDiagnosis?.result !== "Pregnant" ||
    ["lost", "completed"].includes(currentPregnancy.cycleStatus) ||
    !COMPATIBLE_MATERNAL_STATES.has(currentMother.reproductiveStatus)
  ) {
    throw new AppError("A technician-confirmed active pregnancy is required.", { status: 409, code: "PREGNANCY_NOT_CONFIRMED" });
  }
  const insemination = await Insemination.findOne({
    _id: currentPregnancy.inseminationId,
    animalId: currentMother._id,
    deletedAt: null,
  }).session(session || null);
  if (!insemination) {
    throw new AppError("The related insemination record was not found.", { status: 409, code: "INSEMINATION_NOT_FOUND" });
  }
  validateChronology({ calvingDate, mother: currentMother, pregnancy: currentPregnancy, insemination, outcome });
  const task = await findMatchingCalvingTask({
    taskId,
    mother: currentMother,
    pregnancy: currentPregnancy,
    inseminationId: insemination._id,
    actor,
    session,
  });
  return { currentMother, currentPregnancy, insemination, task, existingCalving: null };
};

export const persistCalving = async ({
  mother,
  pregnancy,
  calves,
  nonLivingCalves,
  date,
  calvingEase,
  outcome: submittedOutcome,
  numberOfCalves,
  technicianNote,
  actor,
  taskId,
}) => {
  const outcome = resolveOutcome(submittedOutcome, calvingEase);
  const hasLivingCalves = [CALVING_OUTCOMES.LIVE_BIRTH, CALVING_OUTCOMES.MIXED].includes(outcome);
  const hasStillbornCalves = [CALVING_OUTCOMES.STILLBIRTH, CALVING_OUTCOMES.MIXED].includes(outcome);
  const normalizedCalves = hasLivingCalves ? normalizeLivingCalves(calves) : [];
  // Legacy stillbirth clients submitted details as `calves`; the explicit
  // contract uses `nonLivingCalves` and `calves` only for living offspring.
  const submittedLossCalves = nonLivingCalves ?? (outcome === CALVING_OUTCOMES.STILLBIRTH ? calves : []);
  const normalizedLossCalves = hasStillbornCalves
    ? normalizeLossCalves(submittedLossCalves, outcome)
    : [];
  const submittedCount = Number(numberOfCalves);
  const livingCalfCount = normalizedCalves.length;
  const stillbornCount = normalizedLossCalves.length;
  const requiredCount = livingCalfCount + stillbornCount;
  if (!Number.isInteger(submittedCount) || submittedCount !== requiredCount) {
    throw new AppError("The number of calves does not match the submitted records.", {
      status: 400,
      code: "CALF_COUNT_MISMATCH",
    });
  }

  const calvingDate = date ? new Date(date) : new Date();
  if (Number.isNaN(calvingDate.getTime())) {
    throw new AppError("Invalid calving date.", { status: 400, code: "CALVING_DATE_INVALID" });
  }
  if (calvingDate.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new AppError("Calving date cannot be in the future.", {
      status: 400,
      code: "CALVING_DATE_IN_FUTURE",
    });
  }

  // Read-only preflight prevents expensive uploads for already-invalid requests.
  const preflight = await loadAndValidateContext({
    motherId: mother?._id,
    pregnancyId: pregnancy?._id,
    taskId,
    actor,
    calvingDate,
    outcome,
  });
  if (preflight.existingCalving) {
    let reconciliationSession;
    try {
      reconciliationSession = await mongoose.startSession();
      let existingResult;
      await reconciliationSession.withTransaction(async () => {
        const context = await loadAndValidateContext({
          motherId: mother?._id,
          pregnancyId: pregnancy?._id,
          taskId,
          actor,
          calvingDate,
          outcome,
          session: reconciliationSession,
        });
        if (!context.existingCalving) {
          throw new AppError("The existing calving record could not be reconciled.", {
            status: 409,
            code: "CALVING_RECONCILIATION_CONFLICT",
          });
        }
        await completeCalvingTask({
          task: context.task,
          calving: context.existingCalving,
          actor,
          session: reconciliationSession,
        });
        const offspring = (context.existingCalving.calves || [])
          .map((calf) => calf.animalId)
          .filter((calf) => calf && typeof calf === "object" && calf._id);
        existingResult = {
          calving: context.existingCalving,
          offspring,
          outcome: context.existingCalving.outcome,
          alreadyRecorded: true,
        };
      });
      return existingResult;
    } finally {
      if (reconciliationSession) await reconciliationSession.endSession();
    }
  }
  const imageUploads = hasLivingCalves ? await uploadCalfImages(normalizedCalves) : [];
  let session;
  let result;

  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const { currentMother, currentPregnancy, insemination, task, existingCalving } = await loadAndValidateContext({
        motherId: mother?._id,
        pregnancyId: pregnancy?._id,
        taskId,
        actor,
        calvingDate,
        outcome,
        session,
      });
      if (existingCalving) {
        await completeCalvingTask({ task, calving: existingCalving, actor, session });
        result = {
          calving: existingCalving,
          offspring: (existingCalving.calves || [])
            .map((calf) => calf.animalId)
            .filter((calf) => calf && typeof calf === "object" && calf._id),
          outcome: existingCalving.outcome,
          alreadyRecorded: true,
        };
        return;
      }

      if (hasLivingCalves) {
        const normalizedTags = normalizedCalves.map((calf) => calf.earTag.toLowerCase());
        const existingCalf = await Animal.findOne({
          farmerId: currentMother.farmerId,
          $or: [
            { normalizedEarTag: { $in: normalizedTags } },
            { earTag: { $in: normalizedTags.map((tag) => new RegExp(`^\\s*${escapeRegex(tag)}\\s*$`, "i")) } },
          ],
          deletedAt: null,
        }).session(session).select("earTag");
        if (existingCalf) {
          throw new AppError(`Ear tag ${existingCalf.earTag} is already in use.`, {
            status: 409,
            code: "CALF_EAR_TAG_IN_USE",
          });
        }
      }

      const sireBreed = insemination.sireBreed || "Unknown";
      const calfDocuments = normalizedCalves.map((calf, index) => ({
        earTag: calf.earTag,
        animalId: `ANM-${crypto.randomUUID().slice(0, 12).toUpperCase()}`,
        species: currentMother.species,
        breed: sireBreed !== "Unknown" ? `${currentMother.breed} x ${sireBreed}` : currentMother.breed,
        farmerId: currentMother.farmerId,
        motherId: currentMother._id,
        imageUrl: imageUploads[index]?.url || "",
        isVerified: actor.role !== "farmer",
        gender: calf.sex === "M" ? "Male" : "Female",
        color: calf.color || currentMother.color || "Not Provided",
        brand: calf.brand || currentMother.brand || "",
        birthDate: calvingDate,
        barangay: currentMother.barangay || "Not Provided",
        activityLogs: [{
          event: "Initial Registration",
          date: calvingDate,
          description: `Registered through the calving record of mother ${currentMother.earTag || currentMother.animalId}.`,
        }],
      }));
      const offspring = calfDocuments.length
        ? await Animal.insertMany(calfDocuments, { session })
        : [];
      const calfRecords = offspring.map((calf, index) => ({
        sex: normalizedCalves[index].sex,
        earTag: calf.earTag,
        animalId: calf._id,
      }));

      const [calving] = await Calving.create([{
        animalId: currentMother._id,
        farmerId: currentMother.farmerId,
        pregnancyId: currentPregnancy._id,
        inseminationId: insemination._id,
        date: calvingDate,
        numberOfCalves: requiredCount,
        totalDelivered: requiredCount,
        calves: calfRecords,
        nonLivingCalves: normalizedLossCalves,
        livingCalfCount,
        stillbornCount,
        outcome,
        calvingEase,
        technicianId: actor.role === "farmer" ? undefined : actor._id,
        technicianNote,
      }], { session });

      const eventDescription = outcome === "live_birth"
        ? `Gave birth to ${offspring.length} living calf/calves. Ease: ${calvingEase}.`
        : outcome === "mixed"
          ? `Delivered ${livingCalfCount} living and ${stillbornCount} stillborn calf/calves. Ease: ${calvingEase}.`
        : outcome === "stillbirth"
          ? `Stillbirth recorded for ${requiredCount} calf/calves.`
          : "Pregnancy loss recorded as abortion.";
      const motherUpdate = {
        $set: outcome === "abortion"
          ? { reproductiveStatus: "Post-partum", lastPregnancyLossDate: calvingDate }
          : { reproductiveStatus: "Post-partum", lastCalvingDate: calvingDate },
        $unset: { expectedCalvingDate: 1 },
        $push: { activityLogs: { event: "Calving", date: calvingDate, description: eventDescription } },
      };
      if (outcome !== "abortion") motherUpdate.$inc = { parity: 1 };
      await Animal.findByIdAndUpdate(currentMother._id, motherUpdate, { session });

      const cycleStatus = outcome === "abortion" ? "lost" : "completed";
      await Pregnancy.updateOne(
        { _id: currentPregnancy._id },
        { $set: { cycleStatus, completedAt: new Date() } },
        { session },
      );
      await Insemination.updateOne(
        { _id: insemination._id },
        { $set: { breedingCycleStatus: cycleStatus, breedingCycleCompletedAt: new Date() } },
        { session },
      );

      await completeCalvingTask({ task, calving, actor, session });

      const timelineEntries = [{
        animalId: currentMother._id,
        eventType: outcome === "abortion" ? "pregnancy_loss_recorded" : "calving_recorded",
        occurredAt: calvingDate,
        actorId: actor._id,
        sourceType: "Calving",
        sourceId: calving._id,
        title: outcome === "abortion" ? "Pregnancy loss recorded" : "Calving recorded",
        summary: eventDescription,
        metadata: { outcome, pregnancyId: currentPregnancy._id, inseminationId: insemination._id, numberOfCalves: requiredCount, livingCalfCount, stillbornCount },
      }, ...offspring.map((calf) => ({
        animalId: calf._id,
        eventType: "offspring_registered",
        occurredAt: calvingDate,
        actorId: actor._id,
        sourceType: "Calving",
        sourceId: calving._id,
        title: "Birth and registration",
        summary: `Born to mother ${currentMother.earTag || currentMother.animalId}.`,
        metadata: { motherId: currentMother._id, pregnancyId: currentPregnancy._id },
      }))];
      await AnimalTimelineEvent.insertMany(timelineEntries, { session });

      await AuditLog.create([{
        entityType: "Calving",
        entityId: calving._id,
        action: "create_calving_record",
        actorId: actor._id,
        after: { outcome, calvingEase, date: calvingDate, numberOfCalves: requiredCount, livingCalfCount, stillbornCount },
        metadata: {
          pregnancyId: currentPregnancy._id,
          inseminationId: insemination._id,
          motherId: currentMother._id,
          calfIds: offspring.map((calf) => calf._id),
          outcome,
          actorRole: actor.role,
        },
      }], { session });

      if (actor.role !== "farmer" && currentMother.farmerId) {
        const notification = outcome === "live_birth" || outcome === "mixed"
          ? {
              title: "Calving recorded",
              message: `Animal Tag #${currentMother.earTag || currentMother.animalId} delivered ${livingCalfCount} living calf/calves${stillbornCount ? ` and ${stillbornCount} stillborn` : ""}.`,
            }
          : outcome === "stillbirth"
            ? {
                title: "Stillbirth recorded",
                message: `A stillbirth was recorded for Animal Tag #${currentMother.earTag || currentMother.animalId}. The breeding history has been preserved.`,
              }
            : {
                title: "Pregnancy loss recorded",
                message: `An abortion was recorded for Animal Tag #${currentMother.earTag || currentMother.animalId}. The breeding history has been preserved.`,
              };
        await Notification.create([{
          recipientId: currentMother.farmerId,
          senderId: actor._id,
          type: "system",
          category: "calving",
          eventType: outcome === "abortion" ? "pregnancy_loss" : "calving_recorded",
          relatedId: calving._id,
          linkType: "record",
          metadata: {
            animalId: currentMother._id,
            animalTag: currentMother.earTag || currentMother.animalId,
            recordId: calving._id,
            outcomeSummary: notification.message,
          },
          ...notification,
        }], { session });
      }

      result = { calving, offspring, outcome, alreadyRecorded: false };
    });
    if (result?.alreadyRecorded) await cleanupUploadedImages(imageUploads);
  } catch (error) {
    await cleanupUploadedImages(imageUploads);
    throw normalizeDatabaseError(error);
  } finally {
    if (session) await session.endSession();
  }
  return result;
};
