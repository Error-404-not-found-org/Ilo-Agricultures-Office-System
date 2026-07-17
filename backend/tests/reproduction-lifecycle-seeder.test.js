import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  SCENARIO_NAMES,
  applySeedPlan,
  assertDevelopmentEnvironment,
  assertSeedBatchAvailable,
  buildReproductionLifecyclePlan,
  createManifest,
  resolveSeedUsers,
  validateSeedPlan,
} from "../scripts/seed-reproduction-lifecycle.js";
import {
  buildCleanupOperations,
  cleanupFromManifest,
  loadManifest,
  validateManifest,
} from "../scripts/cleanup-reproduction-lifecycle.js";

const buildPlan = () => buildReproductionLifecyclePlan({
  farmer: { _id: new mongoose.Types.ObjectId(), email: "farmer@example.test" },
  technician: { _id: new mongoose.Types.ObjectId(), email: "technician@example.test" },
  now: new Date("2026-07-17T00:00:00.000Z"),
  seedBatch: "repro-test-123456",
});

const buildManifest = () => {
  const plan = buildPlan();
  return createManifest({
    plan,
    databaseName: "development-test",
    environment: "test",
    manifestPath: "C:/tmp/reproduction-manifest.json",
  });
};

test("Reproduction seeder: dry-run performs no writes", async () => {
  let calls = 0;
  const result = await applySeedPlan({
    execute: false,
    plan: buildPlan(),
    writer: async () => { calls += 1; },
  });
  assert.equal(result.dryRun, true);
  assert.equal(result.writes, 0);
  assert.equal(calls, 0);
});

test("Reproduction seeder: production environment is rejected before work", () => {
  assert.throws(() => assertDevelopmentEnvironment("production"), /NODE_ENV=production/);
  assert.doesNotThrow(() => assertDevelopmentEnvironment("development"));
});

test("Reproduction seeder: an existing seed batch is refused", async () => {
  await assert.rejects(assertSeedBatchAvailable({
    plan: buildPlan(),
    AuditLogModel: { exists: async () => ({ _id: new mongoose.Types.ObjectId() }) },
    AnimalModel: { exists: async () => null },
  }), /batch already exists/i);
});

test("Reproduction seeder: missing farmer and technician are rejected", async () => {
  const UserModel = { findOne: async () => null };
  await assert.rejects(
    resolveSeedUsers({ UserModel, farmerEmail: "missing@example.test", technicianEmail: "tech@example.test" }),
    /farmer account not found/i,
  );
  const farmerOnly = {
    findOne: async (query) => query.role === "farmer"
      ? { _id: new mongoose.Types.ObjectId(), email: query.email, role: "farmer" }
      : null,
  };
  await assert.rejects(
    resolveSeedUsers({ UserModel: farmerOnly, farmerEmail: "farmer@example.test", technicianEmail: "missing@example.test" }),
    /technician account not found/i,
  );
});

test("Reproduction seeder: scenario identifiers, ear tags, and chronology are valid", () => {
  const plan = buildPlan();
  assert.equal(validateSeedPlan(plan), true);
  assert.deepEqual(plan.scenarios.map((item) => item.scenario), SCENARIO_NAMES);
  assert.equal(new Set(plan.scenarios.map((item) => item.scenario)).size, 16);
  assert.equal(new Set(plan.collections.animals.map((item) => item.earTag.toLowerCase())).size, plan.collections.animals.length);
  const activeKeys = plan.collections.inseminations.map((item) => item.activeRequestKey).filter(Boolean);
  assert.equal(new Set(activeKeys).size, activeKeys.length);
  for (const scenario of plan.scenarios) {
    for (const pregnancy of scenario.pregnancies) {
      const insemination = scenario.inseminations.find((item) => String(item._id) === String(pregnancy.inseminationId));
      assert.ok(insemination);
      assert.ok(pregnancy.pregnancyDiagnosis.date >= insemination.inseminationDate);
    }
    for (const calving of scenario.calvings) {
      const pregnancy = scenario.pregnancies.find((item) => String(item._id) === String(calving.pregnancyId));
      assert.ok(calving.date >= pregnancy.pregnancyDiagnosis.date);
    }
  }
});

test("Reproduction seeder: canonical next actions match key manual-test stages", () => {
  const table = new Map(buildPlan().table.map((row) => [row.Scenario, row]));
  assert.equal(table.get("RC26-04-AI-DAY10")["Next type"], "MONITOR_RETURN_TO_HEAT");
  assert.equal(table.get("RC26-07-PD-DUE")["Next type"], "PERFORM_PREGNANCY_DIAGNOSIS");
  assert.equal(table.get("RC26-08-PREGNANT")["Next phase"], "PREGNANT");
  assert.equal(table.get("RC26-09-CALVING-DUE")["Next phase"], "CALVING_DUE");
  assert.equal(table.get("RC26-11-POSTPARTUM")["Next phase"], "RECOVERY_PERIOD");
});

test("Reproduction seeder: re-insemination attempt series linkage is valid", () => {
  const scenario = buildPlan().scenarios.find((item) => item.scenario === "RC26-16-ATTEMPT-2");
  const [attempt1, attempt2] = scenario.inseminations;
  assert.equal(attempt1.attemptNumber, 1);
  assert.equal(attempt2.attemptNumber, 2);
  assert.equal(String(attempt2.previousAttemptId), String(attempt1._id));
  assert.equal(String(attempt2.attemptSeriesId), String(attempt1.attemptSeriesId));
  assert.equal(attempt1.outcome, "Failed (Re-heat)");
  assert.equal(attempt1.failureReason, "return_to_heat");
});

test("Reproduction seeder: stillbirth and abortion create no living offspring", () => {
  const plan = buildPlan();
  for (const scenarioName of ["RC26-12-STILLBIRTH", "RC26-13-ABORTION"]) {
    const scenario = plan.scenarios.find((item) => item.scenario === scenarioName);
    assert.equal(scenario.offspring.length, 0);
    assert.equal(scenario.calvings[0].livingCalfCount, 0);
    assert.equal(scenario.calvings[0].calves.length, 0);
  }
  const abortion = plan.scenarios.find((item) => item.scenario === "RC26-13-ABORTION");
  assert.equal(abortion.animal.parity, 0);
  assert.ok(abortion.animal.lastPregnancyLossDate);
  assert.doesNotMatch(plan.collections.notifications.find((item) => String(item.relatedId) === String(abortion.calvings[0]._id)).message, /congrat/i);
});

test("Reproduction seeder: mixed builder separates living and non-living offspring", () => {
  const scenario = buildPlan().scenarios.find((item) => item.scenario === "RC26-14-MIXED");
  const calving = scenario.calvings[0];
  assert.equal(scenario.offspring.length, 1);
  assert.equal(calving.calves.length, 1);
  assert.equal(calving.nonLivingCalves.length, 1);
  assert.equal(calving.totalDelivered, 2);
  assert.equal(calving.numberOfCalves, 2);
  assert.equal(calving.livingCalfCount, 1);
  assert.equal(calving.stillbornCount, 1);
});

test("Reproduction cleanup: operations use manifest IDs only and dependency order", () => {
  const operations = buildCleanupOperations(buildManifest());
  assert.deepEqual(operations.map((item) => item.name), [
    "notifications", "audits", "timelines", "tasks", "calvings",
    "pregnancies", "inseminations", "offspring", "mothers",
  ]);
  for (const operation of operations) {
    assert.deepEqual(Object.keys(operation.filter), ["_id"]);
    assert.deepEqual(Object.keys(operation.filter._id), ["$in"]);
  }
});

test("Reproduction cleanup: executor never broadens manifest filters", async () => {
  const calls = [];
  const model = { deleteMany: async (filter) => { calls.push(filter); return { deletedCount: filter._id.$in.length }; } };
  const models = {
    Animal: model, Insemination: model, Pregnancy: model, Calving: model,
    Task: model, Notification: model, AnimalTimelineEvent: model, AuditLog: model,
  };
  await cleanupFromManifest({ manifest: buildManifest(), models });
  assert.ok(calls.length > 0);
  assert.ok(calls.every((filter) => Object.keys(filter).length === 1 && Array.isArray(filter._id.$in)));
});

test("Reproduction cleanup: missing and malformed manifests are refused", async () => {
  await assert.rejects(loadManifest(""), /manifest=.*required/i);
  await assert.rejects(loadManifest("missing.json", async () => { throw new Error("ENOENT"); }), /could not be read/i);
  await assert.rejects(loadManifest("bad.json", async () => "not-json"), /malformed/i);
  assert.throws(() => validateManifest({ manifestVersion: 1, seedBatch: "x" }), /header|identity|array/i);
});
