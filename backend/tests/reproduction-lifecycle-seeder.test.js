import test from "node:test";
import assert from "node:assert/strict";
import dns from "node:dns";
import mongoose from "mongoose";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Calving } from "../src/models/calving.model.js";
import { Task } from "../src/models/task.model.js";
import { Config } from "../src/models/config.model.js";
import { getBreedingMilestones } from "../src/controllers/user.controllers.js";
import { selectNeedsAttention } from "../../mobile/features/farmer-dashboard/utils/farmerDashboard.transforms.ts";
import { CUSTOM_DNS_SERVERS, configureCustomDns } from "../src/config/custom-dns.js";
import {
  LEGACY_PREGNANCY_DIAGNOSIS_DAYS,
  LEGACY_PREGNANCY_POLICY_VERSION,
} from "../src/domain/pregnancy-confirmation-policy.js";
import {
  HEALTH_SCENARIO_NAMES,
  REPRODUCTIVE_SCENARIO_NAMES,
  SCENARIO_NAMES,
  SCENARIO_ALIASES,
  applySeedPlan,
  assertDevelopmentEnvironment,
  assertRequiredSchemaPath,
  assertRequiredSchemas,
  assertSeedBatchAvailable,
  buildReproductionLifecyclePlan,
  cleanupSingleScenario,
  createManifest,
  connectDevelopmentDatabase as connectSeedDatabase,
  hasRequiredSchemaPath,
  parseSeedArgs,
  resolveScenarioName,
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
  technician: {
    _id: new mongoose.Types.ObjectId(),
    email: "technician@example.test",
    role: "technician",
    status: "active",
    deletedAt: null,
  },
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

test("Reproduction seeder: Technician resolution excludes unavailable accounts", async () => {
  const queries = [];
  const UserModel = {
    findOne: async (query) => {
      queries.push(query);
      return {
        _id: new mongoose.Types.ObjectId(),
        email: query.email,
        role: query.role,
        status: "active",
        deletedAt: null,
      };
    },
  };

  await resolveSeedUsers({
    UserModel,
    farmerEmail: "farmer@example.test",
    technicianEmail: "technician@example.test",
  });

  const technicianQuery = queries.find((query) => query.role === "technician");
  assert.deepEqual(technicianQuery.status, {
    $nin: ["suspended", "deleted"],
  });
});

test("Reproduction seeder: scenario identifiers, ear tags, and chronology are valid", () => {
  const plan = buildPlan();
  assert.equal(validateSeedPlan(plan), true);
  assert.deepEqual(plan.scenarios.map((item) => item.scenario), SCENARIO_NAMES);
  assert.equal(
    new Set(plan.scenarios.map((item) => item.scenario)).size,
    SCENARIO_NAMES.length,
  );
  assert.equal(new Set(plan.collections.animals.map((item) => item.earTag.toLowerCase())).size, plan.collections.animals.length);
  assert.ok(plan.collections.animals.every((item) => item.imageUrl));
  assert.ok(new Set(plan.collections.animals.map((item) => item.imageUrl)).size >= 2);
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
  const scenario = plan.scenarios.find((item) => item.scenario === "RC26-08-PREGNANCY-LOSS-REVIEW");
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
  assert.equal(table.get("RC26-08-PREGNANCY-LOSS-REVIEW")["Next phase"], "PREGNANT");
  assert.equal(table.get("RC26-09-CALVING-DUE")["Next phase"], "CALVING_DUE");
  assert.equal(table.get("RC26-11-POSTPARTUM")["Next phase"], "RECOVERY_PERIOD");
});

test("Reproduction seeder: pending AI requests follow the unassigned request journey", () => {
  const plan = buildPlan();

  for (const scenarioName of ["RC26-02-AI-PENDING", "RC26-16-ATTEMPT-2"]) {
    const scenario = plan.scenarios.find(
      (item) => item.scenario === scenarioName,
    );
    const pending = scenario.inseminations.find(
      (item) => item.status === "pending",
    );

    assert.ok(pending);
    assert.equal(pending.technicianId, undefined);
    assert.equal(pending.approvedBy, undefined);
    assert.equal(pending.scheduledDate, undefined);
    assert.equal(pending.visitPeriod, undefined);
    assert.equal(pending.estrus, undefined);
    assert.equal(pending.sireBreed, undefined);
    assert.equal(pending.sireCode, undefined);
    assert.ok(pending.heatSigns.length > 0);
    assert.match(scenario.expectedResult, /Accept & Set Visit/);
  }
});

test("Reproduction seeder: follow-ups omit invented periods and Health visits preserve explicit periods", () => {
  const plan = buildPlan();
  const genericFollowUps = plan.collections.tasks.filter((task) =>
    ["PD", "CD", "Calving"].includes(task.taskType),
  );
  const healthVisits = plan.collections.tasks.filter(
    (task) => task.taskType === "Health",
  );

  assert.ok(genericFollowUps.length > 0);
  assert.ok(
    genericFollowUps.every((task) => task.metadata?.visitPeriod === undefined),
  );
  assert.deepEqual(
    healthVisits.map((task) => task.metadata?.visitPeriod).sort(),
    ["afternoon", "morning", "morning"],
  );
});

test("Reproduction seeder: confirmed pregnancies include canonical technician attribution", () => {
  const plan = buildPlan();

  assert.ok(plan.collections.pregnancies.length > 0);
  for (const pregnancy of plan.collections.pregnancies) {
    assert.equal(
      String(pregnancy.confirmation.confirmedBy),
      String(plan.technician._id),
    );
    assert.equal(
      pregnancy.confirmation.confirmedAt,
      pregnancy.pregnancyDiagnosis.date,
    );
    assert.equal(
      pregnancy.confirmation.policyVersion,
      LEGACY_PREGNANCY_POLICY_VERSION,
    );
    assert.equal(
      pregnancy.confirmation.earliestThresholdSnapshot,
      LEGACY_PREGNANCY_DIAGNOSIS_DAYS,
    );
    assert.equal(pregnancy.confirmation.stage, "legacy_unclassified");
    assert.equal(pregnancy.confirmation.recheckRequired, false);
    assert.equal(pregnancy.recheckStatus, "not_required");
  }
});

test("Reproduction seeder: farmer observation scenarios cover the technician handoff states", () => {
  const plan = buildPlan();
  const day10 = plan.scenarios.find(
    (item) => item.scenario === "RC26-04-AI-DAY10",
  );
  const day21 = plan.scenarios.find(
    (item) => item.scenario === "RC26-05-AI-DAY21",
  );
  const likelyPregnant = plan.scenarios.find(
    (item) => item.scenario === "RC26-06-LIKELY-PREGNANT",
  );

  assert.equal(day10.inseminations[0].farmerOutcomeReport, "unsure");
  assert.equal(day10.inseminations[0].verificationRequested, false);
  assert.equal(day10.inseminations[0].verificationStatus, "not_requested");
  assert.equal(day10.inseminations[0].verificationTaskId, undefined);

  // SCENARIO A: RC26-05-AI-DAY21
  assert.equal(day21.animal.reproductiveStatus, "Inseminated");
  assert.notEqual(day21.animal.reproductiveStatus, "In Heat");
  assert.equal(day21.inseminations[0].status, "done");
  assert.equal(day21.inseminations[0].farmerOutcomeReport, "return_to_heat");
  assert.equal(day21.inseminations[0].outcome, "Pending");
  assert.notEqual(day21.inseminations[0].isSuccess, false);
  assert.equal(day21.inseminations[0].outcomeVerificationStatus, "reported");
  assert.equal(day21.inseminations[0].verificationStatus, "pending");
  assert.equal(day21.inseminations[0].verificationRequested, true);
  assert.ok(Array.isArray(day21.inseminations[0].evidencePhotos) && day21.inseminations[0].evidencePhotos.length > 0);
  assert.ok(day21.inseminations[0].evidencePhotos[0].startsWith("https://"));

  const day21PdTask = day21.tasks.find((task) => task.taskType === "PD");
  const day21ReturnToHeatTask = day21.tasks.find(
    (task) => task.taskType === "BreedingFollowUp",
  );
  assert.ok(day21PdTask);
  assert.ok(day21ReturnToHeatTask);
  assert.equal(
    day21ReturnToHeatTask.sourceType,
    "farmer_requested_verification",
  );
  assert.equal(day21ReturnToHeatTask.metadata.reportType, "return_to_heat");
  assert.equal(
    String(day21ReturnToHeatTask.technicianId),
    String(plan.technician._id),
  );
  assert.equal(
    String(day21PdTask.technicianId),
    String(plan.technician._id),
  );
  // verificationTaskId references the BreedingFollowUp task, NOT the PD task
  assert.equal(
    String(day21.inseminations[0].verificationTaskId),
    String(day21ReturnToHeatTask._id),
  );
  assert.notEqual(
    String(day21.inseminations[0].verificationTaskId),
    String(day21PdTask._id),
  );

  // Production-equivalent Timeline event for Scenario A
  const day21Timeline = day21.timelines.find(
    (item) => item.eventType === "farmer_breeding_observation_reported",
  );
  assert.ok(day21Timeline);
  assert.equal(day21Timeline.title, "Breeding observation reported");
  assert.deepEqual(day21Timeline.attachments, day21.inseminations[0].evidencePhotos);
  assert.equal(String(day21Timeline.animalId), String(day21.animal._id));
  assert.equal(String(day21Timeline.actorId), String(plan.farmer._id));
  assert.equal(String(day21Timeline.sourceId), String(day21.inseminations[0]._id));
  assert.equal(day21Timeline.metadata?.reportType, "return_to_heat");

  // No authoritative return-to-heat transition yet
  assert.equal(day21.pregnancies.length, 0);
  assert.notEqual(day21.inseminations[0].outcome, "Failed (Re-heat)");
  assert.equal(day21ReturnToHeatTask.status, "Pending");

  // SCENARIO B: RC26-06-LIKELY-PREGNANT
  assert.equal(likelyPregnant.animal.reproductiveStatus, "Inseminated");
  assert.notEqual(likelyPregnant.animal.reproductiveStatus, "Likely Pregnant");
  assert.notEqual(likelyPregnant.animal.reproductiveStatus, "Pregnant");
  assert.equal(likelyPregnant.inseminations[0].status, "done");
  assert.equal(likelyPregnant.inseminations[0].farmerPregnancyReport, true);
  assert.ok(likelyPregnant.inseminations[0].farmerPregnancyReportedAt instanceof Date);
  assert.ok(typeof likelyPregnant.inseminations[0].farmerPregnancyNotes === "string" && likelyPregnant.inseminations[0].farmerPregnancyNotes.length > 0);
  assert.ok(Array.isArray(likelyPregnant.inseminations[0].farmerPregnancyPhotos) && likelyPregnant.inseminations[0].farmerPregnancyPhotos.length > 0);
  assert.ok(likelyPregnant.inseminations[0].farmerPregnancyPhotos[0].startsWith("https://"));
  assert.equal(likelyPregnant.inseminations[0].pregnancyReportVerificationStatus, "pending");
  assert.equal(likelyPregnant.inseminations[0].evidencePhotos?.length || 0, 0);
  assert.ok(!likelyPregnant.inseminations[0].farmerOutcomeReport);

  // Day-60 PD task remains canonical
  assert.equal(likelyPregnant.tasks.length, 1);
  const pdTask = likelyPregnant.tasks[0];
  assert.equal(pdTask.taskType, "PD");
  assert.equal(pdTask.sourceType, "automatic_pd_followup");
  assert.equal(pdTask.status, "Pending");
  assert.equal(pdTask.metadata?.reportType, undefined);
  assert.equal(String(pdTask.metadata?.inseminationId), String(likelyPregnant.inseminations[0]._id));
  assert.equal(
    String(pdTask.technicianId),
    String(plan.technician._id),
  );

  // Timeline event for Scenario B
  const likelyPregnantTimeline = likelyPregnant.timelines.find(
    (item) => item.eventType === "farmer_breeding_observation_reported",
  );
  assert.ok(likelyPregnantTimeline);
  assert.equal(likelyPregnantTimeline.title, "Farmer reported pregnancy");
  assert.deepEqual(likelyPregnantTimeline.attachments, likelyPregnant.inseminations[0].farmerPregnancyPhotos);
  assert.equal(likelyPregnantTimeline.metadata?.isPregnancyReport, true);
  assert.equal(String(likelyPregnantTimeline.animalId), String(likelyPregnant.animal._id));
  assert.equal(String(likelyPregnantTimeline.actorId), String(plan.farmer._id));
  assert.equal(String(likelyPregnantTimeline.sourceId), String(likelyPregnant.inseminations[0]._id));

  // No Pregnancy record or Calving before diagnosis
  assert.equal(likelyPregnant.pregnancies.length, 0);
  assert.equal(likelyPregnant.calvings.length, 0);

  const day60 = plan.scenarios.find(
    (item) => item.scenario === "RC26-07-PD-DUE",
  );
  assert.equal(day60.tasks.length, 1);
  assert.equal(day60.tasks[0].taskType, "PD");
  assert.equal(day60.tasks[0].sourceType, "automatic_pd_followup");
  assert.equal(
    String(day60.tasks[0].technicianId),
    String(plan.technician._id),
  );

  const observationNotifications = plan.collections.notifications.filter(
    (item) => item.eventType === "technician_review_required",
  );
  assert.equal(observationNotifications.length, 2);
  assert.ok(
    observationNotifications.every(
      (item) =>
        String(item.recipientId) === String(plan.technician._id) &&
        item.metadata?.seedBatch === plan.seedBatch,
    ),
  );
  assert.equal(
    observationNotifications.find(
      (item) => item.metadata?.reportType === "unsure",
    ).metadata.taskId,
    null,
  );
  assert.ok(
    observationNotifications.find(
      (item) => item.metadata?.reportType === "return_to_heat",
    ).metadata.taskId,
  );
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
    "notifications", "audits", "timelines", "tasks", "medicalRecords",
    "healthRequests", "calvings",
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
    PregnancyLossReport: model, HealthRequest: model, MedicalRecord: model, Task: model,
    Notification: model, AnimalTimelineEvent: model, AuditLog: model,
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

test("Reproduction seeder: Scenario C (RC26-08-PREGNANCY-LOSS-REVIEW) represents canonically confirmed pregnancy", () => {
  const plan = buildPlan();
  const pregnant = plan.scenarios.find(
    (item) => item.scenario === "RC26-08-PREGNANCY-LOSS-REVIEW",
  );
  assert.ok(pregnant);
  assert.equal(pregnant.animal.reproductiveStatus, "Pregnant");
  assert.equal(pregnant.inseminations[0].outcome, "Pregnant");
  assert.equal(pregnant.inseminations[0].isSuccess, true);

  const pdTask = pregnant.tasks.find((task) => task.taskType === "PD");
  assert.ok(pdTask);
  assert.equal(pdTask.status, "Completed");
  assert.ok(pdTask.completedAt);

  assert.equal(pregnant.pregnancies.length, 1);
  const pregnancy = pregnant.pregnancies[0];
  assert.equal(String(pregnancy.animalId), String(pregnant.animal._id));
  assert.equal(String(pregnancy.inseminationId), String(pregnant.inseminations[0]._id));
  assert.equal(String(pregnancy.confirmation.confirmedBy), String(plan.technician._id));
  assert.equal(plan.technician.role, "technician");
  assert.equal(plan.technician.status, "active");
  assert.equal(plan.technician.deletedAt, null);
  assert.equal(pregnancy.pregnancyDiagnosis.result, "Pregnant");
  assert.equal(pregnancy.cycleStatus, "active");

  const insemination = pregnant.inseminations[0];
  const gestationDay = Math.round(
    (plan.now.getTime() - insemination.inseminationDate.getTime()) /
      (24 * 60 * 60 * 1000),
  );
  assert.equal(gestationDay, 150);
  assert.equal(insemination.breedingCycleStatus, "active");
  assert.equal(String(insemination.animalId), String(pregnant.animal._id));
  assert.equal(String(insemination.farmerId), String(plan.farmer._id));
  assert.equal(String(insemination.technicianId), String(plan.technician._id));
  assert.equal(String(pregnant.animal.farmerId), String(plan.farmer._id));
  assert.ok(pregnant.animal.expectedCalvingDate > plan.now);
  assert.equal(pregnant.pregnancyLossReports.length, 0);
  assert.equal(pregnant.calvings.length, 0);
  assert.equal(pregnant.animal.parity, 0);
  assert.equal(pregnant.animal.lastPregnancyLossDate, undefined);
  assert.notEqual(pregnant.animal.reproductiveStatus, "Post-partum");
  assert.equal(
    pregnant.tasks.some(
      (task) => task.sourceType === "farmer_pregnancy_loss_report",
    ),
    false,
  );
});

test("Reproduction seeder: CLI scenario option and aliases parse correctly", () => {
  assert.equal(resolveScenarioName("reheat"), "RC26-05-AI-DAY21");
  assert.equal(resolveScenarioName("pregnancy-report"), "RC26-06-LIKELY-PREGNANT");
  assert.equal(resolveScenarioName("pregnant"), "RC26-08-PREGNANCY-LOSS-REVIEW");
  assert.equal(
    resolveScenarioName("pregnancy-loss-review"),
    "RC26-08-PREGNANCY-LOSS-REVIEW",
  );
  assert.equal(
    resolveScenarioName("RC26-08-PREGNANT"),
    "RC26-08-PREGNANCY-LOSS-REVIEW",
  );
  assert.equal(resolveScenarioName("heat-check"), "RC26-23-HEAT-CHECK");
  assert.equal(resolveScenarioName("RC26-05-AI-DAY21"), "RC26-05-AI-DAY21");
  assert.equal(resolveScenarioName("RC26-23-HEAT-CHECK"), "RC26-23-HEAT-CHECK");
  assert.throws(() => resolveScenarioName("unknown-scenario"), /Unknown scenario/i);

  const args1 = parseSeedArgs(["node", "seed.js", "--scenario", "reheat"]);
  assert.equal(args1.scenarioName, "RC26-05-AI-DAY21");

  const args2 = parseSeedArgs(["node", "seed.js", "--scenario=pregnancy-report"]);
  assert.equal(args2.scenarioName, "RC26-06-LIKELY-PREGNANT");

  const args3 = parseSeedArgs(["node", "seed.js", "--scenario", "pregnant"]);
  assert.equal(args3.scenarioName, "RC26-08-PREGNANCY-LOSS-REVIEW");

  const args4 = parseSeedArgs(["node", "seed.js", "--scenario", "heat-check"]);
  assert.equal(args4.scenarioName, "RC26-23-HEAT-CHECK");

  const args5 = parseSeedArgs([
    "node",
    "seed.js",
    "--scenario",
    "pregnancy-loss-review",
  ]);
  assert.equal(args5.scenarioName, "RC26-08-PREGNANCY-LOSS-REVIEW");

  const argsDefault = parseSeedArgs(["node", "seed.js"]);
  assert.equal(argsDefault.scenarioName, null);
});

test("Reproduction seeder: single scenario plan produces isolated scenario and passes validation", () => {
  for (const [alias, canonicalName] of Object.entries(SCENARIO_ALIASES)) {
    const singlePlan = buildReproductionLifecyclePlan({
      farmer: { _id: new mongoose.Types.ObjectId(), email: "farmer@example.test" },
      technician: {
        _id: new mongoose.Types.ObjectId(),
        email: "technician@example.test",
        role: "technician",
        status: "active",
        deletedAt: null,
      },
      now: new Date("2026-07-17T00:00:00.000Z"),
      seedBatch: "repro-single-test",
      scenarioName: canonicalName,
    });

    assert.equal(singlePlan.selectedScenario, canonicalName);
    assert.equal(singlePlan.scenarios.length, 1);
    assert.equal(singlePlan.scenarios[0].scenario, canonicalName);
    assert.equal(singlePlan.collections.animals.length, 1);
    assert.equal(validateSeedPlan(singlePlan), true);

    const manifest = createManifest({
      plan: singlePlan,
      databaseName: "development-test",
      environment: "test",
      manifestPath: "C:/tmp/reproduction-manifest-single.json",
    });
    assert.equal(manifest.scenarioNames.length, 1);
    assert.equal(manifest.scenarioNames[0], canonicalName);
    assert.doesNotThrow(() => validateManifest(manifest));
  }
});

test("Reproduction seeder: single scenario cleanup scopes deletion strictly to scenario records", async () => {
  const deletedFilters = {};
  const findFilters = {};
  const mockModel = (name) => ({
    find: () => [],
    deleteMany: async (filter) => {
      deletedFilters[name] = filter;
      return { deletedCount: 1 };
    },
  });

  const candidateAnimals = [
    { _id: new mongoose.Types.ObjectId(), earTag: "RC26-single-23-HEAT-CHECK" },
    { _id: new mongoose.Types.ObjectId(), earTag: "RC26-OLD-FULL-BATCH-23-HEAT-CHECK" },
    { _id: new mongoose.Types.ObjectId(), earTag: "RC26-OLD-FULL-BATCH-05-AI-DAY21" },
    { _id: new mongoose.Types.ObjectId(), earTag: "RC26-SINGLE-05-AI-DAY21" },
    { _id: new mongoose.Types.ObjectId(), earTag: "RC26-SINGLE-06-LIKELY-PREGNANT" },
    { _id: new mongoose.Types.ObjectId(), earTag: "RC26-SINGLE-08-PREGNANT" },
  ];

  const models = {
    Animal: {
      find: (filter) => {
        findFilters.Animal = filter;
        return candidateAnimals.filter((a) =>
          filter.earTag?.$regex ? filter.earTag.$regex.test(a.earTag) : true,
        );
      },
      deleteMany: async (filter) => {
        deletedFilters.Animal = filter;
        return { deletedCount: filter._id?.$in?.length || 0 };
      },
    },
    Insemination: mockModel("Insemination"),
    Pregnancy: mockModel("Pregnancy"),
    Calving: mockModel("Calving"),
    PregnancyLossReport: mockModel("PregnancyLossReport"),
    Task: mockModel("Task"),
    HealthRequest: mockModel("HealthRequest"),
    MedicalRecord: mockModel("MedicalRecord"),
    AnimalTimelineEvent: mockModel("AnimalTimelineEvent"),
    AuditLog: mockModel("AuditLog"),
    Notification: mockModel("Notification"),
  };

  const farmerId = new mongoose.Types.ObjectId();

  // Given:
  // RC26-single-23-HEAT-CHECK
  // RC26-OLD-FULL-BATCH-23-HEAT-CHECK
  // RC26-OLD-FULL-BATCH-05-AI-DAY21
  //
  // Running cleanup for single: --scenario heat-check
  // selects/deletes ONLY: RC26-single-23-HEAT-CHECK and leaves both full-batch fixtures untouched.
  const resHeatCheck = await cleanupSingleScenario({
    farmerId,
    scenarioName: "heat-check",
    models,
  });

  assert.equal(resHeatCheck.scenarioName, "RC26-23-HEAT-CHECK");
  assert.equal(resHeatCheck.deletedCount, 1);
  assert.deepEqual(resHeatCheck.cleanedAnimals, ["RC26-single-23-HEAT-CHECK"]);
  assert.deepEqual(deletedFilters.Animal._id.$in, [candidateAnimals[0]._id]);
  assert.ok(!deletedFilters.Animal._id.$in.includes(candidateAnimals[1]._id));
  assert.ok(!deletedFilters.Animal._id.$in.includes(candidateAnimals[2]._id));

  // Regex checks for heat-check
  assert.equal(String(findFilters.Animal.farmerId), String(farmerId));
  assert.ok(findFilters.Animal.earTag.$regex instanceof RegExp);
  assert.ok(findFilters.Animal.earTag.$regex.test("RC26-single-23-HEAT-CHECK"));
  assert.ok(findFilters.Animal.earTag.$regex.test("RC26-SINGLE-23-HEAT-CHECK"));
  assert.ok(!findFilters.Animal.earTag.$regex.test("RC26-OLD-FULL-BATCH-23-HEAT-CHECK"));
  assert.ok(!findFilters.Animal.earTag.$regex.test("RC26-OLD-FULL-BATCH-05-AI-DAY21"));
  assert.ok(!findFilters.Animal.earTag.$regex.test("RC26-SINGLE-05-AI-DAY21"));
  assert.ok(!findFilters.Animal.earTag.$regex.test("RC26-SINGLE-06-LIKELY-PREGNANT"));
  assert.ok(!findFilters.Animal.earTag.$regex.test("RC26-SINGLE-08-PREGNANT"));

  // Verify existing single-mode aliases remain safe
  // reheat -> RC26-05-AI-DAY21
  const resReheat = await cleanupSingleScenario({
    farmerId,
    scenarioName: "reheat",
    models,
  });
  assert.equal(resReheat.scenarioName, "RC26-05-AI-DAY21");
  assert.equal(resReheat.deletedCount, 1);
  assert.deepEqual(resReheat.cleanedAnimals, ["RC26-SINGLE-05-AI-DAY21"]);
  assert.deepEqual(deletedFilters.Animal._id.$in, [candidateAnimals[3]._id]);
  assert.ok(!deletedFilters.Animal._id.$in.includes(candidateAnimals[2]._id)); // leaves RC26-OLD-FULL-BATCH-05-AI-DAY21 untouched

  // pregnancy-report -> RC26-06-LIKELY-PREGNANT
  const resPregReport = await cleanupSingleScenario({
    farmerId,
    scenarioName: "pregnancy-report",
    models,
  });
  assert.equal(resPregReport.scenarioName, "RC26-06-LIKELY-PREGNANT");
  assert.equal(resPregReport.deletedCount, 1);
  assert.deepEqual(resPregReport.cleanedAnimals, ["RC26-SINGLE-06-LIKELY-PREGNANT"]);
  assert.deepEqual(deletedFilters.Animal._id.$in, [candidateAnimals[4]._id]);

  // pregnant -> RC26-08-PREGNANCY-LOSS-REVIEW
  const resPregnant = await cleanupSingleScenario({
    farmerId,
    scenarioName: "pregnant",
    models,
  });
  assert.equal(resPregnant.scenarioName, "RC26-08-PREGNANCY-LOSS-REVIEW");
  assert.equal(resPregnant.deletedCount, 1);
  assert.deepEqual(resPregnant.cleanedAnimals, ["RC26-SINGLE-08-PREGNANT"]);
  assert.deepEqual(deletedFilters.Animal._id.$in, [candidateAnimals[5]._id]);
  assert.deepEqual(deletedFilters.PregnancyLossReport.$or, [
    { animalId: { $in: [candidateAnimals[5]._id] } },
    { pregnancyId: { $in: [] } },
    { inseminationId: { $in: [] } },
  ]);
});

test("Reproduction seeder: RC26-23-HEAT-CHECK provides pre-observation Day 21 fixture deriving heat_check milestone and mobile Breeding Update", async (t) => {
  const plan = buildPlan();
  const scenario = plan.scenarios.find(
    (item) => item.scenario === "RC26-23-HEAT-CHECK",
  );
  assert.ok(scenario, "RC26-23-HEAT-CHECK scenario must exist in plan");

  // Database / entity state assertions
  assert.equal(scenario.animal.reproductiveStatus, "Inseminated");
  assert.equal(scenario.animal.gender, "Female");
  assert.equal(String(scenario.animal.farmerId), String(plan.farmer._id));

  assert.equal(scenario.inseminations.length, 1);
  const ins = scenario.inseminations[0];
  assert.equal(ins.status, "done");
  assert.equal(ins.outcome, "Pending");
  assert.equal(ins.isSuccess, undefined);
  assert.equal(String(ins.farmerId), String(plan.farmer._id));
  assert.equal(String(ins.technicianId), String(plan.technician._id));

  // Day 21 post-AI: exactly 21 days between inseminationDate and plan.now
  const daysDiff = Math.round(
    (new Date(plan.now).getTime() - new Date(ins.inseminationDate).getTime()) /
      (24 * 60 * 60 * 1000),
  );
  assert.equal(daysDiff, 21);

  // Critically: no farmer observation yet
  assert.equal(ins.farmerOutcomeReport, undefined);
  assert.equal(ins.farmerObservationSigns, undefined);
  assert.equal(ins.farmerObservationNotes, undefined);
  assert.equal(ins.evidencePhotos, undefined);
  assert.equal(ins.farmerPregnancyReport, undefined);
  assert.equal(ins.verificationRequested, undefined);
  assert.equal(ins.verificationStatus, undefined);

  // No technician verification tasks, only automatic follow-up PD task
  const breedingFollowUpTasks = scenario.tasks.filter(
    (task) => task.taskType === "BreedingFollowUp",
  );
  assert.equal(breedingFollowUpTasks.length, 0);

  const pdTasks = scenario.tasks.filter((task) => task.taskType === "PD");
  assert.equal(pdTasks.length, 1);
  assert.equal(pdTasks[0].sourceType, "automatic_pd_followup");

  // No premature technician verification / observation timeline events
  const observationTimelines = scenario.timelines.filter(
    (item) => item.eventType === "farmer_breeding_observation_reported",
  );
  assert.equal(observationTimelines.length, 0);

  // Derive milestone via getBreedingMilestones using current reference time
  const liveNow = new Date();
  const livePlan = buildReproductionLifecyclePlan({
    farmer: plan.farmer,
    technician: plan.technician,
    now: liveNow,
    seedBatch: "repro-live-heat-check",
    scenarioName: "RC26-23-HEAT-CHECK",
  });
  const liveScenario = livePlan.scenarios[0];
  const liveIns = liveScenario.inseminations[0];
  const liveAnimalDoc = {
    _id: liveScenario.motherId,
    animalId: liveScenario.animal.animalId,
    earTag: liveScenario.earTag,
    species: liveScenario.animal.species,
    breed: liveScenario.animal.breed,
  };

  const originals = {
    inseminationFind: Insemination.find,
    pregnancyFind: Pregnancy.find,
    calvingFind: Calving.find,
    taskFind: Task.find,
    configFindOne: Config.findOne,
  };

  const queryResult = (value) => {
    const query = {
      populate() { return query; },
      sort() { return query; },
      select() { return query; },
      lean() { return query; },
      then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
    };
    return query;
  };

  Insemination.find = () => queryResult([{ ...liveIns, animalId: liveAnimalDoc }]);
  Pregnancy.find = () => queryResult([]);
  Calving.find = () => queryResult([]);
  Task.find = () => queryResult(liveScenario.tasks);
  Config.findOne = () => queryResult(null);

  t.after(() => {
    Insemination.find = originals.inseminationFind;
    Pregnancy.find = originals.pregnancyFind;
    Calving.find = originals.calvingFind;
    Task.find = originals.taskFind;
    Config.findOne = originals.configFindOne;
  });

  const recorder = { statusCode: 200, body: null };
  const response = {
    status(code) { recorder.statusCode = code; return this; },
    json(payload) { recorder.body = payload; return this; },
  };

  await getBreedingMilestones(
    { user: { _id: plan.farmer._id, role: "farmer" } },
    response,
  );

  assert.equal(recorder.statusCode, 200);
  assert.ok(Array.isArray(recorder.body));

  const heatMilestone = recorder.body.find((item) => item.type === "heat_check");
  assert.ok(heatMilestone, "Must produce heat_check milestone");
  assert.equal(String(heatMilestone.relatedId), String(liveIns._id));
  assert.equal(heatMilestone.farmerObservation, null);

  // Mobile transform: selectNeedsAttention
  const attentionItems = selectNeedsAttention(recorder.body);
  assert.equal(attentionItems.length, 1);

  const item = attentionItems[0];
  assert.equal(item.displayTitle, "Breeding Update");
  assert.equal(item.actionLabel, "Give Update");
  assert.equal(item.actionKind, "report_signs");
  assert.equal(item.guidance, "Has your animal shown signs of heat since insemination?");
  assert.match(item.displaySubtitle, /21 days after insemination/);
});

test("Reproduction seeder: excludeHealth seeds all reproduction scenarios without health records", () => {
  const parsed = parseSeedArgs([
    "--farmerEmail=farmer@example.test",
    "--technicianEmail=technician@example.test",
    "--excludeHealth",
  ]);
  assert.equal(parsed.excludeHealth, true);

  const plan = buildReproductionLifecyclePlan({
    farmer: { _id: new mongoose.Types.ObjectId(), email: "farmer@example.test" },
    technician: {
      _id: new mongoose.Types.ObjectId(),
      email: "technician@example.test",
      role: "technician",
      status: "active",
      deletedAt: null,
    },
    now: new Date("2026-07-17T00:00:00.000Z"),
    seedBatch: "repro-test-exhealth",
    excludeHealth: true,
  });

  assert.doesNotThrow(() => validateSeedPlan(plan));
  assert.equal(plan.scenarios.length, REPRODUCTIVE_SCENARIO_NAMES.length);
  assert.equal(plan.collections.healthRequests.length, 0);
  assert.equal(plan.collections.medicalRecords.length, 0);

  const scenarioNames = plan.scenarios.map((s) => s.scenario);
  for (const healthName of HEALTH_SCENARIO_NAMES) {
    assert.equal(scenarioNames.includes(healthName), false);
  }
});

