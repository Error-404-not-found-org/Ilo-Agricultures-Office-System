import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Config } from "../src/models/config.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Task } from "../src/models/task.model.js";
import { getLegacyPregnancyReminderRelevance } from "../src/services/pregnancy-reminder-relevance.service.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const query = (value) => {
  const promise = Promise.resolve(value);
  promise.sort = () => promise;
  return promise;
};

const install = ({ pregnancy = null, taskStage = "initial_confirmation", policy = null } = {}) => {
  const originals = [
    [Insemination, "findOne", Insemination.findOne],
    [Pregnancy, "findOne", Pregnancy.findOne],
    [Task, "findOne", Task.findOne],
    [Config, "findOne", Config.findOne],
  ];
  Insemination.findOne = () => query({
    _id: "507f1f77bcf86cd799439001",
    status: "done",
    isSuccess: null,
    breedingCycleStatus: "active",
  });
  Pregnancy.findOne = () => query(pregnancy);
  Task.findOne = () => query({ metadata: { workflowStage: taskStage } });
  Config.findOne = () => query(policy ? { value: policy } : null);
  return () => {
    for (const [target, key, original] of originals) target[key] = original;
  };
};

test("legacy reminders re-read current records and skip obsolete lifecycle states", async () => {
  for (const scenario of [
    { pregnancy: { _id: "507f1f77bcf86cd799439002" }, reason: "OFFICIAL_PREGNANCY_EXISTS" },
    { taskStage: "continuation_recheck", reason: "TASK_STAGE_CHANGED" },
  ]) {
    const restore = install(scenario);
    try {
      const relevance = await getLegacyPregnancyReminderRelevance({
        inseminationId: "507f1f77bcf86cd799439001",
      });
      assert.equal(relevance.isRelevant, false);
      assert.equal(relevance.reason, scenario.reason);
    } finally {
      restore();
    }
  }
});

test("legacy reminders stop when an approved method policy becomes active", async () => {
  const restore = install({
    policy: {
      version: "reminder-policy-v1",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      enabled: true,
      continuationRecheckDaysPostAI: 60,
      methods: [{
        methodCode: "ultrasound",
        label: "Ultrasound",
        enabled: true,
        earliestDaysPostAI: 30,
        acceptedResults: ["Pregnant", "Empty"],
        technicianDiagnosisMayConfirm: true,
        acceptedExternalEvidenceMayConfirm: false,
        continuationRecheckRequired: true,
        speciesOverrides: {},
      }],
    },
  });
  try {
    const relevance = await getLegacyPregnancyReminderRelevance({
      inseminationId: "507f1f77bcf86cd799439001",
    });
    assert.deepEqual(
      { isRelevant: relevance.isRelevant, reason: relevance.reason },
      { isRelevant: false, reason: "POLICY_CHANGED" },
    );
  } finally {
    restore();
  }
});

test("Inngest checks current relevance and no longer changes status from elapsed time", () => {
  const inngest = fs.readFileSync(path.join(root, "backend/src/config/inngest.js"), "utf8");
  assert.match(inngest, /getLegacyPregnancyReminderRelevance/);
  assert.doesNotMatch(inngest, /animal\.reproductiveStatus = "Likely Pregnant"/);
  assert.doesNotMatch(inngest, /await animal\.save\(\)/);
});
