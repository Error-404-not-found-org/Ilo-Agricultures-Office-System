/**
 * Development-only reproduction + H4 service lifecycle scenario seeder.
 *
 * Dry run (default):
 *   npm run seed:reproduction-lifecycle -- --farmerEmail=user@example.com --technicianEmail=tech@example.com
 * Execute:
 *   npm run seed:reproduction-lifecycle -- --farmerEmail=user@example.com --technicianEmail=tech@example.com --execute
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

import { ENV } from "../src/config/env.js";
import { configureCustomDns } from "../src/config/custom-dns.js";

import { User } from "../src/models/user.model.js";
import { Animal } from "../src/models/animal.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Calving } from "../src/models/calving.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { MedicalRecord } from "../src/models/medical-record.model.js";
import { Task } from "../src/models/task.model.js";
import { Notification } from "../src/models/notification.model.js";
import { AnimalTimelineEvent } from "../src/models/animal-timeline-event.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";

import {
  calculateTargetCalvingDate,
  getBreedProfile,
} from "../src/utils/cattleCore.js";

import { resolveReproductionNextAction } from "../src/domain/reproduction-next-action.js";

import {
  ACTIVE_AI_REQUEST_STATUSES,
  ACTIVE_HEALTH_REQUEST_STATUSES,
  HEALTH_STATUS,
} from "../src/domain/status-vocabulary.js";

import { normalizeVisitScheduleDate } from "../src/domain/visit-scheduling.js";

export const SEED_PREFIX = "RC26-";

export const SCENARIO_NAMES = Object.freeze([
  "RC26-01-AVAILABLE",
  "RC26-02-AI-PENDING",
  "RC26-03-AI-SCHEDULED",
  "RC26-04-AI-DAY10",
  "RC26-05-AI-DAY21",
  "RC26-06-LIKELY-PREGNANT",
  "RC26-07-PD-DUE",
  "RC26-08-PREGNANT",
  "RC26-09-CALVING-DUE",
  "RC26-10-CALVING-OVERDUE",
  "RC26-11-POSTPARTUM",
  "RC26-12-STILLBIRTH",
  "RC26-13-ABORTION",
  "RC26-14-MIXED",
  "RC26-15-REHEAT",
  "RC26-16-ATTEMPT-2",

  // H4 request / scheduling / records scenarios
  "RC26-17-AI-IN-PROGRESS",
  "RC26-18-HEALTH-PENDING",
  "RC26-19-HEALTH-SCHEDULED",
  "RC26-20-HEALTH-IN-PROGRESS",
  "RC26-21-HEALTH-RESOLVED",
  "RC26-22-HEALTH-WALK-IN",
]);

const DAY_MS = 86_400_000;

const SPECIES = "Beef Cattle";
const BREED = "Angus";
const SEEDED_CATTLE_IMAGE_URLS = Object.freeze([
  "https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1527153857715-3908f2bae5e8?auto=format&fit=crop&w=1200&q=80",
]);

const MODELS = {
  Animal,
  Insemination,
  Pregnancy,
  Calving,
  HealthRequest,
  MedicalRecord,
  Task,
  Notification,
  AnimalTimelineEvent,
  AuditLog,
};

const REQUIRED_SCHEMA_PATHS = {
  Animal: ["farmerId", "animalId", "earTag", "reproductiveStatus", "motherId"],

  Insemination: [
    "farmerId",
    "animalId",
    "status",
    "attemptNumber",
    "attemptSeriesId",
    "previousAttemptId",
  ],

  Pregnancy: [
    "animalId",
    "farmerId",
    "inseminationId",
    "pregnancyDiagnosis.date",
    "pregnancyDiagnosis.result",
    "cycleStatus",
  ],

  Calving: [
    "animalId",
    "pregnancyId",
    "inseminationId",
    "outcome",
    "livingCalfCount",
    "stillbornCount",
  ],

  HealthRequest: [
    "farmerId",
    "animalId",
    "requestType",
    "symptoms",
    "status",
    "scheduledDate",
    "visitPeriod",
  ],

  MedicalRecord: [
    "animalId",
    "farmerId",
    "technicianId",
    "healthRequestId",
    "type",
    "details.diagnosis",
    "details.treatment",
  ],

  Task: ["farmerId", "animalIds", "taskType", "sourceType", "metadata"],

  Notification: ["recipientId", "senderId", "relatedId", "title", "message"],

  AnimalTimelineEvent: ["animalId", "sourceType", "sourceId", "metadata"],

  AuditLog: ["entityType", "entityId", "action", "metadata"],
};

const addDays = (date, days) =>
  new Date(new Date(date).getTime() + days * DAY_MS);

/**
 * Creates the canonical BreedSmart visit date anchor.
 *
 * IMPORTANT:
 * scheduledDate stores the Philippine calendar day.
 * Its time component is NOT an appointment time.
 *
 * visitPeriod remains the actual user-facing schedule:
 * morning | afternoon
 */
const visitDate = (now, days = 0) =>
  normalizeVisitScheduleDate(addDays(now, days), {
    // normalizeVisitScheduleDate normally rejects past visits.
    // Historical seed scenarios need old visit dates, so provide a synthetic
    // earlier "now" only for validating the seed date.
    now: days < 0 ? addDays(now, days - 1) : now,
  });

const id = () => new mongoose.Types.ObjectId();

const idString = (value) => String(value?._id || value || "");

const iso = (value) => (value ? new Date(value).toISOString() : "");

const normalizedEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const knownTransactionError = (error) =>
  /Transaction numbers are only allowed|replica set|mongos/i.test(
    error?.message || "",
  );

export const parseSeedArgs = (argv = process.argv.slice(2)) => {
  const value = (name) =>
    argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

  return {
    farmerEmail: normalizedEmail(value("farmerEmail")),
    technicianEmail: normalizedEmail(value("technicianEmail")),
    seedBatch: value("seedBatch") || "",
    execute: argv.includes("--execute"),
  };
};

export const assertDevelopmentEnvironment = (
  environment = process.env.NODE_ENV || "development",
) => {
  if (String(environment).toLowerCase() === "production") {
    throw new Error("Refusing to seed when NODE_ENV=production.");
  }
};

export const hasRequiredSchemaPath = (
  schema,
  schemaPath,
  { allowNestedContainer = false } = {},
) => {
  if (!schema || typeof schema.path !== "function") {
    return false;
  }

  const resolvedPath = schema.path(schemaPath);

  const pathType =
    typeof schema.pathType === "function" ? schema.pathType(schemaPath) : null;

  const isDirectPath =
    Boolean(resolvedPath) && (!pathType || pathType === "real");

  if (isDirectPath) {
    return true;
  }

  return allowNestedContainer && Boolean(schema.nested?.[schemaPath]);
};

export const assertRequiredSchemaPath = (
  modelName,
  schema,
  schemaPath,
  options,
) => {
  if (!hasRequiredSchemaPath(schema, schemaPath, options)) {
    throw new Error(
      `Required schema path is missing: ${modelName}.${schemaPath}`,
    );
  }
};

export const assertRequiredSchemas = (models = MODELS) => {
  for (const [name, paths] of Object.entries(REQUIRED_SCHEMA_PATHS)) {
    const model = models[name];

    if (!model?.schema) {
      throw new Error(`Required model is unavailable: ${name}`);
    }

    for (const schemaPath of paths) {
      assertRequiredSchemaPath(name, model.schema, schemaPath);
    }
  }
};

export const resolveSeedUsers = async ({
  UserModel = User,
  farmerEmail,
  technicianEmail,
}) => {
  if (!farmerEmail || !technicianEmail) {
    throw new Error("Both --farmerEmail and --technicianEmail are required.");
  }

  const [farmer, technician] = await Promise.all([
    UserModel.findOne({
      email: farmerEmail,
      role: "farmer",
      deletedAt: null,
    }),

    UserModel.findOne({
      email: technicianEmail,
      role: "technician",
      deletedAt: null,
    }),
  ]);

  if (!farmer) {
    throw new Error(`Existing farmer account not found: ${farmerEmail}`);
  }

  if (!technician) {
    throw new Error(
      `Existing technician account not found: ${technicianEmail}`,
    );
  }

  return {
    farmer,
    technician,
  };
};

export const createSeedBatch = (now = new Date()) =>
  `repro-${now
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14)}-${crypto.randomBytes(3).toString("hex")}`;

const makeScenarioTag = (batchSuffix, index, label) =>
  `${SEED_PREFIX}${batchSuffix}-${String(index).padStart(2, "0")}-${label}`;

const seededCattleImageUrl = (earTag) => {
  const key = String(earTag || "");
  const index = [...key].reduce((total, character) => total + character.charCodeAt(0), 0);
  return SEEDED_CATTLE_IMAGE_URLS[index % SEEDED_CATTLE_IMAGE_URLS.length];
};

const baseAnimal = ({
  _id,
  farmerId,
  earTag,
  status,
  now,
  seedBatch,
  extra = {},
}) => ({
  _id,

  farmerId,

  animalId: `SEED-${seedBatch}-${earTag}`,

  earTag,

  normalizedEarTag: earTag.trim().toLowerCase(),

  species: SPECIES,
  breed: BREED,
  color: "Black",
  gender: "Female",
  imageUrl: seededCattleImageUrl(earTag),

  reproductiveStatus: status,

  birthDate: addDays(now, -4 * 365),

  parity: 0,

  barangay: "Seed Lifecycle QA",

  isVerified: true,

  activityLogs: [
    {
      event: "Seed Scenario Created",
      date: now,
      description: `Development seed batch ${seedBatch}.`,
    },
  ],

  deletedAt: null,

  ...extra,
});

const baseInsemination = ({
  _id,
  farmerId,
  animalId,
  technicianId,
  aiDate,
  status = "done",
  seedBatch,
  visitPeriod = "morning",
  extra = {},
}) => ({
  _id,

  farmerId,
  animalId,

  technicianId,
  approvedBy: technicianId,

  inseminationDate: aiDate,

  preferredDate: aiDate,

  visitPeriod,

  scheduledDate: ACTIVE_AI_REQUEST_STATUSES.includes(status)
    ? aiDate
    : undefined,

  estrus: "Natural",

  sireBreed: "Angus",

  sireCode: `SEED-SIRE-${seedBatch}`,

  status,

  attemptNumber: 1,

  attemptSeriesId: id(),

  outcome: "Pending",

  breedingCycleStatus: "active",

  outcomeVerificationStatus: "pending",

  technicianNote: `Development lifecycle seed ${seedBatch}.`,

  statusHistory: [
    {
      status,
      note: `Seeded by ${seedBatch}.`,
      actorId: technicianId,
      createdAt: aiDate,
    },
  ],

  deletedAt: null,

  ...(ACTIVE_AI_REQUEST_STATUSES.includes(status)
    ? {
        activeRequestKey: String(animalId),
      }
    : {}),

  ...extra,
});

const baseHealthRequest = ({
  _id,
  farmerId,
  animalId,
  technicianId,

  status = HEALTH_STATUS.PENDING,

  requestType = "disease",

  symptoms = "Reduced appetite and low energy.",

  urgency = "medium",

  scheduledDate,
  visitPeriod,
  serviceStartedAt,

  seedBatch,

  extra = {},
}) => ({
  _id,

  farmerId,
  animalId,

  requestType,

  symptoms,

  urgency,

  farmerNotes: `Development H4 health request seed ${seedBatch}.`,

  photos: ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],

  status,

  ...(ACTIVE_HEALTH_REQUEST_STATUSES.includes(status)
    ? {
        activeCaseKey: `${animalId}:${requestType}`,
      }
    : {}),

  ...(technicianId
    ? {
        handledBy: technicianId,

        assignedTechnicianId: technicianId,

        claimedAt: addDays(scheduledDate || serviceStartedAt || new Date(), -1),
      }
    : {}),

  scheduledDate,

  visitPeriod,

  serviceStartedAt,

  technicianNote: technicianId ? `Assigned during H4 seed ${seedBatch}.` : "",

  statusHistory: [
    {
      status,

      note: `Seeded by ${seedBatch}.`,

      actorId: technicianId || farmerId,

      createdAt: serviceStartedAt || scheduledDate || new Date(),
    },
  ],

  deletedAt: null,

  ...extra,
});

const baseMedicalRecord = ({
  _id,
  farmerId,
  animalId,
  technicianId,
  healthRequestId,
  date,
  seedBatch,
  type = "Treatment",
  extra = {},
}) => ({
  _id,

  farmerId,
  animalId,
  technicianId,

  healthRequestId,

  type,

  date,

  details: {
    medicineName: "Oxytetracycline",

    dosage: "10 mL",

    diagnosis: "Bacterial respiratory infection",

    treatment: "Antibiotic treatment and supportive care",

    withdrawalPeriodDays: 7,

    withdrawalEndDate: addDays(date, 7),
  },

  note: `Keep the animal hydrated and monitor appetite. H4 seed ${seedBatch}.`,

  followUpDate: addDays(date, 4),

  isHistoricalEntry: false,

  entrySource: "technician_entry",

  ...extra,
});

const baseTask = ({
  _id,
  farmerId,
  technicianId,
  animalId,
  type,
  dueDate,
  sourceType,

  relatedRecordType = null,
  relatedRecordId = null,

  status = "Pending",

  completedAt = null,

  inseminationId,

  seedBatch,

  notes,

  visitPeriod = "morning",

  metadata = {},
}) => ({
  _id,

  farmerId,

  technicianId,

  animalIds: [animalId],

  taskType: type,

  category: "Follow-up",

  priority: 2,

  notes: notes || `${type} lifecycle seed task (${seedBatch}).`,

  status,

  dueDate,

  sourceType,

  relatedRecordType,

  relatedRecordId,

  completedAt,

  metadata: {
    seedBatch,
    visitPeriod,

    ...(inseminationId
      ? {
          inseminationId,
        }
      : {}),

    ...metadata,
  },
});

const confirmedPregnancy = ({
  _id,
  animalId,
  farmerId,
  inseminationId,
  aiDate,
  diagnosisDate,

  cycleStatus = "active",

  completedAt = null,
}) => ({
  _id,

  animalId,

  farmerId,

  inseminationId,

  pregnancyDiagnosis: {
    date: diagnosisDate,
    result: "Pregnant",
  },

  targetCalvingDate: calculateTargetCalvingDate(
    aiDate,
    SPECIES,
    undefined,
    BREED,
  ),

  technicianNote:
    "Technician-confirmed pregnancy for development lifecycle testing.",

  cycleStatus,

  completedAt,

  deletedAt: null,
});

export const buildReproductionLifecyclePlan = ({
  farmer,
  technician,
  now = new Date(),
  seedBatch = createSeedBatch(now),
}) => {
  if (!farmer?._id || !technician?._id) {
    throw new Error("Existing farmer and technician records are required.");
  }

  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(seedBatch)) {
    throw new Error("seedBatch must be 8-80 safe characters.");
  }

  const farmerId = farmer._id;

  const technicianId = technician._id;

  const suffix = seedBatch
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-6)
    .toUpperCase();

  const collections = {
    animals: [],

    inseminations: [],

    pregnancies: [],

    calvings: [],

    healthRequests: [],

    medicalRecords: [],

    tasks: [],

    notifications: [],

    timelines: [],

    audits: [],
  };

  const scenarios = [];

  const start = (index, label, status = "Normal", extra = {}) => {
    const scenario = SCENARIO_NAMES[index - 1];

    const motherId = id();

    const earTag = makeScenarioTag(suffix, index, label);

    const animal = baseAnimal({
      _id: motherId,
      farmerId,
      earTag,
      status,
      now,
      seedBatch,
      extra,
    });

    collections.animals.push(animal);

    const item = {
      index,
      scenario,
      motherId,
      earTag,
      animal,

      inseminations: [],

      pregnancies: [],

      calvings: [],

      healthRequests: [],

      medicalRecords: [],

      tasks: [],

      offspring: [],

      expectedResult: "",
    };

    scenarios.push(item);

    return item;
  };

  const addInsemination = (scenario, data) => {
    const record = baseInsemination({
      _id: id(),

      farmerId,

      animalId: scenario.motherId,

      technicianId,

      seedBatch,

      ...data,
    });

    collections.inseminations.push(record);

    scenario.inseminations.push(record);

    return record;
  };

  const addHealthRequest = (scenario, data = {}) => {
    const record = baseHealthRequest({
      _id: id(),

      farmerId,

      animalId: scenario.motherId,

      technicianId: data.technicianId,

      seedBatch,

      ...data,
    });

    collections.healthRequests.push(record);

    scenario.healthRequests.push(record);

    return record;
  };

  const addMedicalRecord = (scenario, data = {}) => {
    const record = baseMedicalRecord({
      _id: id(),

      farmerId,

      animalId: scenario.motherId,

      technicianId,

      seedBatch,

      ...data,
    });

    collections.medicalRecords.push(record);

    scenario.medicalRecords.push(record);

    return record;
  };

  const addTask = (scenario, data) => {
    const record = baseTask({
      _id: id(),

      farmerId,

      technicianId,

      animalId: scenario.motherId,

      seedBatch,

      ...data,
    });

    collections.tasks.push(record);

    scenario.tasks.push(record);

    return record;
  };

  const addObservationNotification = (
    scenario,
    { insemination, task = null, reportType, message },
  ) => {
    const notification = {
      _id: id(),

      recipientId: technicianId,

      senderId: farmerId,

      type: "ai-request",

      category: "observation",

      eventType: "technician_review_required",

      relatedId: insemination._id,

      linkType: "request",

      dedupeKey: `seed-breeding-observation:${technicianId}:${insemination._id}`,

      title: `Breeding observation: ${scenario.earTag}`,

      message,

      isRead: false,

      metadata: {
        seedBatch,

        animalId: scenario.motherId,

        animalTag: scenario.earTag,

        observationId: insemination._id,

        requestId: insemination._id,

        taskId: task?._id || null,

        reportType,

        deepLinkTarget: task?._id
          ? "/(technician)/task-details"
          : "/(technician)/request-details",
      },
    };

    collections.notifications.push(notification);

    return notification;
  };

  const addPregnancy = (scenario, insemination, data) => {
    const record = confirmedPregnancy({
      _id: id(),

      animalId: scenario.motherId,

      farmerId,

      inseminationId: insemination._id,

      ...data,
    });

    collections.pregnancies.push(record);

    scenario.pregnancies.push(record);

    insemination.pregnancyId = record._id;

    return record;
  };

  const addHistoryArtifacts = (
    scenario,
    { calving, title, message, outcome },
  ) => {
    const timeline = {
      _id: id(),

      animalId: scenario.motherId,

      eventType:
        outcome === "abortion" ? "pregnancy_loss_recorded" : "calving_recorded",

      occurredAt: calving.date,

      actorId: technicianId,

      sourceType: "Calving",

      sourceId: calving._id,

      title,

      summary: message,

      metadata: {
        seedBatch,
        outcome,

        pregnancyId: calving.pregnancyId,

        inseminationId: calving.inseminationId,
      },
    };

    const audit = {
      _id: id(),

      entityType: "Calving",

      entityId: calving._id,

      action: "create_calving_record",

      actorId: technicianId,

      after: {
        outcome,

        numberOfCalves: calving.numberOfCalves,
      },

      metadata: {
        seedBatch,

        motherId: scenario.motherId,

        outcome,
      },
    };

    const notification = {
      _id: id(),

      recipientId: farmerId,

      senderId: technicianId,

      type: "system",

      relatedId: calving._id,

      linkType: "record",

      title,

      message,

      isRead: false,
    };

    collections.timelines.push(timeline);

    collections.audits.push(audit);

    collections.notifications.push(notification);
  };

  const addCompletedOutcome = (
    scenario,
    { outcome, daysAgo, living = 0, stillborn = 0, calvingEase = "Natural" },
  ) => {
    const eventDate = addDays(now, -daysAgo);

    const gestationDays = getBreedProfile(SPECIES, BREED).avgGestationDays;

    const aiDate =
      outcome === "abortion"
        ? addDays(eventDate, -120)
        : addDays(eventDate, -gestationDays);

    const diagnosisDate = addDays(aiDate, 60);

    const insemination = addInsemination(scenario, {
      aiDate,

      extra: {
        outcome: outcome === "abortion" ? "Failed (Aborted)" : "Pregnant",

        isSuccess: outcome !== "abortion",

        outcomeVerificationStatus: "verified",

        outcomeConfirmationSource: "technician_pregnancy_diagnosis",

        outcomeConfirmedBy: technicianId,

        outcomeConfirmedAt: diagnosisDate,

        failureReason: outcome === "abortion" ? "aborted" : null,

        breedingCycleStatus: outcome === "abortion" ? "lost" : "completed",

        breedingCycleCompletedAt: eventDate,
      },
    });

    const pregnancy = addPregnancy(scenario, insemination, {
      aiDate,

      diagnosisDate,

      cycleStatus: outcome === "abortion" ? "lost" : "completed",

      completedAt: eventDate,
    });

    const offspring = [];

    for (let index = 0; index < living; index += 1) {
      const offspringId = id();

      const earTag = `${scenario.earTag}-CALF-${index + 1}`;

      const calf = baseAnimal({
        _id: offspringId,

        farmerId,

        earTag,

        status: "Normal",

        now,

        seedBatch,

        extra: {
          animalId: `SEED-${seedBatch}-CALF-${scenario.index}-${index + 1}`,

          gender: index % 2 ? "Male" : "Female",

          birthDate: eventDate,

          motherId: scenario.motherId,
        },
      });

      collections.animals.push(calf);

      scenario.offspring.push(calf);

      offspring.push(calf);
    }

    const calving = {
      _id: id(),

      animalId: scenario.motherId,

      farmerId,

      pregnancyId: pregnancy._id,

      inseminationId: insemination._id,

      date: eventDate,

      numberOfCalves: living + stillborn,

      totalDelivered: living + stillborn,

      calves: offspring.map((calf, index) => ({
        sex: index % 2 ? "M" : "F",

        earTag: calf.earTag,

        animalId: calf._id,
      })),

      nonLivingCalves: Array.from(
        {
          length: stillborn,
        },

        (_, index) => ({
          sex: index % 2 ? "F" : "M",

          earTag: `${scenario.earTag}-LOSS-${index + 1}`,

          color: "Black",

          brand: "",
        }),
      ),

      livingCalfCount: living,

      stillbornCount: stillborn,

      outcome,

      calvingEase,

      technicianId,

      technicianNote: `Historical ${outcome} seed record ${seedBatch}.`,

      deletedAt: null,
    };

    collections.calvings.push(calving);

    scenario.calvings.push(calving);

    addTask(scenario, {
      type: "Calving",

      dueDate: eventDate,

      sourceType: "task_scheduler",

      status: "Completed",

      completedAt: eventDate,

      relatedRecordType: "calving",

      relatedRecordId: calving._id,

      inseminationId: insemination._id,
    });

    scenario.animal.reproductiveStatus = "Post-partum";

    scenario.animal.lastInseminationDate = aiDate;

    delete scenario.animal.expectedCalvingDate;

    if (outcome === "abortion") {
      scenario.animal.lastPregnancyLossDate = eventDate;
    } else {
      scenario.animal.lastCalvingDate = eventDate;

      scenario.animal.parity = 1;
    }

    scenario.animal.activityLogs.push({
      event: outcome === "abortion" ? "Pregnancy Loss" : "Calving",

      date: eventDate,

      description: `Seeded ${outcome} outcome.`,
    });

    const title =
      outcome === "live_birth"
        ? "Live Birth recorded"
        : outcome === "mixed"
          ? "Mixed delivery recorded"
          : outcome === "stillbirth"
            ? "Stillbirth recorded"
            : "Abortion recorded";

    const message =
      outcome === "abortion"
        ? `Pregnancy loss recorded for ${scenario.earTag}; no living offspring were created.`
        : outcome === "stillbirth"
          ? `Stillbirth recorded for ${scenario.earTag}; no living offspring were created.`
          : `${title} for ${scenario.earTag}: ${living} living and ${stillborn} stillborn.`;

    addHistoryArtifacts(scenario, {
      calving,
      title,
      message,
      outcome,
    });

    return {
      insemination,
      pregnancy,
      calving,
    };
  };

  // ============================================================
  // RC26-01 — AVAILABLE
  // ============================================================

  start(1, "AVAILABLE").expectedResult = "AI request available";

  // ============================================================
  // RC26-02 — AI PENDING
  // ============================================================

  const s2 = start(2, "AI-PENDING");

  addInsemination(s2, {
    aiDate: undefined,

    status: "pending",

    extra: {
      inseminationDate: undefined,

      scheduledDate: undefined,

      preferredDate: addDays(now, 3),
    },
  });

  s2.expectedResult = "Duplicate active AI request rejected";

  // ============================================================
  // RC26-03 — AI SCHEDULED
  // ============================================================

  const s3 = start(3, "AI-SCHEDULED");

  const s3ai = addInsemination(s3, {
    aiDate: undefined,

    status: "scheduled",

    extra: {
      inseminationDate: undefined,

      scheduledDate: visitDate(now, 3),

      visitPeriod: "morning",

      preferredDate: addDays(now, 3),

      claimedAt: now,

      scheduledAt: now,
    },
  });

  addTask(s3, {
    type: "AI",

    dueDate: s3ai.scheduledDate,

    sourceType: "task_scheduler",

    relatedRecordType: "insemination",

    relatedRecordId: s3ai._id,

    inseminationId: s3ai._id,
  });

  s3.expectedResult = "Attend scheduled AI visit";

  // ============================================================
  // Helpers for reproductive monitoring scenarios
  // ============================================================

  const monitoring = (index, label, daysAgo) => {
    const aiDate = addDays(now, -daysAgo);

    const scenario = start(index, label, "Inseminated", {
      lastInseminationDate: aiDate,
    });

    const insemination = addInsemination(scenario, {
      aiDate,
    });

    addTask(scenario, {
      type: "PD",

      dueDate: addDays(aiDate, 60),

      sourceType: "automatic_pd_followup",

      relatedRecordType: "insemination",

      relatedRecordId: insemination._id,

      inseminationId: insemination._id,
    });

    return {
      scenario,
      insemination,
      aiDate,
    };
  };

  // ============================================================
  // RC26-04 — AI DAY 10 / UNSURE OBSERVATION
  // ============================================================

  const s4data = monitoring(4, "AI-DAY10", 10);

  Object.assign(s4data.insemination, {
    farmerOutcomeReport: "unsure",

    farmerOutcomeReportedAt: now,

    farmerObservationSigns: [],

    farmerObservationNotes: "",

    evidencePhotos: [],

    verificationRequested: false,

    verificationStatus: "not_requested",

    outcomeVerificationStatus: "reported",
  });

  addObservationNotification(s4data.scenario, {
    insemination: s4data.insemination,

    reportType: "unsure",

    message: `The farmer is unsure of the breeding outcome for ${s4data.scenario.earTag}. Review the observation and advise continued monitoring.`,
  });

  s4data.scenario.expectedResult =
    "Unsure farmer observation; monitoring continues without a requested review task";

  // ============================================================
  // RC26-05 — RETURN TO HEAT
  // ============================================================

  const s5data = monitoring(5, "AI-DAY21", 21);

  s5data.scenario.animal.reproductiveStatus = "In Heat";

  Object.assign(s5data.insemination, {
    farmerOutcomeReport: "return_to_heat",

    farmerOutcomeReportedAt: now,

    farmerObservationSigns: ["standing_heat", "restlessness"],

    farmerObservationNotes:
      "The animal is standing to be mounted and appears restless.",

    evidencePhotos: [],

    verificationRequested: true,

    verificationStatus: "pending",

    outcomeVerificationStatus: "reported",

    outcomeConfirmationSource: "farmer_return_to_heat",
  });

  const s5task = s5data.scenario.tasks[0];

  Object.assign(s5task, {
    technicianId: undefined,

    sourceType: "farmer_requested_verification",

    priority: 1,

    notes: `Farmer reported a return to heat for ${s5data.scenario.earTag}. Technician review is required before the AI attempt can be marked unsuccessful.`,

    metadata: {
      ...s5task.metadata,

      reportType: "return_to_heat",
    },
  });

  s5data.insemination.verificationTaskId = s5task._id;

  addObservationNotification(s5data.scenario, {
    insemination: s5data.insemination,

    task: s5task,

    reportType: "return_to_heat",

    message: `The farmer reported a return to heat for ${s5data.scenario.earTag}. Review the signs before recording the reproductive outcome.`,
  });

  s5data.scenario.expectedResult =
    "Provisional return-to-heat report; unassigned technician review task available";

  // ============================================================
  // RC26-06 — LIKELY PREGNANT
  // ============================================================

  const s6data = monitoring(6, "LIKELY-PREGNANT", 40);

  s6data.scenario.animal.reproductiveStatus = "Likely Pregnant";

  Object.assign(s6data.insemination, {
    farmerOutcomeReport: "possible_pregnancy",

    farmerOutcomeReportedAt: now,

    farmerObservationSigns: ["no_return_to_heat", "body_condition_change"],

    farmerObservationNotes:
      "No return to heat observed; appetite and body condition remain stable.",

    evidencePhotos: ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],

    verificationRequested: true,

    verificationStatus: "pending",

    outcomeVerificationStatus: "reported",

    outcomeConfirmationSource: "farmer_possible_pregnancy",

    outcomeConfirmedBy: farmerId,

    outcomeConfirmedAt: now,
  });

  const s6task = s6data.scenario.tasks[0];

  Object.assign(s6task, {
    sourceType: "farmer_requested_verification",

    notes: `Farmer-requested pregnancy verification (${seedBatch}).`,

    metadata: {
      ...s6task.metadata,

      reportType: "possible_pregnancy",
    },
  });

  s6data.insemination.verificationTaskId = s6task._id;

  addObservationNotification(s6data.scenario, {
    insemination: s6data.insemination,

    task: s6task,

    reportType: "possible_pregnancy",

    message: `The farmer reported possible pregnancy signs for ${s6data.scenario.earTag}. Review the observation and complete the assigned pregnancy check when eligible.`,
  });

  s6data.scenario.expectedResult =
    "Technician verification required; PD locked before Day 60";

  // ============================================================
  // RC26-07 — PD DUE
  // ============================================================

  const s7data = monitoring(7, "PD-DUE", 60);

  s7data.scenario.expectedResult = "Perform pregnancy diagnosis";

  // ============================================================
  // Pregnant helper
  // ============================================================

  const pregnantScenario = (index, label, daysAgo, taskOffset = null) => {
    const aiDate = addDays(now, -daysAgo);

    const diagnosisDate = addDays(aiDate, 60);

    const scenario = start(index, label, "Pregnant", {
      lastInseminationDate: aiDate,
    });

    const insemination = addInsemination(scenario, {
      aiDate,

      extra: {
        outcome: "Pregnant",

        isSuccess: true,

        outcomeVerificationStatus: "verified",

        outcomeConfirmationSource: "technician_pregnancy_diagnosis",

        outcomeConfirmedBy: technicianId,

        outcomeConfirmedAt: diagnosisDate,
      },
    });

    const pregnancy = addPregnancy(scenario, insemination, {
      aiDate,
      diagnosisDate,
    });

    scenario.animal.expectedCalvingDate = pregnancy.targetCalvingDate;

    addTask(scenario, {
      type: "PD",

      dueDate: diagnosisDate,

      sourceType: "automatic_pd_followup",

      status: "Completed",

      completedAt: diagnosisDate,

      relatedRecordType: "pregnancy",

      relatedRecordId: pregnancy._id,

      inseminationId: insemination._id,
    });

    if (taskOffset !== null) {
      addTask(scenario, {
        type: "Calving",

        dueDate: addDays(now, taskOffset),

        sourceType: "task_scheduler",

        relatedRecordType: "pregnancy",

        relatedRecordId: pregnancy._id,

        inseminationId: insemination._id,
      });
    }

    return {
      scenario,
      insemination,
      pregnancy,
    };
  };

  pregnantScenario(8, "PREGNANT", 150).scenario.expectedResult =
    "Prepare for expected calving";

  pregnantScenario(
    9,
    "CALVING-DUE",
    getBreedProfile(SPECIES, BREED).avgGestationDays,
    0,
  ).scenario.expectedResult = "Calving follow-up due today";

  pregnantScenario(
    10,
    "CALVING-OVERDUE",
    getBreedProfile(SPECIES, BREED).avgGestationDays + 5,
    -5,
  ).scenario.expectedResult = "Five days overdue; ready for twin or mixed test";

  // ============================================================
  // RC26-11 — POSTPARTUM
  // ============================================================

  const s11 = start(11, "POSTPARTUM", "Post-partum");

  addCompletedOutcome(s11, {
    outcome: "live_birth",

    daysAgo: 10,

    living: 1,
  });

  s11.expectedResult = "Postpartum recovery; offspring lineage visible";

  // ============================================================
  // RC26-12 — STILLBIRTH
  // ============================================================

  const s12 = start(12, "STILLBIRTH", "Post-partum");

  addCompletedOutcome(s12, {
    outcome: "stillbirth",

    daysAgo: 12,

    stillborn: 1,

    calvingEase: "Stillbirth",
  });

  s12.expectedResult = "Stillbirth history; zero living offspring";

  // ============================================================
  // RC26-13 — ABORTION
  // ============================================================

  const s13 = start(13, "ABORTION", "Post-partum");

  addCompletedOutcome(s13, {
    outcome: "abortion",

    daysAgo: 15,

    calvingEase: "Abortion",
  });

  s13.expectedResult = "Pregnancy-loss recovery; parity unchanged";

  // ============================================================
  // RC26-14 — MIXED
  // ============================================================

  const s14 = start(14, "MIXED", "Post-partum");

  addCompletedOutcome(s14, {
    outcome: "mixed",

    daysAgo: 8,

    living: 1,

    stillborn: 1,

    calvingEase: "Difficult",
  });

  s14.expectedResult = "One living offspring plus one embedded stillborn";

  // ============================================================
  // Failed attempt helper
  // ============================================================

  const failedAttempt = (scenario, aiDate, seriesId = id()) =>
    addInsemination(scenario, {
      aiDate,

      extra: {
        attemptSeriesId: seriesId,

        outcome: "Failed (Re-heat)",

        isSuccess: false,

        breedingCycleStatus: "lost",

        breedingCycleCompletedAt: addDays(aiDate, 21),

        outcomeVerificationStatus: "verified",

        outcomeConfirmationSource: "technician_return_to_heat",

        outcomeConfirmedBy: technicianId,

        outcomeConfirmedAt: addDays(aiDate, 21),

        failureReason: "return_to_heat",
      },
    });

  // ============================================================
  // RC26-15 — VERIFIED REHEAT
  // ============================================================

  const s15 = start(15, "REHEAT", "In Heat");

  failedAttempt(s15, addDays(now, -30));

  s15.expectedResult = "Verified failed attempt; re-insemination available";

  // ============================================================
  // RC26-16 — ATTEMPT 2
  // ============================================================

  const s16 = start(16, "ATTEMPT-2", "In Heat");

  const seriesId = id();

  const attempt1 = failedAttempt(s16, addDays(now, -35), seriesId);

  addInsemination(s16, {
    aiDate: undefined,

    status: "pending",

    extra: {
      inseminationDate: undefined,

      scheduledDate: undefined,

      preferredDate: addDays(now, 2),

      attemptSeriesId: seriesId,

      attemptNumber: 2,

      previousAttemptId: attempt1._id,
    },
  });

  s16.expectedResult = "Attempt 2 linked to verified failed Attempt 1";

  // ============================================================
  // RC26-17 — AI IN PROGRESS
  //
  // Test:
  // Farmer AI Request Details
  // Scheduled → In Progress
  // Afternoon schedule
  // No fake 12:00 PM
  // ============================================================

  const s17 = start(17, "AI-IN-PROGRESS", "Inseminated");

  const s17Schedule = visitDate(now, 0);

  const s17ai = addInsemination(s17, {
    aiDate: undefined,

    status: "in-progress",

    extra: {
      inseminationDate: undefined,

      scheduledDate: s17Schedule,

      visitPeriod: "afternoon",

      claimedAt: addDays(now, -1),

      scheduledAt: addDays(now, -1),

      serviceStartedAt: now,
    },
  });

  addTask(s17, {
    type: "AI",

    dueDate: s17Schedule,

    sourceType: "task_scheduler",

    relatedRecordType: "insemination",

    relatedRecordId: s17ai._id,

    inseminationId: s17ai._id,

    status: "In Progress",
  });

  s17.expectedResult =
    "Farmer AI details show In Progress; visit displays Afternoon, never 12:00 PM";

  // ============================================================
  // RC26-18 — HEALTH PENDING
  //
  // Test:
  // Farmer submitted Health request
  // No appointment yet
  // Technician request review
  // ============================================================

  const s18 = start(18, "HEALTH-PENDING");

  addHealthRequest(s18, {
    status: HEALTH_STATUS.PENDING,

    requestType: "loss_of_appetite",

    symptoms:
      "Reduced appetite since yesterday and lower activity than normal.",

    urgency: "medium",

    extra: {
      farmerNotes: "Please check her appetite and hydration.",
    },
  });

  s18.expectedResult =
    "Available Health request shows request context without a schedule";

  // ============================================================
  // RC26-19 — HEALTH SCHEDULED
  //
  // Test:
  // Morning visit
  // Farmer dashboard Upcoming Visits
  // Farmer Health Request Details
  // Technician My Work
  // ============================================================

  const s19 = start(19, "HEALTH-SCHEDULED");

  const s19Schedule = visitDate(now, 2);

  const s19Request = addHealthRequest(s19, {
    technicianId,

    status: HEALTH_STATUS.SCHEDULED,

    requestType: "injury",

    symptoms: "Small wound on the rear leg with mild swelling.",

    urgency: "medium",

    scheduledDate: s19Schedule,

    visitPeriod: "morning",

    extra: {
      claimedAt: now,

      farmerNotes: "Animal is walking but favors the affected leg.",
    },
  });

  addTask(s19, {
    type: "Health",

    dueDate: s19Schedule,

    sourceType: "task_scheduler",

    relatedRecordType: "health",

    relatedRecordId: s19Request._id,

    metadata: {
      healthRequestId: s19Request._id,

      visitPeriod: "morning",
    },
  });

  s19.expectedResult =
    "Farmer and Technician show scheduled Health visit as Morning";

  // ============================================================
  // RC26-20 — HEALTH IN PROGRESS
  //
  // Test:
  // Farmer Requests → In Progress
  // Technician → Continue Health Assistance
  // Afternoon schedule
  // ============================================================

  const s20 = start(20, "HEALTH-IN-PROGRESS");

  const s20Schedule = visitDate(now, 0);

  const s20Request = addHealthRequest(s20, {
    technicianId,

    status: HEALTH_STATUS.IN_PROGRESS,

    requestType: "fever",

    symptoms: "Warm to the touch, reduced appetite, and lethargy.",

    urgency: "high",

    scheduledDate: s20Schedule,

    visitPeriod: "afternoon",

    serviceStartedAt: now,

    extra: {
      claimedAt: addDays(now, -1),

      findings: "Elevated temperature and mild dehydration.",

      farmerNotes: "Symptoms started this morning.",
    },
  });

  addTask(s20, {
    type: "Health",

    dueDate: s20Schedule,

    sourceType: "task_scheduler",

    relatedRecordType: "health",

    relatedRecordId: s20Request._id,

    status: "In Progress",

    metadata: {
      healthRequestId: s20Request._id,

      visitPeriod: "afternoon",
    },
  });

  s20.expectedResult =
    "Health request shows In Progress and Afternoon visit period";

  // ============================================================
  // RC26-21 — HEALTH RESOLVED + OFFICIAL MEDICAL RECORD
  //
  // Primary H4 Records QA scenario.
  //
  // Test:
  // Farmer → Records → Health
  //
  // Should show:
  // request type
  // symptoms
  // urgency
  // diagnosis
  // treatment
  // medicine
  // dosage
  // advice
  // follow-up
  // withdrawal period
  // technician
  //
  // Exactly ONE official completed record.
  // ============================================================

  const s21 = start(21, "HEALTH-RESOLVED");

  const s21ServiceDate = addDays(now, -2);

  const s21Request = addHealthRequest(s21, {
    technicianId,

    status: HEALTH_STATUS.RESOLVED,

    requestType: "disease",

    symptoms: "Coughing, nasal discharge, and reduced appetite.",

    urgency: "high",

    scheduledDate: visitDate(now, -2),

    visitPeriod: "morning",

    serviceStartedAt: addDays(s21ServiceDate, -0.05),

    extra: {
      claimedAt: addDays(now, -3),

      farmerNotes: "Cough became more frequent overnight.",

      findings: "Mild dehydration with respiratory signs.",

      diagnosis: "Bacterial respiratory infection",

      treatment: "Antibiotic treatment and supportive care",

      medicineGiven: "Oxytetracycline",

      dosage: "10 mL",

      advice: "Keep the animal hydrated and monitor appetite.",

      followUpDate: addDays(s21ServiceDate, 4),

      withdrawalPeriodDays: 7,

      withdrawalEndDate: addDays(s21ServiceDate, 7),

      resolutionNotes: "Responded well to initial treatment.",

      resolvedAt: s21ServiceDate,
    },
  });

  addMedicalRecord(s21, {
    healthRequestId: s21Request._id,

    date: s21ServiceDate,
  });

  addTask(s21, {
    type: "Health",

    dueDate: s21Request.scheduledDate,

    sourceType: "task_scheduler",

    relatedRecordType: "health",

    relatedRecordId: s21Request._id,

    status: "Completed",

    completedAt: s21ServiceDate,

    metadata: {
      healthRequestId: s21Request._id,

      visitPeriod: "morning",
    },
  });

  s21.expectedResult =
    "Farmer Records shows one complete Health Assistance record with no meaningless N/A fields";

  // ============================================================
  // RC26-22 — WALK-IN HEALTH RECORD
  //
  // Test:
  // No HealthRequest exists.
  // Only MedicalRecord exists.
  //
  // Farmer Records should show clinical details while omitting
  // request-only fields such as request urgency.
  // ============================================================

  const s22 = start(22, "HEALTH-WALK-IN");

  addMedicalRecord(s22, {
    date: addDays(now, -5),

    type: "Check-up",

    extra: {
      details: {
        diagnosis: "Routine examination; no acute illness detected",

        treatment: "No medication required",
      },

      note: `Routine walk-in check completed during H4 seed ${seedBatch}.`,

      followUpDate: undefined,
    },
  });

  s22.expectedResult =
    "Walk-in Health record renders clinical fields and omits request-only fields";

  // ============================================================
  // QA TABLE
  // ============================================================

  const table = scenarios.map((scenario) => {
    const activeRequest =
      [...scenario.inseminations]
        .reverse()
        .find((item) => ACTIVE_AI_REQUEST_STATUSES.includes(item.status)) ||
      scenario.inseminations.at(-1) ||
      null;

    const activePregnancy =
      scenario.pregnancies.find((item) => item.cycleStatus === "active") ||
      null;

    const nextAction = resolveReproductionNextAction({
      animal: scenario.animal,

      activeRequest,

      activePregnancy,

      tasks: scenario.tasks,

      now,
    });

    const latestTask = scenario.tasks.at(-1);

    const latestHealthRequest = scenario.healthRequests.at(-1) || null;

    const latestMedicalRecord = scenario.medicalRecords.at(-1) || null;

    return {
      Scenario: scenario.scenario,

      "Mother ear tag": scenario.earTag,

      "Animal status": scenario.animal.reproductiveStatus,

      "Insemination status": activeRequest?.status || "—",

      "Attempt number": activeRequest?.attemptNumber || "—",

      "Pregnancy lifecycle":
        activePregnancy?.cycleStatus ||
        scenario.pregnancies.at(-1)?.cycleStatus ||
        "—",

      "Calving outcome": scenario.calvings.at(-1)?.outcome || "—",

      "Health status": latestHealthRequest?.status || "—",

      "Visit period":
        activeRequest?.visitPeriod || latestHealthRequest?.visitPeriod || "—",

      "Medical record": latestMedicalRecord?.type || "—",

      "Living offspring": scenario.offspring.length,

      Task: latestTask
        ? `${latestTask.taskType}/${latestTask.status}/${iso(
            latestTask.dueDate,
          ).slice(0, 10)}`
        : "—",

      "Next phase": nextAction?.phase || "AVAILABLE",

      "Next type": nextAction?.type || "—",

      "Next date": iso(nextAction?.at).slice(0, 10) || "—",

      "Expected result": scenario.expectedResult,
    };
  });

  return {
    seedBatch,
    now,
    farmer,
    technician,
    collections,
    scenarios,
    table,
  };
};

export const validateSeedPlan = (plan, models = MODELS) => {
  const names = plan.scenarios.map((item) => item.scenario);

  const tags = plan.collections.animals.map((item) =>
    item.earTag.toLowerCase(),
  );

  if (
    new Set(names).size !== names.length ||
    names.length !== SCENARIO_NAMES.length
  ) {
    throw new Error("Scenario identifiers are not unique and complete.");
  }

  if (new Set(tags).size !== tags.length) {
    throw new Error("Seed ear tags are not unique.");
  }

  if (
    plan.collections.animals.some(
      (item) => !item.earTag.startsWith(SEED_PREFIX),
    )
  ) {
    throw new Error(`Every seed ear tag must start with ${SEED_PREFIX}.`);
  }

  for (const [key, modelName] of [
    ["animals", "Animal"],

    ["inseminations", "Insemination"],

    ["pregnancies", "Pregnancy"],

    ["calvings", "Calving"],

    ["healthRequests", "HealthRequest"],

    ["medicalRecords", "MedicalRecord"],

    ["tasks", "Task"],

    ["notifications", "Notification"],

    ["timelines", "AnimalTimelineEvent"],

    ["audits", "AuditLog"],
  ]) {
    for (const document of plan.collections[key]) {
      const validationError = new models[modelName](document).validateSync();

      if (validationError) {
        throw new Error(
          `Invalid ${modelName} seed document: ${validationError.message}`,
        );
      }
    }
  }

  for (const scenario of plan.scenarios) {
    const diagnosedInseminationIds = new Set(
      scenario.pregnancies.map((pregnancy) => String(pregnancy.inseminationId)),
    );

    const staleInitialDiagnosisTask = scenario.tasks.find(
      (task) =>
        task.taskType === "PD" &&
        ["Pending", "In Progress"].includes(task.status) &&
        !["continuation_recheck", "diagnostic_follow_up"].includes(
          task.metadata?.workflowStage,
        ) &&
        diagnosedInseminationIds.has(
          String(task.metadata?.inseminationId || ""),
        ),
    );

    if (staleInitialDiagnosisTask) {
      throw new Error(
        `Existing pregnancy left an open initial diagnosis task in ${scenario.scenario}.`,
      );
    }

    for (const pregnancy of scenario.pregnancies) {
      if (String(pregnancy.animalId) !== String(scenario.motherId)) {
        throw new Error(`Pregnancy/mother mismatch in ${scenario.scenario}.`);
      }

      if (
        pregnancy.pregnancyDiagnosis?.date <
        scenario.inseminations[0]?.inseminationDate
      ) {
        throw new Error(
          `Invalid diagnosis chronology in ${scenario.scenario}.`,
        );
      }
    }

    for (const calving of scenario.calvings) {
      const pregnancy = scenario.pregnancies.find(
        (item) => String(item._id) === String(calving.pregnancyId),
      );

      if (!pregnancy || calving.date < pregnancy.pregnancyDiagnosis.date) {
        throw new Error(`Invalid calving chronology in ${scenario.scenario}.`);
      }

      if (pregnancy.cycleStatus === "active") {
        throw new Error(
          `Terminal outcome left an active pregnancy in ${scenario.scenario}.`,
        );
      }
    }

    if (
      ["RC26-12-STILLBIRTH", "RC26-13-ABORTION"].includes(scenario.scenario) &&
      scenario.offspring.length
    ) {
      throw new Error(
        `${scenario.scenario} must not create living Animal offspring.`,
      );
    }

    if (
      scenario.offspring.some(
        (calf) => String(calf.motherId) !== String(scenario.motherId),
      )
    ) {
      throw new Error(`Offspring/mother mismatch in ${scenario.scenario}.`);
    }

    const openReproductionTasks = scenario.tasks.filter(
      (task) =>
        ["Pending", "In Progress"].includes(task.status) &&
        ["AI", "PD", "CD", "Calving"].includes(task.taskType),
    );

    const openTaskKeys = openReproductionTasks.map(
      (task) =>
        `${task.taskType}:${task.sourceType}:${task.metadata?.inseminationId || ""}`,
    );

    if (new Set(openTaskKeys).size !== openTaskKeys.length) {
      throw new Error(
        `Duplicate open reproduction task in ${scenario.scenario}.`,
      );
    }

    const linkedMedicalRequestIds = scenario.medicalRecords
      .map((record) => record.healthRequestId)
      .filter(Boolean)
      .map(String);

    if (
      new Set(linkedMedicalRequestIds).size !== linkedMedicalRequestIds.length
    ) {
      throw new Error(
        `Duplicate MedicalRecord healthRequestId in ${scenario.scenario}.`,
      );
    }

    for (const medicalRecord of scenario.medicalRecords) {
      if (
        medicalRecord.healthRequestId &&
        !scenario.healthRequests.some(
          (request) =>
            String(request._id) === String(medicalRecord.healthRequestId),
        )
      ) {
        throw new Error(
          `MedicalRecord/HealthRequest mismatch in ${scenario.scenario}.`,
        );
      }
    }
  }

  const activeHealthKeys = plan.collections.healthRequests
    .map((item) => item.activeCaseKey)
    .filter(Boolean);

  if (new Set(activeHealthKeys).size !== activeHealthKeys.length) {
    throw new Error("Duplicate active Health request key found in seed plan.");
  }

  return true;
};

export const createManifest = ({
  plan,
  databaseName,
  environment,
  manifestPath,
}) => ({
  manifestVersion: 1,

  status: "planned",

  seedBatch: plan.seedBatch,

  createdAt: new Date().toISOString(),

  environment,

  databaseName,

  manifestPath,

  farmer: {
    id: idString(plan.farmer),

    email: plan.farmer.email,
  },

  technician: {
    id: idString(plan.technician),

    email: plan.technician.email,
  },

  insertedAnimalIds: plan.collections.animals.map((item) => idString(item._id)),

  motherAnimalIds: plan.scenarios.map((item) => idString(item.motherId)),

  insertedInseminationIds: plan.collections.inseminations.map((item) =>
    idString(item._id),
  ),

  insertedPregnancyIds: plan.collections.pregnancies.map((item) =>
    idString(item._id),
  ),

  insertedCalvingIds: plan.collections.calvings.map((item) =>
    idString(item._id),
  ),

  insertedHealthRequestIds: plan.collections.healthRequests.map((item) =>
    idString(item._id),
  ),

  insertedMedicalRecordIds: plan.collections.medicalRecords.map((item) =>
    idString(item._id),
  ),

  insertedTaskIds: plan.collections.tasks.map((item) => idString(item._id)),

  insertedNotificationIds: plan.collections.notifications.map((item) =>
    idString(item._id),
  ),

  insertedTimelineIds: plan.collections.timelines.map((item) =>
    idString(item._id),
  ),

  insertedAuditIds: plan.collections.audits.map((item) => idString(item._id)),

  offspringIds: plan.scenarios.flatMap((item) =>
    item.offspring.map((calf) => idString(calf._id)),
  ),

  scenarioNames: plan.scenarios.map((item) => item.scenario),

  earTags: plan.collections.animals.map((item) => item.earTag),

  cleanupOrder: [
    "notifications",
    "audits",
    "timelines",
    "tasks",
    "medicalRecords",
    "healthRequests",
    "calvings",
    "pregnancies",
    "inseminations",
    "offspring",
    "mothers",
  ],
});

export const insertSeedPlan = async ({
  plan,
  models = MODELS,
  session = null,
}) => {
  const options = session
    ? {
        session,
        ordered: true,
      }
    : {
        ordered: true,
      };

  const sequence = [
    [models.Animal, plan.collections.animals],

    [models.Insemination, plan.collections.inseminations],

    [models.Pregnancy, plan.collections.pregnancies],

    [models.Calving, plan.collections.calvings],

    [models.HealthRequest, plan.collections.healthRequests],

    [models.MedicalRecord, plan.collections.medicalRecords],

    [models.Task, plan.collections.tasks],

    [models.Notification, plan.collections.notifications],

    [models.AnimalTimelineEvent, plan.collections.timelines],

    [models.AuditLog, plan.collections.audits],
  ];

  for (const [model, documents] of sequence) {
    if (documents.length) {
      await model.insertMany(documents, options);
    }
  }
};

export const applySeedPlan = async ({ execute, plan, writer }) => {
  if (!execute) {
    return {
      dryRun: true,

      writes: 0,
    };
  }

  await writer(plan);

  return {
    dryRun: false,

    writes: Object.values(plan.collections).reduce(
      (count, items) => count + items.length,
      0,
    ),
  };
};

export const assertSeedBatchAvailable = async ({
  plan,
  AuditLogModel = AuditLog,
  AnimalModel = Animal,
}) => {
  const tags = plan.collections.animals.map((item) => item.earTag);

  const [batchArtifact, existingTag] = await Promise.all([
    AuditLogModel.exists({
      "metadata.seedBatch": plan.seedBatch,
    }),

    AnimalModel.exists({
      farmerId: plan.farmer._id,

      earTag: {
        $in: tags,
      },

      deletedAt: null,
    }),
  ]);

  if (batchArtifact) {
    throw new Error(`Seed batch already exists: ${plan.seedBatch}`);
  }

  if (existingTag) {
    throw new Error(
      "One or more planned RC26 ear tags already exist for this farmer.",
    );
  }
};

const assertNoExistingManifestForBatch = async (seedBatch, backupDir) => {
  let names = [];

  try {
    names = await fs.readdir(backupDir);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    return;
  }

  for (const name of names.filter((value) =>
    /^reproduction-lifecycle-seed-.+\.json$/.test(value),
  )) {
    try {
      const manifest = JSON.parse(
        await fs.readFile(path.join(backupDir, name), "utf8"),
      );

      if (manifest.seedBatch === seedBatch) {
        throw new Error(
          `A manifest already exists for seed batch ${seedBatch}: ${name}`,
        );
      }
    } catch (error) {
      if (error.message?.startsWith("A manifest already exists")) {
        throw error;
      }

      // Unrelated malformed backup files
      // do not authorize or block this batch.
    }
  }
};

const verifyInsertedPlan = async (plan) => {
  const manifestIds = Object.values(plan.collections)
    .flat()
    .map((item) => String(item._id));

  const activeKeys = plan.collections.inseminations
    .map((item) => item.activeRequestKey)
    .filter(Boolean);

  if (new Set(activeKeys).size !== activeKeys.length) {
    throw new Error("Duplicate active AI request key found in seed plan.");
  }

  const normalizedTags = plan.collections.animals.map(
    (item) => item.normalizedEarTag,
  );

  if (new Set(normalizedTags).size !== normalizedTags.length) {
    throw new Error("Duplicate normalized ear tag found in seed plan.");
  }

  const [
    animals,
    inseminations,
    pregnancies,
    calvings,
    healthRequests,
    medicalRecords,
    tasks,
    notifications,
    timelines,
    audits,
  ] = await Promise.all([
    Animal.find({
      _id: {
        $in: plan.collections.animals.map((item) => item._id),
      },
    })
      .select("+normalizedEarTag")
      .lean(),

    Insemination.find({
      _id: {
        $in: plan.collections.inseminations.map((item) => item._id),
      },
    }).lean(),

    Pregnancy.find({
      _id: {
        $in: plan.collections.pregnancies.map((item) => item._id),
      },
    }).lean(),

    Calving.find({
      _id: {
        $in: plan.collections.calvings.map((item) => item._id),
      },
    }).lean(),

    HealthRequest.find({
      _id: {
        $in: plan.collections.healthRequests.map((item) => item._id),
      },
    }).lean(),

    MedicalRecord.find({
      _id: {
        $in: plan.collections.medicalRecords.map((item) => item._id),
      },
    }).lean(),

    Task.find({
      _id: {
        $in: plan.collections.tasks.map((item) => item._id),
      },
    }).lean(),

    Notification.find({
      _id: {
        $in: plan.collections.notifications.map((item) => item._id),
      },
    }).lean(),

    AnimalTimelineEvent.find({
      _id: {
        $in: plan.collections.timelines.map((item) => item._id),
      },
    }).lean(),

    AuditLog.find({
      _id: {
        $in: plan.collections.audits.map((item) => item._id),
      },
    }).lean(),
  ]);

  const persisted = {
    animals,
    inseminations,
    pregnancies,
    calvings,
    healthRequests,
    medicalRecords,
    tasks,
    notifications,
    timelines,
    audits,
  };

  for (const [name, documents] of Object.entries(persisted)) {
    if (documents.length !== plan.collections[name].length) {
      throw new Error(`Read-only verification found missing ${name}.`);
    }
  }

  const animalById = new Map(animals.map((item) => [String(item._id), item]));

  const pregnancyById = new Map(
    pregnancies.map((item) => [String(item._id), item]),
  );

  const healthRequestById = new Map(
    healthRequests.map((item) => [String(item._id), item]),
  );

  const diagnosedInseminationIds = new Set(
    pregnancies.map((item) => String(item.inseminationId)),
  );

  const staleInitialDiagnosisTask = tasks.find(
    (task) =>
      task.taskType === "PD" &&
      ["Pending", "In Progress"].includes(task.status) &&
      !["continuation_recheck", "diagnostic_follow_up"].includes(
        task.metadata?.workflowStage,
      ) &&
      diagnosedInseminationIds.has(String(task.metadata?.inseminationId || "")),
  );

  if (staleInitialDiagnosisTask) {
    throw new Error(
      "Read-only verification found an open initial diagnosis task for an existing Pregnancy.",
    );
  }

  for (const pregnancy of pregnancies) {
    if (!animalById.has(String(pregnancy.animalId))) {
      throw new Error(
        "Read-only verification found a Pregnancy linked to the wrong mother.",
      );
    }
  }

  for (const calving of calvings) {
    const pregnancy = pregnancyById.get(String(calving.pregnancyId));

    if (!pregnancy || String(pregnancy.animalId) !== String(calving.animalId)) {
      throw new Error(
        "Read-only verification found a Calving/Pregnancy mismatch.",
      );
    }

    if (["completed", "lost"].includes(pregnancy.cycleStatus) === false) {
      throw new Error(
        "Read-only verification found an active Pregnancy after a terminal outcome.",
      );
    }

    if (
      ["stillbirth", "abortion"].includes(calving.outcome) &&
      animals.some((item) => String(item.motherId) === String(calving.animalId))
    ) {
      throw new Error(
        `Read-only verification found living offspring for ${calving.outcome}.`,
      );
    }
  }

  for (const offspring of animals.filter((item) => item.motherId)) {
    if (!animalById.has(String(offspring.motherId))) {
      throw new Error(
        "Read-only verification found offspring linked to the wrong mother.",
      );
    }
  }

  for (const medicalRecord of medicalRecords) {
    if (
      medicalRecord.healthRequestId &&
      !healthRequestById.has(String(medicalRecord.healthRequestId))
    ) {
      throw new Error(
        "Read-only verification found a MedicalRecord linked to an unknown HealthRequest.",
      );
    }
  }

  const persistedMedicalHealthIds = medicalRecords
    .map((item) => item.healthRequestId)
    .filter(Boolean)
    .map(String);

  if (
    new Set(persistedMedicalHealthIds).size !== persistedMedicalHealthIds.length
  ) {
    throw new Error(
      "Read-only verification found duplicate MedicalRecord healthRequestId values.",
    );
  }

  const persistedActiveKeys = inseminations
    .map((item) => item.activeRequestKey)
    .filter(Boolean);

  if (new Set(persistedActiveKeys).size !== persistedActiveKeys.length) {
    throw new Error(
      "Read-only verification found duplicate active AI request keys.",
    );
  }

  const persistedActiveHealthKeys = healthRequests
    .map((item) => item.activeCaseKey)
    .filter(Boolean);

  if (
    new Set(persistedActiveHealthKeys).size !== persistedActiveHealthKeys.length
  ) {
    throw new Error(
      "Read-only verification found duplicate active Health request keys.",
    );
  }

  const persistedTags = animals
    .map((item) => item.normalizedEarTag)
    .filter(Boolean);

  if (new Set(persistedTags).size !== persistedTags.length) {
    throw new Error(
      "Read-only verification found duplicate normalized ear tags.",
    );
  }

  for (const documents of [tasks, timelines, audits]) {
    if (documents.some((item) => item.metadata?.seedBatch !== plan.seedBatch)) {
      throw new Error(
        "Read-only verification found a missing seedBatch marker.",
      );
    }
  }

  if (manifestIds.some((value) => !mongoose.isValidObjectId(value))) {
    throw new Error("A planned document ID is invalid.");
  }

  return true;
};

export const connectDevelopmentDatabase = async ({
  uri = ENV.DB_URL_DEV || ENV.DB_URL,

  mongooseClient = mongoose,

  configureDns = configureCustomDns,
} = {}) => {
  if (!uri) {
    throw new Error("Development database connection string is missing.");
  }

  configureDns();

  const connection = await mongooseClient.connect(uri, {
    autoIndex: false,
  });

  const databaseName = connection.connection.name;

  if (/prod/i.test(databaseName) || databaseName === "IloIlo-BreeedSmart-DB") {
    await mongooseClient.disconnect();

    throw new Error(
      `Refusing database whose name appears production-like: ${databaseName}`,
    );
  }

  return connection;
};

export const runSeedCli = async (argv = process.argv.slice(2)) => {
  const args = parseSeedArgs(argv);

  const environment = process.env.NODE_ENV || "development";

  assertDevelopmentEnvironment(environment);

  assertRequiredSchemas();

  const connection = await connectDevelopmentDatabase();

  try {
    const { farmer, technician } = await resolveSeedUsers({
      farmerEmail: args.farmerEmail,

      technicianEmail: args.technicianEmail,
    });

    const plan = buildReproductionLifecyclePlan({
      farmer,
      technician,

      seedBatch: args.seedBatch || undefined,
    });

    validateSeedPlan(plan);

    await assertSeedBatchAvailable({
      plan,
    });

    const backupDir = path.resolve(process.cwd(), "backups");

    await assertNoExistingManifestForBatch(plan.seedBatch, backupDir);

    console.log(`\nMode: ${args.execute ? "EXECUTE" : "DRY RUN"}`);

    console.log(`Database: ${connection.connection.name}`);

    console.log(`Seed batch: ${plan.seedBatch}`);

    console.table(plan.table);

    console.log(
      "Planned inserts:",
      Object.fromEntries(
        Object.entries(plan.collections).map(([key, value]) => [
          key,
          value.length,
        ]),
      ),
    );

    if (!args.execute) {
      console.log(
        "\nDry run complete. No database or manifest writes occurred.",
      );

      return {
        dryRun: true,

        plan,
      };
    }

    await fs.mkdir(backupDir, {
      recursive: true,
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    const manifestPath = path.join(
      backupDir,

      `reproduction-lifecycle-seed-${timestamp}.json`,
    );

    const manifest = createManifest({
      plan,

      databaseName: connection.connection.name,

      environment,

      manifestPath,
    });

    await fs.writeFile(
      manifestPath,

      JSON.stringify(manifest, null, 2),

      {
        encoding: "utf8",

        flag: "wx",
      },
    );

    console.log(`Safety manifest written before inserts: ${manifestPath}`);

    const session = await mongoose.startSession();

    try {
      try {
        await session.withTransaction(() =>
          insertSeedPlan({
            plan,
            session,
          }),
        );
      } catch (error) {
        if (!knownTransactionError(error)) {
          throw error;
        }

        console.warn(
          "Transactions are unavailable; using ordered inserts. The prewritten manifest preserves exact cleanup IDs.",
        );

        await insertSeedPlan({
          plan,
        });
      }
    } finally {
      await session.endSession();
    }

    await verifyInsertedPlan(plan);

    manifest.status = "executed";

    manifest.executedAt = new Date().toISOString();

    await fs.writeFile(
      manifestPath,

      JSON.stringify(manifest, null, 2),

      "utf8",
    );

    console.table(plan.table);

    console.log(`\nSeed complete. Manifest: ${manifestPath}`);

    return {
      dryRun: false,

      plan,

      manifestPath,
    };
  } finally {
    await mongoose.disconnect();
  }
};

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  runSeedCli().catch((error) => {
    console.error(`Seed failed: ${error.message}`);

    process.exitCode = 1;
  });
}
