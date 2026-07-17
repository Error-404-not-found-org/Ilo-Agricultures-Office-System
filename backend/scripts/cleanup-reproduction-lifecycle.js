/**
 * Manifest-only cleanup for seed-reproduction-lifecycle.js.
 * Dry-run is the default; pass --execute to delete exact manifest IDs.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { ENV } from "../src/config/env.js";
import { Animal } from "../src/models/animal.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Calving } from "../src/models/calving.model.js";
import { Task } from "../src/models/task.model.js";
import { Notification } from "../src/models/notification.model.js";
import { AnimalTimelineEvent } from "../src/models/animal-timeline-event.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import { SCENARIO_NAMES, SEED_PREFIX, assertDevelopmentEnvironment } from "./seed-reproduction-lifecycle.js";

const MODELS = { Animal, Insemination, Pregnancy, Calving, Task, Notification, AnimalTimelineEvent, AuditLog };
const ID_FIELDS = Object.freeze([
  "insertedAnimalIds", "insertedInseminationIds", "insertedPregnancyIds", "insertedCalvingIds",
  "insertedTaskIds", "insertedNotificationIds", "insertedTimelineIds", "insertedAuditIds", "offspringIds",
  "motherAnimalIds",
]);
const knownTransactionError = (error) => /Transaction numbers are only allowed|replica set|mongos/i.test(error?.message || "");

export const parseCleanupArgs = (argv = process.argv.slice(2)) => {
  const manifestArg = argv.find((arg) => arg.startsWith("--manifest="));
  return { manifestPath: manifestArg?.slice("--manifest=".length) || "", execute: argv.includes("--execute") };
};

export const validateManifest = (manifest) => {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error("Manifest must be a JSON object.");
  if (manifest.manifestVersion !== 1 || !manifest.seedBatch || !manifest.databaseName) throw new Error("Manifest header is missing or unsupported.");
  if (!manifest.farmer?.id || !manifest.technician?.id) throw new Error("Manifest account identity is incomplete.");
  if (!Array.isArray(manifest.scenarioNames) || manifest.scenarioNames.length !== SCENARIO_NAMES.length ||
      manifest.scenarioNames.some((value, index) => value !== SCENARIO_NAMES[index])) {
    throw new Error("Manifest scenario list does not match the lifecycle seeder.");
  }
  if (!Array.isArray(manifest.earTags) || !manifest.earTags.length || manifest.earTags.some((value) => !String(value).startsWith(SEED_PREFIX))) {
    throw new Error(`Manifest ear tags must all use the ${SEED_PREFIX} prefix.`);
  }
  for (const field of ID_FIELDS) {
    if (!Array.isArray(manifest[field])) throw new Error(`Manifest field must be an array: ${field}`);
    if (manifest[field].some((value) => !mongoose.isValidObjectId(value))) throw new Error(`Manifest contains an invalid ObjectId in ${field}.`);
    if (new Set(manifest[field]).size !== manifest[field].length) throw new Error(`Manifest contains duplicate IDs in ${field}.`);
  }
  const motherSet = new Set(manifest.motherAnimalIds);
  if (manifest.offspringIds.some((value) => motherSet.has(value))) throw new Error("Manifest mixes mother and offspring IDs.");
  const insertedAnimals = new Set(manifest.insertedAnimalIds);
  if ([...manifest.motherAnimalIds, ...manifest.offspringIds].some((value) => !insertedAnimals.has(value))) {
    throw new Error("Manifest animal subsets are not contained in insertedAnimalIds.");
  }
  return manifest;
};

export const loadManifest = async (manifestPath, readFile = fs.readFile) => {
  if (!manifestPath) throw new Error("--manifest=<path> is required.");
  let raw;
  try {
    raw = await readFile(path.resolve(manifestPath), "utf8");
  } catch (error) {
    throw new Error(`Manifest could not be read: ${error.message}`);
  }
  try {
    return validateManifest(JSON.parse(raw));
  } catch (error) {
    throw new Error(`Manifest is malformed: ${error.message}`);
  }
};

const ids = (values) => values.map((value) => new mongoose.Types.ObjectId(value));

export const buildCleanupOperations = (manifest) => {
  validateManifest(manifest);
  return [
    { name: "notifications", model: "Notification", filter: { _id: { $in: ids(manifest.insertedNotificationIds) } } },
    { name: "audits", model: "AuditLog", filter: { _id: { $in: ids(manifest.insertedAuditIds) } } },
    { name: "timelines", model: "AnimalTimelineEvent", filter: { _id: { $in: ids(manifest.insertedTimelineIds) } } },
    { name: "tasks", model: "Task", filter: { _id: { $in: ids(manifest.insertedTaskIds) } } },
    { name: "calvings", model: "Calving", filter: { _id: { $in: ids(manifest.insertedCalvingIds) } } },
    { name: "pregnancies", model: "Pregnancy", filter: { _id: { $in: ids(manifest.insertedPregnancyIds) } } },
    { name: "inseminations", model: "Insemination", filter: { _id: { $in: ids(manifest.insertedInseminationIds) } } },
    { name: "offspring", model: "Animal", filter: { _id: { $in: ids(manifest.offspringIds) } } },
    { name: "mothers", model: "Animal", filter: { _id: { $in: ids(manifest.motherAnimalIds) } } },
  ];
};

export const cleanupFromManifest = async ({ manifest, models = MODELS, session = null }) => {
  const operations = buildCleanupOperations(manifest);
  const options = session ? { session } : {};
  const results = [];
  for (const operation of operations) {
    if (operation.filter._id.$in.length === 0) {
      results.push({ collection: operation.name, deletedCount: 0 });
      continue;
    }
    const result = await models[operation.model].deleteMany(operation.filter, options);
    results.push({ collection: operation.name, deletedCount: result.deletedCount || 0 });
  }
  return results;
};

const connectDevelopmentDatabase = async () => {
  const uri = ENV.DB_URL_DEV || ENV.DB_URL;
  if (!uri) throw new Error("Development database connection string is missing.");
  const connection = await mongoose.connect(uri, { autoIndex: false });
  const name = connection.connection.name;
  if (/prod/i.test(name) || name === "IloIlo-BreeedSmart-DB") {
    await mongoose.disconnect();
    throw new Error(`Refusing database whose name appears production-like: ${name}`);
  }
  return connection;
};

export const runCleanupCli = async (argv = process.argv.slice(2)) => {
  const args = parseCleanupArgs(argv);
  const environment = process.env.NODE_ENV || "development";
  assertDevelopmentEnvironment(environment);
  // Manifest parsing and validation deliberately happen before any DB connection.
  if (!args.manifestPath) throw new Error("--manifest=<path> is required.");
  const manifestPath = path.resolve(args.manifestPath || "");
  const backupRoot = path.resolve(process.cwd(), "backups");
  if (path.dirname(manifestPath) !== backupRoot || !/^reproduction-lifecycle-seed-.+\.json$/.test(path.basename(manifestPath))) {
    throw new Error(`Manifest must be a reproduction-lifecycle-seed JSON file directly under ${backupRoot}.`);
  }
  const manifest = await loadManifest(args.manifestPath);
  const operations = buildCleanupOperations(manifest);
  console.log(`\nMode: ${args.execute ? "EXECUTE" : "DRY RUN"}`);
  console.log(`Seed batch: ${manifest.seedBatch}`);
  console.table(operations.map((item) => ({ collection: item.name, ids: item.filter._id.$in.length })));

  const connection = await connectDevelopmentDatabase();
  try {
    if (connection.connection.name !== manifest.databaseName) {
      throw new Error(`Manifest database ${manifest.databaseName} does not match connected database ${connection.connection.name}.`);
    }
    const counts = [];
    for (const operation of operations) {
      const count = operation.filter._id.$in.length
        ? await MODELS[operation.model].countDocuments(operation.filter)
        : 0;
      counts.push({ collection: operation.name, listedIds: operation.filter._id.$in.length, existing: count });
    }
    console.table(counts);
    if (!args.execute) {
      console.log("Dry-run cleanup complete. No database or manifest writes occurred.");
      return { dryRun: true, counts };
    }

    let results;
    const session = await mongoose.startSession();
    try {
      try {
        await session.withTransaction(async () => { results = await cleanupFromManifest({ manifest, session }); });
      } catch (error) {
        if (!knownTransactionError(error)) throw error;
        console.warn("Transactions are unavailable; deleting in dependency order using manifest IDs only.");
        results = await cleanupFromManifest({ manifest });
      }
    } finally {
      await session.endSession();
    }
    manifest.status = "cleaned";
    manifest.cleanedAt = new Date().toISOString();
    manifest.cleanupResults = results;
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    console.table(results);
    console.log("Cleanup complete. Only manifest-listed IDs were targeted.");
    return { dryRun: false, results };
  } finally {
    await mongoose.disconnect();
  }
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runCleanupCli().catch((error) => {
    console.error(`Cleanup failed: ${error.message}`);
    process.exitCode = 1;
  });
}
