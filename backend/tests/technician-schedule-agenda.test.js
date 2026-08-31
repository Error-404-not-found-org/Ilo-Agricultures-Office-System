import assert from "node:assert/strict";
import test from "node:test";

import { getTechnicianDashboardData } from "../src/controllers/technician.controllers.js";
import { Animal } from "../src/models/animal.model.js";
import { Calving } from "../src/models/calving.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Task } from "../src/models/task.model.js";

const queryResult = (value) => {
  const query = {
    populate() {
      return query;
    },
    sort() {
      return query;
    },
    lean() {
      return query;
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
  return query;
};

const response = () => ({
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const farmer = {
  name: "Schedule Farmer",
  address: { barangay: "Poblacion", municipality: "Oton" },
};

test("Technician full agenda exposes only owned canonical date-bound work", async (t) => {
  const originals = {
    animalAggregate: Animal.aggregate,
    calvingCount: Calving.countDocuments,
    healthCount: HealthRequest.countDocuments,
    healthFind: HealthRequest.find,
    inseminationCount: Insemination.countDocuments,
    inseminationFind: Insemination.find,
    pregnancyCount: Pregnancy.countDocuments,
    taskFind: Task.find,
  };

  t.after(() => {
    Animal.aggregate = originals.animalAggregate;
    Calving.countDocuments = originals.calvingCount;
    HealthRequest.countDocuments = originals.healthCount;
    HealthRequest.find = originals.healthFind;
    Insemination.countDocuments = originals.inseminationCount;
    Insemination.find = originals.inseminationFind;
    Pregnancy.countDocuments = originals.pregnancyCount;
    Task.find = originals.taskFind;
  });

  Animal.aggregate = () => Promise.resolve([]);
  Calving.countDocuments = () => Promise.resolve(0);
  HealthRequest.countDocuments = () => Promise.resolve(0);
  Insemination.countDocuments = () => Promise.resolve(0);
  Pregnancy.countDocuments = () => Promise.resolve(0);

  await t.test("Schedule agenda includes future PD and Calving Tasks by dueDate", async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    let capturedTaskQuery;
    Task.find = (query) => {
      capturedTaskQuery = query;
      return queryResult([
        {
          _id: "pd-future",
          taskType: "PD",
          status: "Pending",
          dueDate: future,
          technicianId: "tech-a",
          farmerId: farmer,
          animalIds: [],
        },
        {
          _id: "calving-future",
          taskType: "CD",
          status: "Pending",
          dueDate: future,
          technicianId: "tech-a",
          farmerId: farmer,
          animalIds: [],
        },
      ]);
    };
    Insemination.find = () => queryResult([]);
    HealthRequest.find = () => queryResult([]);

    const res = response();
    await getTechnicianDashboardData(
      {
        user: { _id: "tech-a", role: "technician" },
        query: {
          fullAgenda: "true",
          includeFutureDateBoundTasks: "true",
        },
      },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedTaskQuery.$and[0], {
      dueDate: { $ne: null },
    });
    assert.deepEqual(
      res.body.agendaItems.map((item) => item.id),
      ["pd-future", "calving-future"],
    );
    assert.equal(res.body.agendaItems[0].taskId, "pd-future");
    assert.equal(
      new Date(res.body.agendaItems[0].dueDate).getTime(),
      future.getTime(),
    );
  });

  await t.test("Dashboard fullAgenda keeps pending future PD due gating", async () => {
    let capturedTaskQuery;
    Task.find = (query) => {
      capturedTaskQuery = query;
      return queryResult([]);
    };
    Insemination.find = () => queryResult([]);
    HealthRequest.find = () => queryResult([]);

    const res = response();
    await getTechnicianDashboardData(
      {
        user: { _id: "tech-a", role: "technician" },
        query: { fullAgenda: "true" },
      },
      res,
    );

    const pdBranch = capturedTaskQuery.$and[0].$or.find(
      (branch) => branch.taskType?.$in,
    );
    assert.equal(pdBranch.$or[0].status, "Pending");
    assert.ok(pdBranch.$or[0].dueDate.$lte instanceof Date);
  });

  await t.test("Health agenda excludes Advice and Office Pickup", async () => {
    const scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const health = (id, handlingMethod) => ({
      _id: id,
      status: "scheduled",
      scheduledDate,
      visitPeriod: "afternoon",
      handlingMethod,
      handledBy: { _id: "tech-a" },
      farmerId: farmer,
      animalId: { earTag: "H-1" },
    });

    Task.find = () => queryResult([]);
    Insemination.find = () => queryResult([]);
    HealthRequest.find = () =>
      queryResult([
        health("health-farm", "farm_visit"),
        health("health-advice", "advice"),
        health("health-pickup", "office_pickup"),
      ]);

    const res = response();
    await getTechnicianDashboardData(
      {
        user: { _id: "tech-a", role: "technician" },
        query: { fullAgenda: "true" },
      },
      res,
    );

    assert.deepEqual(
      res.body.agendaItems.map((item) => item.id),
      ["health-farm"],
    );
    assert.equal(res.body.agendaItems[0].handlingMethod, "farm_visit");
    assert.equal(
      new Date(res.body.agendaItems[0].scheduledDate).getTime(),
      scheduledDate.getTime(),
    );
  });

  await t.test("AI agenda exposes canonical scheduledDate and visitPeriod", async () => {
    const scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    Task.find = () => queryResult([]);
    HealthRequest.find = () => queryResult([]);
    Insemination.find = () =>
      queryResult([
        {
          _id: "ai-scheduled",
          status: "scheduled",
          scheduledDate,
          visitPeriod: "morning",
          approvedBy: { _id: "tech-a" },
          farmerId: farmer,
          animalId: { earTag: "AI-1" },
        },
      ]);

    const res = response();
    await getTechnicianDashboardData(
      {
        user: { _id: "tech-a", role: "technician" },
        query: { fullAgenda: "true" },
      },
      res,
    );

    assert.equal(res.body.agendaItems[0].id, "ai-scheduled");
    assert.equal(res.body.agendaItems[0].visitPeriod, "morning");
    assert.equal(
      new Date(res.body.agendaItems[0].scheduledDate).getTime(),
      scheduledDate.getTime(),
    );
  });
});
