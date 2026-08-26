import assert from "node:assert/strict";
import test from "node:test";

import { getAnimalById } from "../src/controllers/animals.controllers.js";
import { getAnimalHealthHistory } from "../src/controllers/animal-workflow.controllers.js";
import { getAnimalTimeline } from "../src/services/animal-timeline.service.js";
import { Animal } from "../src/models/animal.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Calving } from "../src/models/calving.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { MedicalRecord } from "../src/models/medical-record.model.js";
import { Task } from "../src/models/task.model.js";
import { AnimalTimelineEvent } from "../src/models/animal-timeline-event.model.js";
import { Config } from "../src/models/config.model.js";
import { filterAnimalWorkForViewer } from "../src/domain/animal-work-visibility.js";

const chain = (value) => {
  const query = {
    populate() {
      return query;
    },
    select() {
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

const document = (value) => ({ ...value, toObject: () => ({ ...value }) });

const responseRecorder = () => {
  const recorder = { statusCode: 200, body: undefined };
  recorder.response = {
    status(code) {
      recorder.statusCode = code;
      return this;
    },
    json(body) {
      recorder.body = body;
      return this;
    },
  };
  return recorder;
};

const viewer = (id, role = "technician") => ({ _id: id, role });

test("animal-centered projections isolate active work between technicians", async (t) => {
  const originals = {
    animalFindOne: Animal.findOne,
    animalFind: Animal.find,
    inseminationFind: Insemination.find,
    pregnancyFind: Pregnancy.find,
    calvingFind: Calving.find,
    healthFind: HealthRequest.find,
    medicalFind: MedicalRecord.find,
    taskFind: Task.find,
    timelineFind: AnimalTimelineEvent.find,
    configFindOne: Config.findOne,
  };

  t.after(() => {
    Animal.findOne = originals.animalFindOne;
    Animal.find = originals.animalFind;
    Insemination.find = originals.inseminationFind;
    Pregnancy.find = originals.pregnancyFind;
    Calving.find = originals.calvingFind;
    HealthRequest.find = originals.healthFind;
    MedicalRecord.find = originals.medicalFind;
    Task.find = originals.taskFind;
    AnimalTimelineEvent.find = originals.timelineFind;
    Config.findOne = originals.configFindOne;
  });

  const animal = document({
    _id: "animal-1",
    farmerId: "farmer-1",
    reproductiveStatus: "Open",
    species: "Cattle",
  });
  const aiActive = document({
    _id: "ai-active-a",
    animalId: "animal-1",
    status: "scheduled",
    approvedBy: { _id: "tech-a", name: "Technician A" },
    technicianId: "tech-a",
    scheduledDate: new Date("2026-09-01T00:00:00.000Z"),
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
  });
  const aiDone = document({
    _id: "ai-done-a",
    animalId: "animal-1",
    status: "done",
    technicianId: "tech-a",
    inseminationDate: new Date("2026-06-01T00:00:00.000Z"),
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
  });
  const healthActive = {
    _id: "health-active-a",
    animalId: "animal-1",
    status: "scheduled",
    handledBy: { _id: "tech-a", name: "Technician A" },
    assignedTechnicianId: "tech-a",
    symptoms: "Coughing",
    createdAt: new Date("2026-08-21T00:00:00.000Z"),
  };
  const taskActive = {
    _id: "task-active-a",
    animalIds: ["animal-1"],
    technicianId: "tech-a",
    taskType: "PD",
    status: "Pending",
    metadata: { inseminationId: "ai-done-a" },
  };
  const medicalRecord = {
    _id: "medical-1",
    animalId: "animal-1",
    healthRequestId: "health-completed-a",
    type: "Treatment",
    date: new Date("2026-07-01T00:00:00.000Z"),
  };

  const installAnimalDetailFixtures = () => {
    Animal.findOne = () => chain(animal);
    Animal.find = () => chain([]);
    Insemination.find = () => chain([aiActive, aiDone]);
    Pregnancy.find = () => chain([]);
    Calving.find = () => chain([]);
    HealthRequest.find = () => chain([healthActive]);
    Task.find = () => chain([taskActive]);
    Config.findOne = () => chain(null);
  };

  await t.test("Animal Details shows owner work, hides it from peers, and preserves completed AI", async () => {
    for (const [actor, expectedActive] of [
      [viewer("tech-a"), true],
      [viewer("tech-b"), false],
      [viewer("admin-1", "admin"), true],
      [viewer("farmer-1", "farmer"), true],
    ]) {
      installAnimalDetailFixtures();
      const recorder = responseRecorder();
      await getAnimalById(
        { user: actor, params: { id: "animal-1" } },
        recorder.response,
      );

      assert.equal(recorder.statusCode, 200);
      assert.equal(
        recorder.body.inseminations.some((item) => item._id === "ai-active-a"),
        expectedActive,
      );
      assert.ok(
        recorder.body.inseminations.some((item) => item._id === "ai-done-a"),
      );
      assert.equal(
        recorder.body.healthRecords.some(
          (item) => item._id === "health-active-a",
        ),
        expectedActive,
      );
      assert.equal(
        JSON.stringify(recorder.body).includes("task-active-a"),
        expectedActive,
      );
    }
  });

  await t.test("Technician animal projections exclude unassigned and ambiguous operational work", () => {
    const result = filterAnimalWorkForViewer(
      {
        inseminations: [
          { _id: "ai-unassigned", status: "pending" },
          {
            _id: "ai-conflicting",
            status: "scheduled",
            technicianId: "tech-a",
            approvedBy: "tech-b",
          },
        ],
        healthRequests: [
          { _id: "health-unassigned", status: "pending" },
        ],
        tasks: [{ _id: "task-unassigned", status: "Pending" }],
      },
      viewer("tech-a"),
    );

    assert.deepEqual(result, {
      inseminations: [],
      healthRequests: [],
      tasks: [],
    });
  });

  await t.test("Timeline omits another technician's active AI and Health events but keeps completed AI", async () => {
    AnimalTimelineEvent.find = () =>
      chain([
        {
          _id: "stored-ai-active",
          sourceType: "Insemination",
          sourceId: "ai-active-a",
          eventType: "ai_scheduled",
          title: "AI scheduled",
          occurredAt: new Date("2026-08-20T00:00:00.000Z"),
        },
        {
          _id: "stored-health-active",
          sourceType: "HealthRequest",
          sourceId: "health-active-a",
          eventType: "health_scheduled",
          title: "Health scheduled",
          occurredAt: new Date("2026-08-21T00:00:00.000Z"),
        },
      ]);
    Insemination.find = () => chain([aiActive, aiDone]);
    Pregnancy.find = () => chain([]);
    Calving.find = () => chain([]);
    HealthRequest.find = () => chain([healthActive]);
    MedicalRecord.find = () => chain([]);

    const techBTimeline = await getAnimalTimeline(
      "animal-1",
      {},
      viewer("tech-b"),
    );
    const techATimeline = await getAnimalTimeline(
      "animal-1",
      {},
      viewer("tech-a"),
    );
    assert.ok(
      techATimeline.some(
        (item) => String(item.sourceId) === "ai-active-a",
      ),
    );
    assert.ok(
      techATimeline.some(
        (item) => String(item.sourceId) === "health-active-a",
      ),
    );
    assert.ok(
      techBTimeline.some(
        (item) => String(item.sourceId) === "ai-done-a",
      ),
    );
    assert.ok(
      techBTimeline.every(
        (item) =>
          !["ai-active-a", "health-active-a"].includes(String(item.sourceId)),
      ),
    );
  });

  await t.test("Health History hides another technician's unresolved request and keeps MedicalRecord", async () => {
    Animal.findOne = async () => animal;
    HealthRequest.find = () => chain([healthActive]);
    MedicalRecord.find = () => chain([medicalRecord]);

    const recorder = responseRecorder();
    await getAnimalHealthHistory(
      {
        user: viewer("tech-b"),
        params: { id: "animal-1" },
        query: {},
      },
      recorder.response,
    );

    assert.equal(recorder.statusCode, 200);
    assert.deepEqual(recorder.body.data.healthRequests, []);
    assert.equal(recorder.body.data.medicalRecords[0]._id, "medical-1");

    const ownerRecorder = responseRecorder();
    await getAnimalHealthHistory(
      {
        user: viewer("tech-a"),
        params: { id: "animal-1" },
        query: {},
      },
      ownerRecorder.response,
    );
    assert.equal(
      ownerRecorder.body.data.healthRequests[0]._id,
      "health-active-a",
    );
  });
});
