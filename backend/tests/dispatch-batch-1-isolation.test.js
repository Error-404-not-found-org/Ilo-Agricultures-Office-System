import assert from "node:assert/strict";
import test from "node:test";
import { getTechnicianDashboardData, getTechnicianRequests } from "../src/controllers/technician.controllers.js";
import { Insemination } from "../src/models/insemination.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { Task } from "../src/models/task.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Calving } from "../src/models/calving.model.js";
import { Animal } from "../src/models/animal.model.js";

const mockResponse = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

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

test("Dispatch Batch 1: Immediate visibility and privacy containment", async (t) => {
  const originals = {
    inseminationFind: Insemination.find,
    inseminationCount: Insemination.countDocuments,
    healthFind: HealthRequest.find,
    healthCount: HealthRequest.countDocuments,
    taskFind: Task.find,
    taskCount: Task.countDocuments,
    pregnancyCount: Pregnancy.countDocuments,
    calvingCount: Calving.countDocuments,
    animalCount: Animal.countDocuments,
  };

  t.after(() => {
    Insemination.find = originals.inseminationFind;
    Insemination.countDocuments = originals.inseminationCount;
    HealthRequest.find = originals.healthFind;
    HealthRequest.countDocuments = originals.healthCount;
    Task.find = originals.taskFind;
    Task.countDocuments = originals.taskCount;
    Pregnancy.countDocuments = originals.pregnancyCount;
    Calving.countDocuments = originals.calvingCount;
    Animal.countDocuments = originals.animalCount;
  });

  await t.test("Dashboard: Tech A's visit absent from Tech B dashboard and calendar", async () => {
    let capturedAiQuery;
    let capturedHealthQuery;

    Insemination.countDocuments = (query) => {
      capturedAiQuery = query;
      return Promise.resolve(0);
    };
    HealthRequest.countDocuments = (query) => {
      capturedHealthQuery = query;
      return Promise.resolve(0);
    };
    Pregnancy.countDocuments = () => Promise.resolve(0);
    Calving.countDocuments = () => Promise.resolve(0);
    Animal.countDocuments = () => Promise.resolve(0);
    Animal.aggregate = () => Promise.resolve([]);

    const aiRecords = [
      {
        _id: "ai-1",
        status: "scheduled",
        scheduledDate: new Date(),
        approvedBy: { _id: "tech-b" },
        technicianId: "tech-b",
      },
      {
        _id: "ai-2",
        status: "scheduled",
        scheduledDate: new Date(),
        visitPeriod: "morning",
        approvedBy: { _id: "tech-a" },
        technicianId: "tech-a",
      }
    ];

    Insemination.find = () => queryResult(aiRecords);
    HealthRequest.find = () => queryResult([]);
    Task.find = () => queryResult([]);

    const req = { user: { _id: "tech-a", role: "technician" }, query: {} };
    const res = mockResponse();

    await getTechnicianDashboardData(req, res);

    assert.equal(res.statusCode, 200);
    // Only tech-a's records should appear in agendaItems
    assert.equal(res.body.agendaItems.length, 1);
    assert.equal(res.body.agendaItems[0].id, "ai-2");
    assert.equal(res.body.agendaItems[0].visitPeriod, "morning");

    // Test unassigned request keys
    const unassignedAiRecord = {
      _id: "ai-unassigned",
      status: "pending",
      createdAt: new Date(),
      farmerId: { name: "Test Farmer", phoneNumber: "1234", address: { city: "Iloilo" } },
      animalId: { earTag: "T1" }
    };
    Insemination.find = () => queryResult([unassignedAiRecord]);
    const req2 = { user: { _id: "tech-a", role: "technician" }, query: {} };
    const res2 = mockResponse();
    await getTechnicianDashboardData(req2, res2);

    assert.equal(res2.body.pendingRequests.length, 1);
    const candidateItem = res2.body.pendingRequests[0];
    // Farmer display name is required by the request-card contract.
    // Contact information and precise location remain claim-gated.
    // The display name and profile image are card presentation fields.
    const expectedKeys = [
      "id", "type", "status", "isReadyToday", "time", "preferredTime",
      "displayDate", "farmer", "farmerImageUrl", "animalTag", "municipality", "barangay", "displayStatus",
      "task", "urgent", "overdue", "sentTime", "createdAt"
    ].sort();
    assert.deepEqual(Object.keys(candidateItem).sort(), expectedKeys);

    // Also verify stats queries contain assignee filters for Tech A
    assert.ok(capturedAiQuery.$or);
    assert.deepEqual(capturedAiQuery.$or, [
      { approvedBy: "tech-a" },
      { technicianId: "tech-a" },
    ]);
  });

  await t.test("Stats: Pregnancy uses confirmation.confirmedBy and Calving uses technicianId", async () => {
    let capturedPregnancyQuery;
    let capturedCalvingQuery;

    Pregnancy.countDocuments = (query) => {
      capturedPregnancyQuery = query;
      return Promise.resolve(1);
    };
    Calving.countDocuments = (query) => {
      capturedCalvingQuery = query;
      return Promise.resolve(1);
    };

    const req = { user: { _id: "tech-a", role: "technician" }, query: {} };
    const res = mockResponse();

    await getTechnicianDashboardData(req, res);

    assert.equal(capturedPregnancyQuery["confirmation.confirmedBy"], "tech-a");
    assert.equal(capturedPregnancyQuery.technicianId, undefined);
    assert.equal(capturedCalvingQuery.technicianId, "tech-a");
  });

  await t.test("Requests: unassigned AI and Health responses contain Farmer name while remaining candidate-safe", async () => {
    Task.countDocuments = () => Promise.resolve(0);
    Insemination.find = () => queryResult([{
      _id: "ai-unassigned",
      status: "pending",
      createdAt: new Date(),
      farmerId: { name: "Test Farmer", phoneNumber: "1234", address: { city: "Iloilo" } },
      animalId: { earTag: "T1" }
    }]);
    HealthRequest.find = () => queryResult([{
      _id: "health-unassigned",
      status: "pending",
      createdAt: new Date(),
      farmerId: { name: "Health Farmer", phone: "5678", address: { city: "Oton" } },
      animalId: { earTag: "T2" }
    }]);

    const req = { user: { _id: "tech-a", role: "technician" }, query: { assignment: "unassigned" } };
    const res = mockResponse();

    await getTechnicianRequests(req, res);

    assert.equal(res.statusCode, 200);
    const requests = res.body.requests;

    const aiReq = requests.find(r => r.type === "ai");
    assert.ok(aiReq, "Should return an AI request");
    assert.equal(aiReq.farmer, "Test Farmer");
    assert.equal(aiReq.raw, undefined);
    assert.equal(aiReq.farmerPhone, undefined);

    const healthReq = requests.find(r => r.type === "health");
    assert.ok(healthReq, "Should return a Health request");
    assert.equal(healthReq.farmer, "Health Farmer");
    assert.equal(healthReq.raw, undefined);
    assert.equal(healthReq.farmerPhone, undefined);
  });
});
