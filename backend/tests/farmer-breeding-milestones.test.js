import assert from "node:assert/strict";
import test from "node:test";

import { getBreedingMilestones } from "../src/controllers/user.controllers.js";
import { Calving } from "../src/models/calving.model.js";
import { Config } from "../src/models/config.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Task } from "../src/models/task.model.js";

const ids = {
  farmer: "507f1f77bcf86cd799439001",
  animal: "507f1f77bcf86cd799439002",
  heatAttempt: "507f1f77bcf86cd799439003",
  pdAttempt: "507f1f77bcf86cd799439004",
  pregnancy: "507f1f77bcf86cd799439005",
  pdTask: "507f1f77bcf86cd799439006",
  calvingTask: "507f1f77bcf86cd799439007",
  failedAttempt: "507f1f77bcf86cd799439008",
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

const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

test("Farmer breeding milestones expose canonical identifiers, readiness, and active task state", async (t) => {
  const originals = {
    inseminationFind: Insemination.find,
    pregnancyFind: Pregnancy.find,
    calvingFind: Calving.find,
    taskFind: Task.find,
    configFindOne: Config.findOne,
  };

  const animal = {
    _id: ids.animal,
    animalId: "COW-17",
    earTag: "EAR-17",
    species: "Cattle",
    breed: "Holstein",
  };
  Insemination.find = () => queryResult([
    {
      _id: ids.heatAttempt,
      farmerId: ids.farmer,
      animalId: animal,
      status: "done",
      isSuccess: null,
      inseminationDate: daysAgo(20),
      farmerOutcomeReport: null,
    },
    {
      _id: ids.pdAttempt,
      farmerId: ids.farmer,
      animalId: animal,
      status: "done",
      isSuccess: null,
      inseminationDate: daysAgo(30),
      verificationTaskId: ids.pdTask,
      farmerOutcomeReport: "possible_pregnancy",
      verificationStatus: "pending",
    },
    {
      _id: ids.failedAttempt,
      farmerId: ids.farmer,
      animalId: animal,
      status: "done",
      isSuccess: false,
      outcome: "Failed (Re-heat)",
      outcomeVerificationStatus: "verified",
      outcomeConfirmationSource: "technician_return_to_heat",
      failureReason: "return_to_heat",
      farmerOutcomeReport: "return_to_heat",
      inseminationDate: daysAgo(20),
    },
  ]);
  Pregnancy.find = () => queryResult([
    {
      _id: ids.pregnancy,
      farmerId: ids.farmer,
      animalId: animal,
      targetCalvingDate: daysFromNow(3),
      pregnancyDiagnosis: { result: "Pregnant" },
    },
  ]);
  Calving.find = () => queryResult([]);
  Task.find = () => queryResult([
    {
      _id: ids.pdTask,
      farmerId: ids.farmer,
      animalIds: [ids.animal],
      taskType: "PD",
      status: "Pending",
      sourceType: "automatic_pd_followup",
      dueDate: daysFromNow(30),
      metadata: { inseminationId: ids.pdAttempt },
    },
    {
      _id: ids.calvingTask,
      farmerId: ids.farmer,
      animalIds: [ids.animal],
      taskType: "Calving",
      status: "Pending",
      metadata: { pregnancyId: ids.pregnancy },
    },
  ]);
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
    { user: { _id: ids.farmer, role: "farmer" } },
    response,
  );

  assert.equal(recorder.statusCode, 200);
  const heat = recorder.body.find((item) => item.type === "heat_check");
  const pd = recorder.body.find(
    (item) => item.type === "pd_check" && String(item.relatedId) === ids.pdAttempt,
  );
  const calving = recorder.body.find((item) => item.type === "calving");
  const failedAttemptMilestone = recorder.body.find(
    (item) => String(item.relatedId) === ids.failedAttempt,
  );

  assert.equal(String(heat.relatedId), ids.heatAttempt);
  assert.equal(String(pd.relatedId), ids.pdAttempt);
  assert.equal(String(pd.taskId), ids.pdTask);
  assert.equal(pd.status, "awaiting_confirmation");
  assert.equal(String(pd.pregnancyFollowUpTask._id), ids.pdTask);
  assert.equal(pd.pregnancyFollowUpTask.sourceType, "automatic_pd_followup");
  assert.equal(pd.farmerObservation.reportType, "possible_pregnancy");
  assert.equal(pd.pregnancyReadiness.isEligible, false);
  assert.equal(pd.pregnancyReadiness.policyMode, "legacy_day_60");
  assert.equal(String(calving.relatedId), ids.pregnancy);
  assert.equal(String(calving.taskId), ids.calvingTask);
  assert.equal(failedAttemptMilestone, undefined);
});
