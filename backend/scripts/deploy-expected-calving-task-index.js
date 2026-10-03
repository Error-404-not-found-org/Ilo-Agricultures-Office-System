import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { MongoClient } from "mongodb";

import { ENV } from "../src/config/env.js";
import {
  AUTOMATIC_EXPECTED_CALVING_INDEX,
  automaticExpectedCalvingIndexOptions,
} from "../src/domain/expected-calving-task-index.js";

const MATCHING_TASK_FILTER = Object.freeze({
  taskType: "CD",
  sourceType: "automatic_expected_calving",
});

const idString = (value) => {
  if (value == null) return null;
  if (value?._bsontype !== "ObjectId" || typeof value.toHexString !== "function") {
    return null;
  }
  try {
    return value.toHexString();
  } catch {
    return null;
  }
};

const matchesAutomaticExpectedCalving = (task) =>
  task?.taskType === MATCHING_TASK_FILTER.taskType &&
  task?.sourceType === MATCHING_TASK_FILTER.sourceType;

export const auditAutomaticExpectedCalvingTasks = (tasks = []) => {
  const matchingTasks = tasks.filter(matchesAutomaticExpectedCalving);
  const malformedTasks = [];
  const byPregnancy = new Map();

  for (const task of matchingTasks) {
    const taskId = idString(task?._id) || String(task?._id ?? "unknown");
    const metadata = task?.metadata;
    if (!metadata || !("pregnancyId" in metadata)) {
      malformedTasks.push({ taskId, status: task?.status || null, reason: "missing" });
      continue;
    }
    if (metadata.pregnancyId == null) {
      malformedTasks.push({ taskId, status: task?.status || null, reason: "null" });
      continue;
    }
    const pregnancyId = idString(metadata.pregnancyId);
    if (!pregnancyId) {
      malformedTasks.push({ taskId, status: task?.status || null, reason: "invalid_type" });
      continue;
    }
    const group = byPregnancy.get(pregnancyId) || {
      pregnancyId,
      taskIds: [],
      statuses: [],
    };
    group.taskIds.push(taskId);
    group.statuses.push(task?.status || null);
    byPregnancy.set(pregnancyId, group);
  }

  const duplicateGroups = [...byPregnancy.values()].filter(
    (group) => group.taskIds.length > 1,
  );
  return {
    safe: malformedTasks.length === 0 && duplicateGroups.length === 0,
    matchingTaskCount: matchingTasks.length,
    malformedTasks,
    duplicateGroups,
  };
};

export const compareExpectedCalvingIndex = (databaseIndex) => {
  const differences = [];
  if (databaseIndex?.name !== AUTOMATIC_EXPECTED_CALVING_INDEX.name) {
    differences.push("name");
  }
  if (!isDeepStrictEqual(databaseIndex?.key, AUTOMATIC_EXPECTED_CALVING_INDEX.key)) {
    differences.push("key");
  }
  if (databaseIndex?.unique !== AUTOMATIC_EXPECTED_CALVING_INDEX.unique) {
    differences.push("unique");
  }
  if (!isDeepStrictEqual(
    databaseIndex?.partialFilterExpression,
    AUTOMATIC_EXPECTED_CALVING_INDEX.partialFilterExpression,
  )) {
    differences.push("partialFilterExpression");
  }
  return { matches: differences.length === 0, differences };
};

const maintenanceError = (message, code, details) =>
  Object.assign(new Error(message), { code, details });

export const runExpectedCalvingIndexMaintenance = async ({
  collection,
  mode = "check",
  logger = console,
}) => {
  if (!new Set(["check", "apply"]).has(mode)) {
    throw maintenanceError(
      `Unsupported mode: ${mode}`,
      "EXPECTED_CALVING_INDEX_MODE_INVALID",
    );
  }

  const tasks = await collection.find(MATCHING_TASK_FILTER, {
    projection: { _id: 1, taskType: 1, sourceType: 1, status: 1, metadata: 1 },
  }).toArray();
  const audit = auditAutomaticExpectedCalvingTasks(tasks);
  logger.log(JSON.stringify({ preflight: audit }, null, 2));
  if (!audit.safe) {
    throw maintenanceError(
      "DATA BLOCKS INDEX CREATION",
      "EXPECTED_CALVING_INDEX_DATA_UNSAFE",
      audit,
    );
  }

  const indexes = await collection.indexes();
  const existing = indexes.find(
    (index) => index.name === AUTOMATIC_EXPECTED_CALVING_INDEX.name,
  );
  if (existing) {
    const comparison = compareExpectedCalvingIndex(existing);
    if (!comparison.matches) {
      throw maintenanceError(
        "INDEX EXISTS BUT DEFINITION DIFFERS",
        "EXPECTED_CALVING_INDEX_DEFINITION_MISMATCH",
        comparison,
      );
    }
    return { status: "INDEX ALREADY CORRECT", audit, comparison };
  }

  if (mode === "check") {
    return { status: "SAFE TO APPLY — INDEX MISSING", audit };
  }

  await collection.createIndex(
    AUTOMATIC_EXPECTED_CALVING_INDEX.key,
    automaticExpectedCalvingIndexOptions(),
  );
  const created = (await collection.indexes()).find(
    (index) => index.name === AUTOMATIC_EXPECTED_CALVING_INDEX.name,
  );
  const comparison = compareExpectedCalvingIndex(created);
  if (!comparison.matches) {
    throw maintenanceError(
      "CREATED INDEX FAILED VERIFICATION",
      "EXPECTED_CALVING_INDEX_VERIFICATION_FAILED",
      comparison,
    );
  }
  return { status: "INDEX CREATED AND VERIFIED", audit, comparison };
};

const resolveMode = (args) => {
  const apply = args.includes("--apply");
  const check = args.includes("--check");
  if (apply && check) {
    throw maintenanceError(
      "Choose either --check or --apply, not both.",
      "EXPECTED_CALVING_INDEX_MODE_INVALID",
    );
  }
  return apply ? "apply" : "check";
};

const main = async () => {
  const mode = resolveMode(process.argv.slice(2));
  const isProduction = process.env.NODE_ENV === "production";
  const uri = isProduction ? ENV.DB_URL : ENV.DB_URL_DEV || ENV.DB_URL;
  if (!uri) throw new Error("Database connection string is missing.");

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const result = await runExpectedCalvingIndexMaintenance({
      collection: client.db().collection("tasks"),
      mode,
    });
    console.log(result.status);
  } finally {
    await client.close();
  }
};

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(error.message);
    if (error.details) console.error(JSON.stringify(error.details, null, 2));
    process.exitCode = 1;
  });
}
