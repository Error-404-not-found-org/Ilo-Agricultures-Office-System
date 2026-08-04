import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  PREGNANCY_METHOD_CODES,
  resolvePregnancyConfirmationPolicy,
  validatePregnancyConfirmationPolicy,
} from "../src/domain/pregnancy-confirmation-policy.js";
import { getPregnancyCheckReadiness } from "../src/domain/pregnancy-readiness.js";
import { getPregnancyConfirmationMetadata } from "../src/domain/pregnancy-confirmation-metadata.js";
import { getPregnancyTaskStage } from "../src/domain/pregnancy-task-workflow.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Config } from "../src/models/config.model.js";
import { getConfigSettings } from "../src/controllers/config.controllers.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const DAY = 24 * 60 * 60 * 1000;
const method = (methodCode, overrides = {}) => ({
  methodCode,
  label: methodCode.replaceAll("_", " "),
  enabled: false,
  earliestDaysPostAI: null,
  acceptedResults: ["Pregnant", "Empty"],
  technicianDiagnosisMayConfirm: true,
  acceptedExternalEvidenceMayConfirm: false,
  continuationRecheckRequired: true,
  speciesOverrides: {},
  ...overrides,
});
const policy = (overrides = {}) => ({
  version: "test-policy-v1",
  effectiveFrom: "2026-01-01T00:00:00.000Z",
  enabled: true,
  continuationRecheckDaysPostAI: 60,
  methods: PREGNANCY_METHOD_CODES.map((code) => method(code)),
  ...overrides,
});
const withEnabledMethods = () => policy({
  methods: PREGNANCY_METHOD_CODES.map((code) =>
    code === "ultrasound"
      ? method(code, { enabled: true, earliestDaysPostAI: 30 })
      : code === "rectal_palpation"
        ? method(code, { enabled: true, earliestDaysPostAI: 45 })
        : method(code),
  ),
});
const readinessAt = (days, configuredPolicy = withEnabledMethods()) => {
  const at = new Date("2026-07-18T00:00:00.000Z");
  return getPregnancyCheckReadiness({
    insemination: {
      status: "done",
      inseminationDate: new Date(at.getTime() - days * DAY),
    },
    at,
    policy: configuredPolicy,
    species: "Cattle",
  });
};

test("pregnancy policy rejects malformed and unsafe configurations", () => {
  const valid = withEnabledMethods();
  const invalidPolicies = [
    { ...valid, version: "" },
    { ...valid, effectiveFrom: "invalid" },
    { ...valid, continuationRecheckDaysPostAI: -1 },
    { ...valid, methods: [...valid.methods, method("unknown_method")] },
    { ...valid, methods: [...valid.methods, valid.methods[0]] },
    { ...valid, methods: valid.methods.map((item) => item.methodCode === "ultrasound" ? { ...item, earliestDaysPostAI: null } : item) },
    { ...valid, methods: valid.methods.map((item) => item.methodCode === "ultrasound" ? { ...item, acceptedResults: ["Maybe"] } : item) },
  ];
  for (const invalid of invalidPolicies) {
    assert.throws(() => validatePregnancyConfirmationPolicy(invalid), /policy|method|threshold|result|milestone|version|date|whole number/i);
  }
});

test("method and species thresholds may fall before, on, or after the continuation milestone", () => {
  for (const threshold of [30, 60, 65]) {
    const configuredPolicy = policy({
      methods: PREGNANCY_METHOD_CODES.map((code) =>
        code === "ultrasound"
          ? method(code, { enabled: true, earliestDaysPostAI: threshold })
          : method(code),
      ),
    });
    assert.doesNotThrow(() => validatePregnancyConfirmationPolicy(configuredPolicy));
    const readiness = readinessAt(threshold, configuredPolicy);
    assert.equal(readiness.policyMode, "method_based");
    assert.equal(readiness.methods.find((item) => item.methodCode === "ultrasound").isEligible, true);
  }

  const speciesPolicy = policy({
    methods: PREGNANCY_METHOD_CODES.map((code) =>
      code === "ultrasound"
        ? method(code, {
            enabled: true,
            earliestDaysPostAI: 30,
            speciesOverrides: { Cattle: { earliestDaysPostAI: 65 } },
          })
        : method(code),
    ),
  });
  assert.doesNotThrow(() => validatePregnancyConfirmationPolicy(speciesPolicy));
  assert.equal(
    readinessAt(64, speciesPolicy).methods.find((item) => item.methodCode === "ultrasound").isEligible,
    false,
  );
  assert.equal(
    readinessAt(65, speciesPolicy).methods.find((item) => item.methodCode === "ultrasound").isEligible,
    true,
  );
});

test("disabled or invalid policy safely retains the legacy Day-60 contract", () => {
  const disabled = { ...withEnabledMethods(), enabled: false };
  const day59 = readinessAt(59, disabled);
  const day60 = readinessAt(60, disabled);
  assert.equal(resolvePregnancyConfirmationPolicy({ policy: disabled }).mode, "legacy_day_60");
  assert.equal(day59.policyMode, "legacy_day_60");
  assert.equal(day59.isEligible, false);
  assert.equal(day60.isEligible, true);
  assert.ok("availableDate" in day60);
  assert.ok("reason" in day60);
});

test("invalid enabled policy falls back while its warning remains visible to configuration readers", async () => {
  const invalidPolicy = {
    ...withEnabledMethods(),
    methods: withEnabledMethods().methods.map((item) =>
      item.methodCode === "ultrasound"
        ? { ...item, earliestDaysPostAI: -1 }
        : item,
    ),
  };
  const resolution = resolvePregnancyConfirmationPolicy({ policy: invalidPolicy });
  const readiness = readinessAt(60, invalidPolicy);
  assert.equal(resolution.mode, "legacy_day_60");
  assert.equal(readiness.policyMode, "legacy_day_60");
  assert.equal(readiness.isEligible, true);
  assert.equal(resolution.validationError?.code, "INVALID_PREGNANCY_POLICY");

  const originalFind = Config.find;
  Config.find = async () => [{ key: "pregnancyConfirmationPolicy", value: invalidPolicy }];
  let responseStatus;
  let responseBody;
  try {
    await getConfigSettings(
      {},
      {
        status(status) {
          responseStatus = status;
          return this;
        },
        json(body) {
          responseBody = body;
          return this;
        },
      },
    );
  } finally {
    Config.find = originalFind;
  }
  assert.equal(responseStatus, 200);
  assert.equal(responseBody.pregnancyConfirmationPolicyStatus.policyMode, "legacy_day_60");
  assert.equal(responseBody.pregnancyConfirmationPolicyStatus.isValid, false);
  assert.equal(responseBody.pregnancyConfirmationPolicyStatus.warning.code, "INVALID_PREGNANCY_POLICY");
  assert.match(responseBody.pregnancyConfirmationPolicyStatus.warning.message, /non-negative whole number/i);
  assert.equal("stack" in responseBody.pregnancyConfirmationPolicyStatus.warning, false);
});

test("enabled policy returns independent method readiness at exact boundaries", () => {
  const day29 = readinessAt(29);
  const day30 = readinessAt(30);
  const day44 = readinessAt(44);
  const ultrasound29 = day29.methods.find((item) => item.methodCode === "ultrasound");
  const ultrasound30 = day30.methods.find((item) => item.methodCode === "ultrasound");
  const palpation44 = day44.methods.find((item) => item.methodCode === "rectal_palpation");
  assert.equal(day30.policyMode, "method_based");
  assert.equal(day30.policyVersion, "test-policy-v1");
  assert.equal(ultrasound29.isEligible, false);
  assert.equal(ultrasound29.daysRemaining, 1);
  assert.equal(ultrasound30.isEligible, true);
  assert.equal(palpation44.isEligible, false);
  assert.equal(day44.isEligible, true);
  assert.equal(day44.earliestAvailableMethod.methodCode, "ultrasound");
  assert.equal(day44.methods.find((item) => item.methodCode === "blood_pag").isEligible, false);
  assert.equal(day44.continuationRecheck.milestoneDaysPostAI, 60);
});

test("existing Pregnancy and PD task records receive compatibility interpretations", () => {
  assert.equal(getPregnancyConfirmationMetadata({ pregnancyDiagnosis: { date: new Date() } }).stage, "legacy_unclassified");
  assert.equal(getPregnancyTaskStage({ metadata: {} }), "initial_confirmation");
  for (const schemaPath of [
    "pregnancyDiagnosis.date",
    "pregnancyDiagnosis.result",
    "confirmation.methodCode",
    "confirmation.stage",
    "confirmation.policyVersion",
    "confirmation.earliestThresholdSnapshot",
    "recheckStatus",
  ]) {
    assert.ok(Pregnancy.schema.path(schemaPath), `Missing schema path ${schemaPath}`);
  }
});

test("mobile forms consume server method readiness without calculating medical dates", () => {
  const helper = source("mobile/lib/reproductionEligibility.ts");
  const verification = source("mobile/app/(technician)/pregnancy-verification.tsx");
  const standalone = source("mobile/app/(technician)/pregnancy-check.tsx");
  assert.match(helper, /insemination\?\.pregnancyReadiness/);
  assert.doesNotMatch(helper, /setUTCDate|daysPostAI\s*=/);
  for (const form of [verification, standalone]) {
    assert.match(form, /\.methods/);
    assert.match(form, /methodCode/);
    assert.match(form, /policyVersion/);
    assert.match(form, /method\.enabled.*method\.isEligible/s);
  }
  assert.match(verification, /policyMode === "method_based"/);
  assert.match(standalone, /policyMode === "method_based"/);
});

test("farmer return-to-heat remains reported until technician verification", () => {
  const controller = source("backend/src/controllers/ai-request.controllers.js");
  const start = controller.indexOf("export const submitFarmerBreedingObservation");
  const end = controller.indexOf("export const deleteRequest", start);
  const handler = controller.slice(start, end);
  assert.match(handler, /technicianVerificationRequired = reportType === "return_to_heat"/);
  assert.match(handler, /outcomeVerificationStatus = "reported"/);
  assert.doesNotMatch(handler, /request\.outcome = "Failed \(Re-heat\)"/);
  assert.doesNotMatch(handler, /Pregnancy\.create/);
});

test("startup does not force production index creation and documents Task index deployment intent", () => {
  const db = source("backend/src/config/db.js");
  const server = source("backend/src/server.js");
  const taskModel = source("backend/src/models/task.model.js");
  assert.doesNotMatch(`${db}\n${server}`, /syncIndexes|createIndexes|ensureIndexes/);
  assert.match(db, /autoIndex:\s*!isProduction/);
  assert.match(taskModel, /autoIndex:\s*false/);
  assert.match(taskModel, /uniq_pregnancy_continuation_task/);
  assert.match(taskModel, /uniq_open_pregnancy_follow_up_task/);
  assert.match(taskModel, /read-only duplicate audit/i);
});
