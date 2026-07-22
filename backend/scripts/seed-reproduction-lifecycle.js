/**
 * Development-only reproduction lifecycle scenario seeder.
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
import { Task } from "../src/models/task.model.js";
import { Notification } from "../src/models/notification.model.js";
import { AnimalTimelineEvent } from "../src/models/animal-timeline-event.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import { calculateTargetCalvingDate, getBreedProfile } from "../src/utils/cattleCore.js";
import { resolveReproductionNextAction } from "../src/domain/reproduction-next-action.js";
import { ACTIVE_AI_REQUEST_STATUSES } from "../src/domain/status-vocabulary.js";

export const SEED_PREFIX = "RC26-";
export const SCENARIO_NAMES = Object.freeze([
  "RC26-01-AVAILABLE", "RC26-02-AI-PENDING", "RC26-03-AI-SCHEDULED",
  "RC26-04-AI-DAY10", "RC26-05-AI-DAY21", "RC26-06-LIKELY-PREGNANT",
  "RC26-07-PD-DUE", "RC26-08-PREGNANT", "RC26-09-CALVING-DUE",
  "RC26-10-CALVING-OVERDUE", "RC26-11-POSTPARTUM", "RC26-12-STILLBIRTH",
  "RC26-13-ABORTION", "RC26-14-MIXED", "RC26-15-REHEAT", "RC26-16-ATTEMPT-2",
]);

const DAY_MS = 86_400_000;
const SPECIES = "Beef Cattle";
const BREED = "Angus";
const MODELS = { Animal, Insemination, Pregnancy, Calving, Task, Notification, AnimalTimelineEvent, AuditLog };
const REQUIRED_SCHEMA_PATHS = {
  Animal: ["farmerId", "animalId", "earTag", "reproductiveStatus", "motherId"],
  Insemination: ["farmerId", "animalId", "status", "attemptNumber", "attemptSeriesId", "previousAttemptId"],
  Pregnancy: ["animalId", "farmerId", "inseminationId", "pregnancyDiagnosis.date", "pregnancyDiagnosis.result", "cycleStatus"],
  Calving: ["animalId", "pregnancyId", "inseminationId", "outcome", "livingCalfCount", "stillbornCount"],
  Task: ["farmerId", "animalIds", "taskType", "sourceType", "metadata"],
  Notification: ["recipientId", "senderId", "relatedId", "title", "message"],
  AnimalTimelineEvent: ["animalId", "sourceType", "sourceId", "metadata"],
  AuditLog: ["entityType", "entityId", "action", "metadata"],
};

const addDays = (date, days) => new Date(new Date(date).getTime() + days * DAY_MS);
const id = () => new mongoose.Types.ObjectId();
const idString = (value) => String(value?._id || value || "");
const iso = (value) => value ? new Date(value).toISOString() : "";
const normalizedEmail = (value) => String(value || "").trim().toLowerCase();
const knownTransactionError = (error) => /Transaction numbers are only allowed|replica set|mongos/i.test(error?.message || "");

export const parseSeedArgs = (argv = process.argv.slice(2)) => {
  const value = (name) => argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  return {
    farmerEmail: normalizedEmail(value("farmerEmail")),
    technicianEmail: normalizedEmail(value("technicianEmail")),
    seedBatch: value("seedBatch") || "",
    execute: argv.includes("--execute"),
  };
};

export const assertDevelopmentEnvironment = (environment = process.env.NODE_ENV || "development") => {
  if (String(environment).toLowerCase() === "production") {
    throw new Error("Refusing to seed when NODE_ENV=production.");
  }
};

export const hasRequiredSchemaPath = (schema, schemaPath, { allowNestedContainer = false } = {}) => {
  if (!schema || typeof schema.path !== "function") return false;
  const resolvedPath = schema.path(schemaPath);
  const pathType = typeof schema.pathType === "function" ? schema.pathType(schemaPath) : null;
  const isDirectPath = Boolean(resolvedPath) && (!pathType || pathType === "real");
  if (isDirectPath) return true;
  return allowNestedContainer && Boolean(schema.nested?.[schemaPath]);
};

export const assertRequiredSchemaPath = (modelName, schema, schemaPath, options) => {
  if (!hasRequiredSchemaPath(schema, schemaPath, options)) {
    throw new Error(`Required schema path is missing: ${modelName}.${schemaPath}`);
  }
};

export const assertRequiredSchemas = (models = MODELS) => {
  for (const [name, paths] of Object.entries(REQUIRED_SCHEMA_PATHS)) {
    const model = models[name];
    if (!model?.schema) throw new Error(`Required model is unavailable: ${name}`);
    for (const schemaPath of paths) {
      assertRequiredSchemaPath(name, model.schema, schemaPath);
    }
  }
};

export const resolveSeedUsers = async ({ UserModel = User, farmerEmail, technicianEmail }) => {
  if (!farmerEmail || !technicianEmail) {
    throw new Error("Both --farmerEmail and --technicianEmail are required.");
  }
  const [farmer, technician] = await Promise.all([
    UserModel.findOne({ email: farmerEmail, role: "farmer", deletedAt: null }),
    UserModel.findOne({ email: technicianEmail, role: "technician", deletedAt: null }),
  ]);
  if (!farmer) throw new Error(`Existing farmer account not found: ${farmerEmail}`);
  if (!technician) throw new Error(`Existing technician account not found: ${technicianEmail}`);
  return { farmer, technician };
};

export const createSeedBatch = (now = new Date()) =>
  `repro-${now.toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${crypto.randomBytes(3).toString("hex")}`;

const makeScenarioTag = (batchSuffix, index, label) =>
  `${SEED_PREFIX}${batchSuffix}-${String(index).padStart(2, "0")}-${label}`;

const baseAnimal = ({ _id, farmerId, earTag, status, now, seedBatch, extra = {} }) => ({
  _id,
  farmerId,
  animalId: `SEED-${seedBatch}-${earTag}`,
  earTag,
  normalizedEarTag: earTag.trim().toLowerCase(),
  species: SPECIES,
  breed: BREED,
  color: "Black",
  gender: "Female",
  reproductiveStatus: status,
  birthDate: addDays(now, -4 * 365),
  parity: 0,
  barangay: "Seed Lifecycle QA",
  isVerified: true,
  activityLogs: [{ event: "Seed Scenario Created", date: now, description: `Development seed batch ${seedBatch}.` }],
  deletedAt: null,
  ...extra,
});

const baseInsemination = ({ _id, farmerId, animalId, technicianId, aiDate, status = "done", seedBatch, extra = {} }) => ({
  _id,
  farmerId,
  animalId,
  technicianId,
  approvedBy: technicianId,
  inseminationDate: aiDate,
  preferredDate: aiDate,
  scheduledDate: ACTIVE_AI_REQUEST_STATUSES.includes(status) ? aiDate : undefined,
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
  statusHistory: [{ status, note: `Seeded by ${seedBatch}.`, actorId: technicianId, createdAt: aiDate }],
  deletedAt: null,
  ...(ACTIVE_AI_REQUEST_STATUSES.includes(status) ? { activeRequestKey: String(animalId) } : {}),
  ...extra,
});

const baseTask = ({ _id, farmerId, technicianId, animalId, type, dueDate, sourceType, relatedRecordType = null, relatedRecordId = null, status = "Pending", completedAt = null, inseminationId, seedBatch, notes }) => ({
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
  metadata: { seedBatch, inseminationId },
});

const confirmedPregnancy = ({ _id, animalId, farmerId, inseminationId, aiDate, diagnosisDate, cycleStatus = "active", completedAt = null }) => ({
  _id,
  animalId,
  farmerId,
  inseminationId,
  pregnancyDiagnosis: { date: diagnosisDate, result: "Pregnant" },
  targetCalvingDate: calculateTargetCalvingDate(aiDate, SPECIES, undefined, BREED),
  technicianNote: "Technician-confirmed pregnancy for development lifecycle testing.",
  cycleStatus,
  completedAt,
  deletedAt: null,
});

export const buildReproductionLifecyclePlan = ({ farmer, technician, now = new Date(), seedBatch = createSeedBatch(now) }) => {
  if (!farmer?._id || !technician?._id) throw new Error("Existing farmer and technician records are required.");
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(seedBatch)) throw new Error("seedBatch must be 8-80 safe characters.");
  const farmerId = farmer._id;
  const technicianId = technician._id;
  const suffix = seedBatch.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  const collections = { animals: [], inseminations: [], pregnancies: [], calvings: [], tasks: [], notifications: [], timelines: [], audits: [] };
  const scenarios = [];

  const start = (index, label, status = "Normal", extra = {}) => {
    const scenario = SCENARIO_NAMES[index - 1];
    const motherId = id();
    const earTag = makeScenarioTag(suffix, index, label);
    const animal = baseAnimal({ _id: motherId, farmerId, earTag, status, now, seedBatch, extra });
    collections.animals.push(animal);
    const item = { index, scenario, motherId, earTag, animal, inseminations: [], pregnancies: [], calvings: [], tasks: [], offspring: [], expectedResult: "" };
    scenarios.push(item);
    return item;
  };
  const addInsemination = (scenario, data) => {
    const record = baseInsemination({ _id: id(), farmerId, animalId: scenario.motherId, technicianId, seedBatch, ...data });
    collections.inseminations.push(record); scenario.inseminations.push(record); return record;
  };
  const addTask = (scenario, data) => {
    const record = baseTask({ _id: id(), farmerId, technicianId, animalId: scenario.motherId, seedBatch, ...data });
    collections.tasks.push(record); scenario.tasks.push(record); return record;
  };
  const addPregnancy = (scenario, insemination, data) => {
    const record = confirmedPregnancy({ _id: id(), animalId: scenario.motherId, farmerId, inseminationId: insemination._id, ...data });
    collections.pregnancies.push(record); scenario.pregnancies.push(record); insemination.pregnancyId = record._id; return record;
  };
  const addHistoryArtifacts = (scenario, { calving, title, message, outcome }) => {
    const timeline = {
      _id: id(), animalId: scenario.motherId,
      eventType: outcome === "abortion" ? "pregnancy_loss_recorded" : "calving_recorded",
      occurredAt: calving.date, actorId: technicianId, sourceType: "Calving", sourceId: calving._id,
      title, summary: message, metadata: { seedBatch, outcome, pregnancyId: calving.pregnancyId, inseminationId: calving.inseminationId },
    };
    const audit = {
      _id: id(), entityType: "Calving", entityId: calving._id, action: "create_calving_record", actorId: technicianId,
      after: { outcome, numberOfCalves: calving.numberOfCalves }, metadata: { seedBatch, motherId: scenario.motherId, outcome },
    };
    const notification = {
      _id: id(), recipientId: farmerId, senderId: technicianId, type: "system", relatedId: calving._id,
      linkType: "record", title, message, isRead: false,
    };
    collections.timelines.push(timeline); collections.audits.push(audit); collections.notifications.push(notification);
  };
  const addCompletedOutcome = (scenario, { outcome, daysAgo, living = 0, stillborn = 0, calvingEase = "Natural" }) => {
    const eventDate = addDays(now, -daysAgo);
    const gestationDays = getBreedProfile(SPECIES, BREED).avgGestationDays;
    const aiDate = outcome === "abortion" ? addDays(eventDate, -120) : addDays(eventDate, -gestationDays);
    const diagnosisDate = addDays(aiDate, 60);
    const insemination = addInsemination(scenario, {
      aiDate, extra: {
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
      aiDate, diagnosisDate, cycleStatus: outcome === "abortion" ? "lost" : "completed", completedAt: eventDate,
    });
    const offspring = [];
    for (let index = 0; index < living; index += 1) {
      const offspringId = id();
      const earTag = `${scenario.earTag}-CALF-${index + 1}`;
      const calf = baseAnimal({
        _id: offspringId, farmerId, earTag, status: "Normal", now, seedBatch,
        extra: { animalId: `SEED-${seedBatch}-CALF-${scenario.index}-${index + 1}`, gender: index % 2 ? "Male" : "Female", birthDate: eventDate, motherId: scenario.motherId },
      });
      collections.animals.push(calf); scenario.offspring.push(calf); offspring.push(calf);
    }
    const calving = {
      _id: id(), animalId: scenario.motherId, farmerId, pregnancyId: pregnancy._id, inseminationId: insemination._id,
      date: eventDate, numberOfCalves: living + stillborn, totalDelivered: living + stillborn,
      calves: offspring.map((calf, index) => ({ sex: index % 2 ? "M" : "F", earTag: calf.earTag, animalId: calf._id })),
      nonLivingCalves: Array.from({ length: stillborn }, (_, index) => ({ sex: index % 2 ? "F" : "M", earTag: `${scenario.earTag}-LOSS-${index + 1}`, color: "Black", brand: "" })),
      livingCalfCount: living, stillbornCount: stillborn, outcome, calvingEase, technicianId,
      technicianNote: `Historical ${outcome} seed record ${seedBatch}.`, deletedAt: null,
    };
    collections.calvings.push(calving); scenario.calvings.push(calving);
    const task = addTask(scenario, {
      type: "Calving", dueDate: eventDate, sourceType: "task_scheduler", status: "Completed", completedAt: eventDate,
      relatedRecordType: "calving", relatedRecordId: calving._id, inseminationId: insemination._id,
    });
    void task;
    scenario.animal.reproductiveStatus = "Post-partum";
    scenario.animal.lastInseminationDate = aiDate;
    delete scenario.animal.expectedCalvingDate;
    if (outcome === "abortion") scenario.animal.lastPregnancyLossDate = eventDate;
    else { scenario.animal.lastCalvingDate = eventDate; scenario.animal.parity = 1; }
    scenario.animal.activityLogs.push({ event: outcome === "abortion" ? "Pregnancy Loss" : "Calving", date: eventDate, description: `Seeded ${outcome} outcome.` });
    const title = outcome === "live_birth" ? "Live Birth recorded" : outcome === "mixed" ? "Mixed delivery recorded" : outcome === "stillbirth" ? "Stillbirth recorded" : "Abortion recorded";
    const message = outcome === "abortion"
      ? `Pregnancy loss recorded for ${scenario.earTag}; no living offspring were created.`
      : outcome === "stillbirth"
        ? `Stillbirth recorded for ${scenario.earTag}; no living offspring were created.`
        : `${title} for ${scenario.earTag}: ${living} living and ${stillborn} stillborn.`;
    addHistoryArtifacts(scenario, { calving, title, message, outcome });
    return { insemination, pregnancy, calving };
  };

  start(1, "AVAILABLE").expectedResult = "AI request available";

  const s2 = start(2, "AI-PENDING");
  addInsemination(s2, { aiDate: undefined, status: "pending", extra: { inseminationDate: undefined, scheduledDate: undefined, preferredDate: addDays(now, 3) } });
  s2.expectedResult = "Duplicate active AI request rejected";

  const s3 = start(3, "AI-SCHEDULED");
  const s3ai = addInsemination(s3, { aiDate: undefined, status: "scheduled", extra: { inseminationDate: undefined, scheduledDate: addDays(now, 3), preferredDate: addDays(now, 3) } });
  addTask(s3, { type: "AI", dueDate: s3ai.scheduledDate, sourceType: "task_scheduler", relatedRecordType: "insemination", relatedRecordId: s3ai._id, inseminationId: s3ai._id });
  s3.expectedResult = "Attend scheduled AI visit";

  const monitoring = (index, label, daysAgo) => {
    const aiDate = addDays(now, -daysAgo);
    const scenario = start(index, label, "Inseminated", { lastInseminationDate: aiDate });
    const insemination = addInsemination(scenario, { aiDate });
    addTask(scenario, { type: "PD", dueDate: addDays(aiDate, 60), sourceType: "automatic_pd_followup", relatedRecordType: "insemination", relatedRecordId: insemination._id, inseminationId: insemination._id });
    return { scenario, insemination, aiDate };
  };
  monitoring(4, "AI-DAY10", 10).scenario.expectedResult = "Monitor return to heat; PD blocked";
  monitoring(5, "AI-DAY21", 21).scenario.expectedResult = "Return-to-heat milestone; farmer observation available";

  const s6data = monitoring(6, "LIKELY-PREGNANT", 40);
  s6data.scenario.animal.reproductiveStatus = "Likely Pregnant";
  Object.assign(s6data.insemination, {
    farmerOutcomeReport: "possible_pregnancy", farmerOutcomeReportedAt: now,
    farmerObservationSigns: ["no_return_to_heat", "body_condition_change"],
    farmerObservationNotes: "Seeded possible-pregnancy observation.", verificationRequested: true,
    verificationStatus: "pending", outcomeVerificationStatus: "reported", outcomeConfirmationSource: "farmer_possible_pregnancy",
  });
  const s6task = s6data.scenario.tasks[0];
  Object.assign(s6task, {
    sourceType: "farmer_requested_verification",
    notes: `Farmer-requested pregnancy verification (${seedBatch}).`,
  });
  s6data.insemination.verificationTaskId = s6task._id;
  s6data.scenario.expectedResult = "Technician verification required; PD locked before Day 60";

  const s7data = monitoring(7, "PD-DUE", 60);
  s7data.scenario.expectedResult = "Perform pregnancy diagnosis";

  const pregnantScenario = (index, label, daysAgo, taskOffset = null) => {
    const aiDate = addDays(now, -daysAgo);
    const diagnosisDate = addDays(aiDate, 60);
    const scenario = start(index, label, "Pregnant", { lastInseminationDate: aiDate });
    const insemination = addInsemination(scenario, { aiDate, extra: { outcome: "Pregnant", isSuccess: true, outcomeVerificationStatus: "verified", outcomeConfirmationSource: "technician_pregnancy_diagnosis", outcomeConfirmedBy: technicianId, outcomeConfirmedAt: diagnosisDate } });
    const pregnancy = addPregnancy(scenario, insemination, { aiDate, diagnosisDate });
    scenario.animal.expectedCalvingDate = pregnancy.targetCalvingDate;
    addTask(scenario, { type: "PD", dueDate: diagnosisDate, sourceType: "automatic_pd_followup", status: "Completed", completedAt: diagnosisDate, relatedRecordType: "pregnancy", relatedRecordId: pregnancy._id, inseminationId: insemination._id });
    if (taskOffset !== null) addTask(scenario, { type: "Calving", dueDate: addDays(now, taskOffset), sourceType: "task_scheduler", relatedRecordType: "pregnancy", relatedRecordId: pregnancy._id, inseminationId: insemination._id });
    return { scenario, insemination, pregnancy };
  };
  pregnantScenario(8, "PREGNANT", 150).scenario.expectedResult = "Prepare for expected calving";
  pregnantScenario(9, "CALVING-DUE", getBreedProfile(SPECIES, BREED).avgGestationDays, 0).scenario.expectedResult = "Calving follow-up due today";
  pregnantScenario(10, "CALVING-OVERDUE", getBreedProfile(SPECIES, BREED).avgGestationDays + 5, -5).scenario.expectedResult = "Five days overdue; ready for twin or mixed test";

  const s11 = start(11, "POSTPARTUM", "Post-partum");
  addCompletedOutcome(s11, { outcome: "live_birth", daysAgo: 10, living: 1 });
  s11.expectedResult = "Postpartum recovery; offspring lineage visible";
  const s12 = start(12, "STILLBIRTH", "Post-partum");
  addCompletedOutcome(s12, { outcome: "stillbirth", daysAgo: 12, stillborn: 1, calvingEase: "Stillbirth" });
  s12.expectedResult = "Stillbirth history; zero living offspring";
  const s13 = start(13, "ABORTION", "Post-partum");
  addCompletedOutcome(s13, { outcome: "abortion", daysAgo: 15, calvingEase: "Abortion" });
  s13.expectedResult = "Pregnancy-loss recovery; parity unchanged";
  const s14 = start(14, "MIXED", "Post-partum");
  addCompletedOutcome(s14, { outcome: "mixed", daysAgo: 8, living: 1, stillborn: 1, calvingEase: "Difficult" });
  s14.expectedResult = "One living offspring plus one embedded stillborn";

  const failedAttempt = (scenario, aiDate, seriesId = id()) => addInsemination(scenario, {
    aiDate,
    extra: {
      attemptSeriesId: seriesId, outcome: "Failed (Re-heat)", isSuccess: false,
      breedingCycleStatus: "lost", breedingCycleCompletedAt: addDays(aiDate, 21),
      outcomeVerificationStatus: "verified", outcomeConfirmationSource: "technician_return_to_heat",
      outcomeConfirmedBy: technicianId, outcomeConfirmedAt: addDays(aiDate, 21), failureReason: "return_to_heat",
    },
  });
  const s15 = start(15, "REHEAT", "In Heat");
  failedAttempt(s15, addDays(now, -30));
  s15.expectedResult = "Verified failed attempt; re-insemination available";

  const s16 = start(16, "ATTEMPT-2", "In Heat");
  const seriesId = id();
  const attempt1 = failedAttempt(s16, addDays(now, -35), seriesId);
  const attempt2 = addInsemination(s16, { aiDate: undefined, status: "pending", extra: { inseminationDate: undefined, scheduledDate: undefined, preferredDate: addDays(now, 2), attemptSeriesId: seriesId, attemptNumber: 2, previousAttemptId: attempt1._id } });
  void attempt2;
  s16.expectedResult = "Attempt 2 linked to verified failed Attempt 1";

  const table = scenarios.map((scenario) => {
    const activeRequest = [...scenario.inseminations].reverse().find((item) => ACTIVE_AI_REQUEST_STATUSES.includes(item.status))
      || scenario.inseminations.at(-1) || null;
    const activePregnancy = scenario.pregnancies.find((item) => item.cycleStatus === "active") || null;
    const nextAction = resolveReproductionNextAction({ animal: scenario.animal, activeRequest, activePregnancy, tasks: scenario.tasks, now });
    const latestTask = scenario.tasks.at(-1);
    return {
      Scenario: scenario.scenario,
      "Mother ear tag": scenario.earTag,
      "Animal status": scenario.animal.reproductiveStatus,
      "Insemination status": activeRequest?.status || "—",
      "Attempt number": activeRequest?.attemptNumber || "—",
      "Pregnancy lifecycle": activePregnancy?.cycleStatus || scenario.pregnancies.at(-1)?.cycleStatus || "—",
      "Calving outcome": scenario.calvings.at(-1)?.outcome || "—",
      "Living offspring": scenario.offspring.length,
      "Task": latestTask ? `${latestTask.taskType}/${latestTask.status}/${iso(latestTask.dueDate).slice(0, 10)}` : "—",
      "Next phase": nextAction?.phase || "AVAILABLE",
      "Next type": nextAction?.type || "—",
      "Next date": iso(nextAction?.at).slice(0, 10) || "—",
      "Expected result": scenario.expectedResult,
    };
  });

  return { seedBatch, now, farmer, technician, collections, scenarios, table };
};

export const validateSeedPlan = (plan, models = MODELS) => {
  const names = plan.scenarios.map((item) => item.scenario);
  const tags = plan.collections.animals.map((item) => item.earTag.toLowerCase());
  if (new Set(names).size !== names.length || names.length !== SCENARIO_NAMES.length) throw new Error("Scenario identifiers are not unique and complete.");
  if (new Set(tags).size !== tags.length) throw new Error("Seed ear tags are not unique.");
  if (plan.collections.animals.some((item) => !item.earTag.startsWith(SEED_PREFIX))) throw new Error(`Every seed ear tag must start with ${SEED_PREFIX}.`);
  for (const [key, modelName] of [["animals", "Animal"], ["inseminations", "Insemination"], ["pregnancies", "Pregnancy"], ["calvings", "Calving"], ["tasks", "Task"], ["notifications", "Notification"], ["timelines", "AnimalTimelineEvent"], ["audits", "AuditLog"]]) {
    for (const document of plan.collections[key]) {
      const validationError = new models[modelName](document).validateSync();
      if (validationError) throw new Error(`Invalid ${modelName} seed document: ${validationError.message}`);
    }
  }
  for (const scenario of plan.scenarios) {
    const diagnosedInseminationIds = new Set(
      scenario.pregnancies.map((pregnancy) => String(pregnancy.inseminationId)),
    );
    const staleInitialDiagnosisTask = scenario.tasks.find((task) =>
      task.taskType === "PD" &&
      ["Pending", "In Progress"].includes(task.status) &&
      !["continuation_recheck", "diagnostic_follow_up"].includes(task.metadata?.workflowStage) &&
      diagnosedInseminationIds.has(String(task.metadata?.inseminationId || "")));
    if (staleInitialDiagnosisTask) {
      throw new Error(`Existing pregnancy left an open initial diagnosis task in ${scenario.scenario}.`);
    }
    for (const pregnancy of scenario.pregnancies) {
      if (String(pregnancy.animalId) !== String(scenario.motherId)) throw new Error(`Pregnancy/mother mismatch in ${scenario.scenario}.`);
      if (pregnancy.pregnancyDiagnosis?.date < scenario.inseminations[0]?.inseminationDate) throw new Error(`Invalid diagnosis chronology in ${scenario.scenario}.`);
    }
    for (const calving of scenario.calvings) {
      const pregnancy = scenario.pregnancies.find((item) => String(item._id) === String(calving.pregnancyId));
      if (!pregnancy || calving.date < pregnancy.pregnancyDiagnosis.date) throw new Error(`Invalid calving chronology in ${scenario.scenario}.`);
      if (pregnancy.cycleStatus === "active") throw new Error(`Terminal outcome left an active pregnancy in ${scenario.scenario}.`);
    }
    if (["RC26-12-STILLBIRTH", "RC26-13-ABORTION"].includes(scenario.scenario) && scenario.offspring.length) {
      throw new Error(`${scenario.scenario} must not create living Animal offspring.`);
    }
    if (scenario.offspring.some((calf) => String(calf.motherId) !== String(scenario.motherId))) {
      throw new Error(`Offspring/mother mismatch in ${scenario.scenario}.`);
    }
    const openReproductionTasks = scenario.tasks.filter((task) =>
      ["Pending", "In Progress"].includes(task.status) && ["AI", "PD", "CD", "Calving"].includes(task.taskType));
    const openTaskKeys = openReproductionTasks.map((task) => `${task.taskType}:${task.sourceType}:${task.metadata?.inseminationId || ""}`);
    if (new Set(openTaskKeys).size !== openTaskKeys.length) throw new Error(`Duplicate open reproduction task in ${scenario.scenario}.`);
  }
  return true;
};

export const createManifest = ({ plan, databaseName, environment, manifestPath }) => ({
  manifestVersion: 1,
  status: "planned",
  seedBatch: plan.seedBatch,
  createdAt: new Date().toISOString(),
  environment,
  databaseName,
  manifestPath,
  farmer: { id: idString(plan.farmer), email: plan.farmer.email },
  technician: { id: idString(plan.technician), email: plan.technician.email },
  insertedAnimalIds: plan.collections.animals.map((item) => idString(item._id)),
  motherAnimalIds: plan.scenarios.map((item) => idString(item.motherId)),
  insertedInseminationIds: plan.collections.inseminations.map((item) => idString(item._id)),
  insertedPregnancyIds: plan.collections.pregnancies.map((item) => idString(item._id)),
  insertedCalvingIds: plan.collections.calvings.map((item) => idString(item._id)),
  insertedTaskIds: plan.collections.tasks.map((item) => idString(item._id)),
  insertedNotificationIds: plan.collections.notifications.map((item) => idString(item._id)),
  insertedTimelineIds: plan.collections.timelines.map((item) => idString(item._id)),
  insertedAuditIds: plan.collections.audits.map((item) => idString(item._id)),
  offspringIds: plan.scenarios.flatMap((item) => item.offspring.map((calf) => idString(calf._id))),
  scenarioNames: plan.scenarios.map((item) => item.scenario),
  earTags: plan.collections.animals.map((item) => item.earTag),
  cleanupOrder: ["notifications", "audits", "timelines", "tasks", "calvings", "pregnancies", "inseminations", "offspring", "mothers"],
});

export const insertSeedPlan = async ({ plan, models = MODELS, session = null }) => {
  const options = session ? { session, ordered: true } : { ordered: true };
  const sequence = [
    [models.Animal, plan.collections.animals], [models.Insemination, plan.collections.inseminations],
    [models.Pregnancy, plan.collections.pregnancies], [models.Calving, plan.collections.calvings],
    [models.Task, plan.collections.tasks], [models.Notification, plan.collections.notifications],
    [models.AnimalTimelineEvent, plan.collections.timelines], [models.AuditLog, plan.collections.audits],
  ];
  for (const [model, documents] of sequence) if (documents.length) await model.insertMany(documents, options);
};

export const applySeedPlan = async ({ execute, plan, writer }) => {
  if (!execute) return { dryRun: true, writes: 0 };
  await writer(plan);
  return { dryRun: false, writes: Object.values(plan.collections).reduce((count, items) => count + items.length, 0) };
};

export const assertSeedBatchAvailable = async ({ plan, AuditLogModel = AuditLog, AnimalModel = Animal }) => {
  const tags = plan.collections.animals.map((item) => item.earTag);
  const [batchArtifact, existingTag] = await Promise.all([
    AuditLogModel.exists({ "metadata.seedBatch": plan.seedBatch }),
    AnimalModel.exists({ farmerId: plan.farmer._id, earTag: { $in: tags }, deletedAt: null }),
  ]);
  if (batchArtifact) throw new Error(`Seed batch already exists: ${plan.seedBatch}`);
  if (existingTag) throw new Error("One or more planned RC26 ear tags already exist for this farmer.");
};

const assertNoExistingManifestForBatch = async (seedBatch, backupDir) => {
  let names = [];
  try {
    names = await fs.readdir(backupDir);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return;
  }
  for (const name of names.filter((value) => /^reproduction-lifecycle-seed-.+\.json$/.test(value))) {
    try {
      const manifest = JSON.parse(await fs.readFile(path.join(backupDir, name), "utf8"));
      if (manifest.seedBatch === seedBatch) throw new Error(`A manifest already exists for seed batch ${seedBatch}: ${name}`);
    } catch (error) {
      if (error.message?.startsWith("A manifest already exists")) throw error;
      // Unrelated malformed backup files do not authorize or block this batch.
    }
  }
};

const verifyInsertedPlan = async (plan) => {
  const manifestIds = Object.values(plan.collections).flat().map((item) => String(item._id));
  const activeKeys = plan.collections.inseminations.map((item) => item.activeRequestKey).filter(Boolean);
  if (new Set(activeKeys).size !== activeKeys.length) throw new Error("Duplicate active AI request key found in seed plan.");
  const normalizedTags = plan.collections.animals.map((item) => item.normalizedEarTag);
  if (new Set(normalizedTags).size !== normalizedTags.length) throw new Error("Duplicate normalized ear tag found in seed plan.");
  const [animals, inseminations, pregnancies, calvings, tasks, notifications, timelines, audits] = await Promise.all([
    Animal.find({ _id: { $in: plan.collections.animals.map((item) => item._id) } }).select("+normalizedEarTag").lean(),
    Insemination.find({ _id: { $in: plan.collections.inseminations.map((item) => item._id) } }).lean(),
    Pregnancy.find({ _id: { $in: plan.collections.pregnancies.map((item) => item._id) } }).lean(),
    Calving.find({ _id: { $in: plan.collections.calvings.map((item) => item._id) } }).lean(),
    Task.find({ _id: { $in: plan.collections.tasks.map((item) => item._id) } }).lean(),
    Notification.find({ _id: { $in: plan.collections.notifications.map((item) => item._id) } }).lean(),
    AnimalTimelineEvent.find({ _id: { $in: plan.collections.timelines.map((item) => item._id) } }).lean(),
    AuditLog.find({ _id: { $in: plan.collections.audits.map((item) => item._id) } }).lean(),
  ]);
  const persisted = { animals, inseminations, pregnancies, calvings, tasks, notifications, timelines, audits };
  for (const [name, documents] of Object.entries(persisted)) {
    if (documents.length !== plan.collections[name].length) throw new Error(`Read-only verification found missing ${name}.`);
  }
  const animalById = new Map(animals.map((item) => [String(item._id), item]));
  const pregnancyById = new Map(pregnancies.map((item) => [String(item._id), item]));
  const diagnosedInseminationIds = new Set(pregnancies.map((item) => String(item.inseminationId)));
  const staleInitialDiagnosisTask = tasks.find((task) =>
    task.taskType === "PD" &&
    ["Pending", "In Progress"].includes(task.status) &&
    !["continuation_recheck", "diagnostic_follow_up"].includes(task.metadata?.workflowStage) &&
    diagnosedInseminationIds.has(String(task.metadata?.inseminationId || "")));
  if (staleInitialDiagnosisTask) {
    throw new Error("Read-only verification found an open initial diagnosis task for an existing Pregnancy.");
  }
  for (const pregnancy of pregnancies) {
    if (!animalById.has(String(pregnancy.animalId))) throw new Error("Read-only verification found a Pregnancy linked to the wrong mother.");
  }
  for (const calving of calvings) {
    const pregnancy = pregnancyById.get(String(calving.pregnancyId));
    if (!pregnancy || String(pregnancy.animalId) !== String(calving.animalId)) throw new Error("Read-only verification found a Calving/Pregnancy mismatch.");
    if (["completed", "lost"].includes(pregnancy.cycleStatus) === false) throw new Error("Read-only verification found an active Pregnancy after a terminal outcome.");
    if (["stillbirth", "abortion"].includes(calving.outcome) && animals.some((item) => String(item.motherId) === String(calving.animalId))) {
      throw new Error(`Read-only verification found living offspring for ${calving.outcome}.`);
    }
  }
  for (const offspring of animals.filter((item) => item.motherId)) {
    if (!animalById.has(String(offspring.motherId))) throw new Error("Read-only verification found offspring linked to the wrong mother.");
  }
  const persistedActiveKeys = inseminations.map((item) => item.activeRequestKey).filter(Boolean);
  if (new Set(persistedActiveKeys).size !== persistedActiveKeys.length) throw new Error("Read-only verification found duplicate active AI request keys.");
  const persistedTags = animals.map((item) => item.normalizedEarTag).filter(Boolean);
  if (new Set(persistedTags).size !== persistedTags.length) throw new Error("Read-only verification found duplicate normalized ear tags.");
  for (const documents of [tasks, timelines, audits]) {
    if (documents.some((item) => item.metadata?.seedBatch !== plan.seedBatch)) throw new Error("Read-only verification found a missing seedBatch marker.");
  }
  if (manifestIds.some((value) => !mongoose.isValidObjectId(value))) throw new Error("A planned document ID is invalid.");
  return true;
};

export const connectDevelopmentDatabase = async ({
  uri = ENV.DB_URL_DEV || ENV.DB_URL,
  mongooseClient = mongoose,
  configureDns = configureCustomDns,
} = {}) => {
  if (!uri) throw new Error("Development database connection string is missing.");
  configureDns();
  const connection = await mongooseClient.connect(uri, { autoIndex: false });
  const databaseName = connection.connection.name;
  if (/prod/i.test(databaseName) || databaseName === "IloIlo-BreeedSmart-DB") {
    await mongooseClient.disconnect();
    throw new Error(`Refusing database whose name appears production-like: ${databaseName}`);
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
    const { farmer, technician } = await resolveSeedUsers({ farmerEmail: args.farmerEmail, technicianEmail: args.technicianEmail });
    const plan = buildReproductionLifecyclePlan({ farmer, technician, seedBatch: args.seedBatch || undefined });
    validateSeedPlan(plan);
    await assertSeedBatchAvailable({ plan });
    const backupDir = path.resolve(process.cwd(), "backups");
    await assertNoExistingManifestForBatch(plan.seedBatch, backupDir);
    console.log(`\nMode: ${args.execute ? "EXECUTE" : "DRY RUN"}`);
    console.log(`Database: ${connection.connection.name}`);
    console.log(`Seed batch: ${plan.seedBatch}`);
    console.table(plan.table);
    console.log("Planned inserts:", Object.fromEntries(Object.entries(plan.collections).map(([key, value]) => [key, value.length])));
    if (!args.execute) {
      console.log("\nDry run complete. No database or manifest writes occurred.");
      return { dryRun: true, plan };
    }

    await fs.mkdir(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const manifestPath = path.join(backupDir, `reproduction-lifecycle-seed-${timestamp}.json`);
    const manifest = createManifest({ plan, databaseName: connection.connection.name, environment, manifestPath });
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), { encoding: "utf8", flag: "wx" });
    console.log(`Safety manifest written before inserts: ${manifestPath}`);

    const session = await mongoose.startSession();
    try {
      try {
        await session.withTransaction(() => insertSeedPlan({ plan, session }));
      } catch (error) {
        if (!knownTransactionError(error)) throw error;
        console.warn("Transactions are unavailable; using ordered inserts. The prewritten manifest preserves exact cleanup IDs.");
        await insertSeedPlan({ plan });
      }
    } finally {
      await session.endSession();
    }
    await verifyInsertedPlan(plan);
    manifest.status = "executed";
    manifest.executedAt = new Date().toISOString();
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    console.table(plan.table);
    console.log(`\nSeed complete. Manifest: ${manifestPath}`);
    return { dryRun: false, plan, manifestPath };
  } finally {
    await mongoose.disconnect();
  }
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runSeedCli().catch((error) => {
    console.error(`Seed failed: ${error.message}`);
    process.exitCode = 1;
  });
}
