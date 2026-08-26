import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPregnancyClinicalActor,
  assertPregnancyMutationAuthority,
} from "../src/policies/pregnancy-mutation.policy.js";
import { assertAIRequestAccess } from "../src/policies/request.policy.js";
import { updateReproductiveStatus } from "../src/controllers/animals.controllers.js";
import { Animal } from "../src/models/animal.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Task } from "../src/models/task.model.js";

const technicianA = {
  _id: "507f1f77bcf86cd799439001",
  role: "technician",
};
const technicianB = {
  _id: "507f1f77bcf86cd799439002",
  role: "technician",
};

test("assigned pregnancy Task authorizes only its technician", () => {
  assert.equal(
    assertPregnancyMutationAuthority({
      actor: technicianA,
      task: { technicianId: technicianA._id },
      insemination: { technicianId: technicianB._id },
    }).source,
    "task",
  );
  assert.throws(
    () => assertPregnancyMutationAuthority({
      actor: technicianB,
      task: { technicianId: technicianA._id },
    }),
    (error) =>
      error.status === 403 &&
      error.code === "PREGNANCY_WORK_ASSIGNED_TO_OTHER",
  );
});

test("exact unassigned Task can be atomically claimed only when the workflow opts in", () => {
  assert.equal(
    assertPregnancyMutationAuthority({
      actor: technicianA,
      task: { technicianId: null },
      allowUnassignedTaskClaim: true,
    }).ownerId,
    technicianA._id,
  );
  assert.throws(
    () => assertPregnancyMutationAuthority({
      actor: technicianA,
      task: { technicianId: null },
      allowUnassignedTaskClaim: false,
    }),
    (error) => error.code === "PREGNANCY_WORK_CLAIM_REQUIRED",
  );
});

test("existing Pregnancy owner is the legacy fallback when no Task exists", () => {
  assert.equal(
    assertPregnancyMutationAuthority({
      actor: technicianA,
      pregnancy: { confirmation: { confirmedBy: technicianA._id } },
      insemination: { technicianId: technicianB._id },
    }).source,
    "pregnancy",
  );
  assert.throws(
    () => assertPregnancyMutationAuthority({
      actor: technicianB,
      pregnancy: { confirmation: { confirmedBy: technicianA._id } },
    }),
    (error) => error.code === "PREGNANCY_WORK_ASSIGNED_TO_OTHER",
  );
});

test("conflicting originating AI ownership fails closed", () => {
  assert.throws(
    () => assertPregnancyMutationAuthority({
      actor: technicianA,
      insemination: {
        approvedBy: technicianA._id,
        technicianId: technicianB._id,
      },
    }),
    (error) =>
      error.status === 403 &&
      error.code === "PREGNANCY_WORK_ASSIGNED_TO_OTHER",
  );
});

test("Receive Requests and availability do not block already-owned pregnancy work", () => {
  const unavailableOwner = {
    ...technicianA,
    dispatchProfile: { acceptsNewRequests: false },
    availabilityStatus: "off_duty",
  };
  assert.doesNotThrow(() => assertPregnancyMutationAuthority({
    actor: unavailableOwner,
    task: { technicianId: technicianA._id },
  }));
});

test("Farmers and Admins cannot use field-clinical pregnancy mutations", () => {
  for (const role of ["farmer", "admin"]) {
    assert.throws(
      () => assertPregnancyClinicalActor({ _id: technicianA._id, role }),
      (error) =>
        error.status === 403 &&
        error.code === "UNAUTHORIZED_PREGNANCY_CONFIRMATION",
    );
  }
});

test("Farmer pregnancy observations remain scoped to the Farmer's own AI workflow", () => {
  const farmerA = { _id: "507f1f77bcf86cd799439010", role: "farmer" };
  assert.doesNotThrow(() => assertAIRequestAccess(farmerA, {
    farmerId: farmerA._id,
  }));
  assert.throws(
    () => assertAIRequestAccess(farmerA, {
      farmerId: "507f1f77bcf86cd799439011",
    }),
    (error) => error.status === 403 && error.code === "AI_REQUEST_ACCESS_DENIED",
  );
});

test("another technician cannot use the legacy return-to-heat mutation and causes no writes", async (t) => {
  const originals = {
    animalFindById: Animal.findById,
    inseminationFindOne: Insemination.findOne,
    pregnancyFindOne: Pregnancy.findOne,
    taskFindOne: Task.findOne,
  };
  t.after(() => {
    Animal.findById = originals.animalFindById;
    Insemination.findOne = originals.inseminationFindOne;
    Pregnancy.findOne = originals.pregnancyFindOne;
    Task.findOne = originals.taskFindOne;
  });

  let animalWrites = 0;
  let inseminationWrites = 0;
  Animal.findById = async () => ({
    _id: "507f1f77bcf86cd799439020",
    reproductiveStatus: "Inseminated",
    activityLogs: [],
    async save() { animalWrites += 1; },
  });
  const sorted = (value) => ({ sort: async () => value });
  Insemination.findOne = () => sorted({
    _id: "507f1f77bcf86cd799439021",
    approvedBy: technicianA._id,
    technicianId: technicianA._id,
    async save() { inseminationWrites += 1; },
  });
  Pregnancy.findOne = () => sorted(null);
  Task.findOne = () => sorted(null);

  const recorder = { statusCode: 200, body: null };
  const response = {
    status(code) { recorder.statusCode = code; return this; },
    json(body) { recorder.body = body; return this; },
  };
  await updateReproductiveStatus(
    {
      params: { id: "507f1f77bcf86cd799439020" },
      body: { status: "In Heat", note: "Observed return to heat" },
      user: technicianB,
    },
    response,
  );

  assert.equal(recorder.statusCode, 403);
  assert.equal(recorder.body.code, "PREGNANCY_WORK_ASSIGNED_TO_OTHER");
  assert.equal(animalWrites, 0);
  assert.equal(inseminationWrites, 0);
});
