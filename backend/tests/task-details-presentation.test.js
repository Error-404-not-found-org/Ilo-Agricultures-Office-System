import assert from "node:assert/strict";
import test from "node:test";

import { getTaskById } from "../src/controllers/tasks.controllers.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Task } from "../src/models/task.model.js";

const queryResult = (value) => {
  const query = {
    populate() {
      return query;
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
  return query;
};

const mockResponse = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

test("calving task details include canonical pregnancy and AI context", async (t) => {
  const originalTaskFindOne = Task.findOne;
  const originalPregnancyFindOne = Pregnancy.findOne;
  t.after(() => {
    Task.findOne = originalTaskFindOne;
    Pregnancy.findOne = originalPregnancyFindOne;
  });

  const task = {
    _id: "task-1",
    technicianId: "tech-1",
    taskType: "Calving",
    relatedRecordType: "pregnancy",
    relatedRecordId: "pregnancy-1",
    metadata: { inseminationId: "ai-1" },
    farmerId: { _id: "farmer-1", name: "Farmer One" },
    animalIds: [{ _id: "animal-1", earTag: "C-101" }],
    toObject() {
      return { ...this };
    },
  };
  const insemination = {
    _id: "ai-1",
    attemptNumber: 2,
    sireBreed: "Brahman",
  };
  const pregnancy = {
    _id: "pregnancy-1",
    targetCalvingDate: new Date("2026-08-20T00:00:00.000Z"),
    pregnancyDiagnosis: { result: "Pregnant" },
    inseminationId: insemination,
  };

  let pregnancyQuery;
  Task.findOne = () => queryResult(task);
  Pregnancy.findOne = (query) => {
    pregnancyQuery = query;
    return queryResult(pregnancy);
  };

  const req = { params: { id: "task-1" }, user: { _id: "tech-1", role: "technician" } };
  const res = mockResponse();
  await getTaskById(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(pregnancyQuery, { _id: "pregnancy-1", deletedAt: null });
  assert.equal(res.body.pregnancy._id, "pregnancy-1");
  assert.equal(res.body.insemination._id, "ai-1");
  assert.equal(res.body.insemination.attemptNumber, 2);
});
