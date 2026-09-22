import assert from "node:assert/strict";
import test from "node:test";
import { ObjectId } from "mongodb";

import {
  auditAutomaticExpectedCalvingTasks,
  compareExpectedCalvingIndex,
  runExpectedCalvingIndexMaintenance,
} from "../scripts/deploy-expected-calving-task-index.js";
import {
  AUTOMATIC_EXPECTED_CALVING_INDEX,
} from "../src/domain/expected-calving-task-index.js";

const task = ({
  id = new ObjectId(),
  pregnancyId = new ObjectId(),
  taskType = "CD",
  sourceType = "automatic_expected_calving",
  status = "Pending",
} = {}) => ({
  _id: id,
  taskType,
  sourceType,
  status,
  metadata: pregnancyId === undefined ? {} : { pregnancyId },
});

const correctDatabaseIndex = () => ({
  v: 2,
  key: { ...AUTOMATIC_EXPECTED_CALVING_INDEX.key },
  name: AUTOMATIC_EXPECTED_CALVING_INDEX.name,
  unique: true,
  partialFilterExpression: {
    ...AUTOMATIC_EXPECTED_CALVING_INDEX.partialFilterExpression,
  },
});

const fakeCollection = ({ tasks = [], indexes = [] } = {}) => {
  const calls = { createIndex: [], dropIndex: [] };
  let currentIndexes = [...indexes];
  return {
    calls,
    find() {
      return { toArray: async () => tasks };
    },
    async indexes() {
      return currentIndexes;
    },
    async createIndex(key, options) {
      calls.createIndex.push({ key, options });
      currentIndexes = [
        ...currentIndexes,
        { key, ...options },
      ];
      return options.name;
    },
    async dropIndex(...args) {
      calls.dropIndex.push(args);
    },
  };
};

test("preflight detects duplicate automatic Expected Calving Pregnancy identities", () => {
  const pregnancyId = new ObjectId();
  const first = task({ pregnancyId, status: "Completed" });
  const second = task({ pregnancyId, status: "Cancelled" });

  const audit = auditAutomaticExpectedCalvingTasks([first, second]);

  assert.equal(audit.safe, false);
  assert.equal(audit.duplicateGroups.length, 1);
  assert.equal(audit.duplicateGroups[0].pregnancyId, pregnancyId.toHexString());
  assert.deepEqual(audit.duplicateGroups[0].taskIds, [
    first._id.toHexString(),
    second._id.toHexString(),
  ]);
  assert.deepEqual(audit.duplicateGroups[0].statuses, ["Completed", "Cancelled"]);
});

test("preflight accepts unique automatic identities and ignores unrelated work", () => {
  const valid = task();
  const audit = auditAutomaticExpectedCalvingTasks([
    valid,
    task({ sourceType: "manual", pregnancyId: undefined }),
    task({ sourceType: "task_scheduler", pregnancyId: undefined }),
    task({ taskType: "PD", pregnancyId: undefined }),
  ]);

  assert.equal(audit.safe, true);
  assert.equal(audit.matchingTaskCount, 1);
  assert.deepEqual(audit.malformedTasks, []);
  assert.deepEqual(audit.duplicateGroups, []);
});

test("preflight rejects missing, null, and non-ObjectId Pregnancy identities", () => {
  const missing = task();
  delete missing.metadata.pregnancyId;
  const nullIdentity = task({ pregnancyId: null });
  const stringIdentity = task({ pregnancyId: new ObjectId().toHexString() });

  const audit = auditAutomaticExpectedCalvingTasks([
    missing,
    nullIdentity,
    stringIdentity,
  ]);

  assert.equal(audit.safe, false);
  assert.deepEqual(
    audit.malformedTasks.map(({ taskId, reason }) => ({ taskId, reason })),
    [
      { taskId: missing._id.toHexString(), reason: "missing" },
      { taskId: nullIdentity._id.toHexString(), reason: "null" },
      { taskId: stringIdentity._id.toHexString(), reason: "invalid_type" },
    ],
  );
});

test("index comparison recognizes the exact contract and rejects same-name drift", () => {
  assert.equal(compareExpectedCalvingIndex(correctDatabaseIndex()).matches, true);

  const mismatched = correctDatabaseIndex();
  mismatched.partialFilterExpression = {
    taskType: "CD",
    sourceType: "automatic_expected_calving",
  };
  const comparison = compareExpectedCalvingIndex(mismatched);
  assert.equal(comparison.matches, false);
  assert.ok(comparison.differences.includes("partialFilterExpression"));
});

test("apply is idempotent when the correct index already exists", async () => {
  const collection = fakeCollection({
    tasks: [task()],
    indexes: [correctDatabaseIndex()],
  });

  const result = await runExpectedCalvingIndexMaintenance({
    collection,
    mode: "apply",
    logger: { log() {}, error() {} },
  });

  assert.equal(result.status, "INDEX ALREADY CORRECT");
  assert.equal(collection.calls.createIndex.length, 0);
  assert.equal(collection.calls.dropIndex.length, 0);
});

test("apply refuses unsafe data and never creates, drops, or replaces an index", async () => {
  const pregnancyId = new ObjectId();
  const collection = fakeCollection({
    tasks: [task({ pregnancyId }), task({ pregnancyId })],
  });

  await assert.rejects(
    () => runExpectedCalvingIndexMaintenance({
      collection,
      mode: "apply",
      logger: { log() {}, error() {} },
    }),
    (error) => error.code === "EXPECTED_CALVING_INDEX_DATA_UNSAFE",
  );
  assert.equal(collection.calls.createIndex.length, 0);
  assert.equal(collection.calls.dropIndex.length, 0);
});

test("apply refuses a mismatched same-name index without replacing it", async () => {
  const mismatched = correctDatabaseIndex();
  mismatched.unique = false;
  const collection = fakeCollection({ tasks: [task()], indexes: [mismatched] });

  await assert.rejects(
    () => runExpectedCalvingIndexMaintenance({
      collection,
      mode: "apply",
      logger: { log() {}, error() {} },
    }),
    (error) => error.code === "EXPECTED_CALVING_INDEX_DEFINITION_MISMATCH",
  );
  assert.equal(collection.calls.createIndex.length, 0);
  assert.equal(collection.calls.dropIndex.length, 0);
});

test("check is read-only and apply creates then verifies the missing index", async () => {
  const collection = fakeCollection({ tasks: [task()] });

  const check = await runExpectedCalvingIndexMaintenance({
    collection,
    mode: "check",
    logger: { log() {}, error() {} },
  });
  assert.equal(check.status, "SAFE TO APPLY — INDEX MISSING");
  assert.equal(collection.calls.createIndex.length, 0);

  const apply = await runExpectedCalvingIndexMaintenance({
    collection,
    mode: "apply",
    logger: { log() {}, error() {} },
  });
  assert.equal(apply.status, "INDEX CREATED AND VERIFIED");
  assert.equal(collection.calls.createIndex.length, 1);
  assert.equal(collection.calls.dropIndex.length, 0);
});
