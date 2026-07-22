import test from "node:test";
import assert from "node:assert/strict";
import dns from "node:dns";
import mongoose from "mongoose";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { CUSTOM_DNS_SERVERS, configureCustomDns } from "../src/config/custom-dns.js";
import {
  SCENARIO_NAMES,
  applySeedPlan,
  assertDevelopmentEnvironment,
  assertRequiredSchemaPath,
  assertRequiredSchemas,
  assertSeedBatchAvailable,
  buildReproductionLifecyclePlan,
  createManifest,
  connectDevelopmentDatabase as connectSeedDatabase,
  hasRequiredSchemaPath,
  resolveSeedUsers,
  validateSeedPlan,
} from "../scripts/seed-reproduction-lifecycle.js";
import {
  buildCleanupOperations,
  cleanupFromManifest,
  connectDevelopmentDatabase as connectCleanupDatabase,
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

test("Reproduction lifecycle connections configure custom DNS before connecting", async () => {
  const originalServers = dns.getServers();
  const originalFlag = process.env.FORCE_CUSTOM_DNS;
  const originalEnvironment = process.env.NODE_ENV;
  let writes = 0;
  try {
    process.env.FORCE_CUSTOM_DNS = "true";
    process.env.NODE_ENV = "test";
    const mongooseClient = {
      connect: async () => {
        assert.deepEqual(dns.getServers(), CUSTOM_DNS_SERVERS);
        return { connection: { name: "development-test" } };
      },
      disconnect: async () => { writes += 1; },
    };
    await connectSeedDatabase({ uri: "mongodb://example.invalid/test", mongooseClient });
    await connectCleanupDatabase({ uri: "mongodb://example.invalid/test", mongooseClient });
    assert.equal(writes, 0);
  } finally {
    dns.setServers(originalServers);
    if (originalFlag === undefined) delete process.env.FORCE_CUSTOM_DNS;
    else process.env.FORCE_CUSTOM_DNS = originalFlag;
    if (originalEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnvironment;
  }
});

test("Custom DNS remains unchanged without the opt-in flag and in production", () => {
  const calls = [];
  const dnsModule = {
    getServers: () => ["192.0.2.53"],
    setServers: (servers) => calls.push(servers),
  };
  assert.deepEqual(configureCustomDns({ forceCustomDns: "", environment: "development", dnsModule }), {
    enabled: false,
    servers: ["192.0.2.53"],
  });
  assert.deepEqual(configureCustomDns({ forceCustomDns: "true", environment: "production", dnsModule }), {
    enabled: false,
    servers: ["192.0.2.53"],
  });
  assert.deepEqual(calls, []);
});

test("Reproduction seeder: current schemas and pregnancy diagnosis leaf paths pass validation", () => {
  assert.doesNotThrow(() => assertRequiredSchemas());
  assert.equal(hasRequiredSchemaPath(Pregnancy.schema, "pregnancyDiagnosis.date"), true);
  assert.equal(hasRequiredSchemaPath(Pregnancy.schema, "pregnancyDiagnosis.result"), true);
});

test("Reproduction seeder: schema validation rejects a genuinely missing leaf path", () => {
  assert.equal(hasRequiredSchemaPath(Pregnancy.schema, "pregnancyDiagnosis.missingLeaf"), false);
  assert.equal(hasRequiredSchemaPath(Pregnancy.schema, "pregnancyDiagnosis", { allowNestedContainer: true }), true);
  assert.throws(
    () => assertRequiredSchemaPath("Pregnancy", Pregnancy.schema, "pregnancyDiagnosis.missingLeaf"),
    /Required schema path is missing: Pregnancy\.pregnancyDiagnosis\.missingLeaf/,
  );
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

test("Reproduction seeder: an existing pregnancy cannot retain an open initial diagnosis task", () => {
  const plan = buildPlan();
  const scenario = plan.scenarios.find((item) => item.scenario === "RC26-08-PREGNANT");
  const initialDiagnosisTask = scenario.tasks.find((item) => item.taskType === "PD");
  initialDiagnosisTask.status = "Pending";
  initialDiagnosisTask.completedAt = null;

  assert.throws(
    () => validateSeedPlan(plan),
    /existing pregnancy left an open initial diagnosis task/i,
  );
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
