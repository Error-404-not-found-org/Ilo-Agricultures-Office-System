import test from "node:test";
import assert from "node:assert/strict";
import { Insemination } from "../src/models/insemination.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Calving } from "../src/models/calving.model.js";
import { buildAIRequestMutationOwnershipGuard } from "../src/policies/request.policy.js";
import { getMonthlyAccomplishmentReport } from "../src/controllers/report.controllers.js";
import reportRouter from "../src/routes/report.routes.js";

const day = (iso) => new Date(iso);
const animal = { _id: "dam-1", animalId: "BS-001", earTag: "EAR-1", brand: "B-1", species: "Cattle", breed: "Brahman", color: "Brown" };
const farmer = { _id: "farmer-1", name: "Farmer One", address: { barangay: "San Isidro" } };
const owner = { _id: "tech-1", name: "Technician One" };
const peer = { _id: "tech-2", name: "Technician Two" };

const invoke = async (month = "10", year = "2026", serviceType = "ai") => {
  let statusCode = 200;
  let body;
  await getMonthlyAccomplishmentReport(
    { query: { month, year, serviceType }, user: { _id: "tech-1", role: "technician" } },
    { status(code) { statusCode = code; return this; }, json(value) { body = value; return this; } },
  );
  return { statusCode, body };
};

const inRange = (date, bounds) => date instanceof Date && date >= bounds.$gte && date < bounds.$lt;
const matchesAI = (record, filter) => {
  if (record.deletedAt != null || record.status !== filter.status || !inRange(record.inseminationDate, filter.inseminationDate)) return false;
  const approvedBy = record.approvedBy?._id || record.approvedBy;
  const technicianId = record.technicianId?._id || record.technicianId;
  return [approvedBy, technicianId].filter(Boolean).every((id) => id === "tech-1") && [approvedBy, technicianId].some(Boolean);
};

test("monthly AI accomplishment returns only owner-scoped canonical-date anchors and truthful fields", async () => {
  const aiRecords = [
    { _id: "ai-1", animalId: animal, farmerId: farmer, technicianId: owner, approvedBy: owner, status: "done", deletedAt: null, inseminationDate: day("2026-10-02T16:00:00Z"), createdAt: day("2026-09-01T00:00:00Z"), attemptNumber: 1, estrus: "Natural", sireBreed: "Brahman", sireCode: "S-1", semenDosesUsed: 2, outcome: "Pending" },
    { _id: "ai-2", animalId: animal, farmerId: farmer, technicianId: owner, approvedBy: owner, status: "done", deletedAt: null, inseminationDate: day("2026-10-24T00:00:00Z"), attemptNumber: 2 },
    { _id: "ai-old", animalId: animal, farmerId: farmer, technicianId: owner, approvedBy: owner, status: "done", deletedAt: null, inseminationDate: day("2026-09-30T15:59:59Z") },
    { _id: "ai-next", animalId: animal, farmerId: farmer, technicianId: owner, approvedBy: owner, status: "done", deletedAt: null, inseminationDate: day("2026-10-31T16:00:00Z") },
    { _id: "ai-no-date", animalId: animal, farmerId: farmer, technicianId: owner, approvedBy: owner, status: "done", deletedAt: null, createdAt: day("2026-10-05T00:00:00Z") },
    { _id: "ai-peer", animalId: animal, farmerId: farmer, technicianId: peer, approvedBy: peer, status: "done", deletedAt: null, inseminationDate: day("2026-10-05T00:00:00Z") },
    { _id: "ai-pending", animalId: animal, farmerId: farmer, technicianId: owner, approvedBy: owner, status: "pending", deletedAt: null, inseminationDate: day("2026-10-05T00:00:00Z") },
  ];
  const pregnancyRecords = [
    { _id: "pd-1", animalId: animal, farmerId: farmer, inseminationId: { _id: "ai-1", attemptNumber: 1 }, confirmation: { confirmedBy: owner, methodCode: "ultrasound" }, pregnancyDiagnosis: { date: day("2026-10-31T15:59:59Z"), result: "Empty" }, targetCalvingDate: null, deletedAt: null },
    { _id: "pd-2", animalId: animal, farmerId: farmer, inseminationId: { _id: "ai-2", attemptNumber: 2 }, confirmation: { confirmedBy: owner, methodCode: "rectal_palpation" }, pregnancyDiagnosis: { date: day("2026-09-30T16:00:00Z"), result: "Pregnant" }, targetCalvingDate: day("2027-07-01T00:00:00Z"), deletedAt: null },
    { _id: "pd-peer", animalId: animal, farmerId: farmer, confirmation: { confirmedBy: peer }, pregnancyDiagnosis: { date: day("2026-10-02T00:00:00Z"), result: "Pregnant" }, deletedAt: null },
    { _id: "pd-entry", animalId: animal, farmerId: farmer, confirmation: { confirmedBy: owner }, pregnancyDiagnosis: { date: day("2026-09-30T15:59:59Z"), result: "Pregnant" }, createdAt: day("2026-10-02T00:00:00Z"), deletedAt: null },
  ];
  const calvingRecords = [
    { _id: "cd-zero", animalId: animal, farmerId: farmer, technicianId: owner, pregnancyId: "pd-1", inseminationId: "ai-1", date: day("2026-10-01T00:00:00Z"), outcome: "stillbirth", totalDelivered: 0, livingCalfCount: 0, stillbornCount: 0, calves: [{ animalId: { _id: "calf-1", earTag: "C-1" }, sex: "F" }], deletedAt: null },
    { _id: "cd-missing", animalId: animal, farmerId: farmer, technicianId: owner, date: day("2026-10-20T00:00:00Z"), outcome: "live_birth", calves: [], deletedAt: null },
    { _id: "cd-peer", animalId: animal, farmerId: farmer, technicianId: peer, date: day("2026-10-20T00:00:00Z"), deletedAt: null },
    { _id: "cd-next", animalId: animal, farmerId: farmer, technicianId: owner, date: day("2026-10-31T16:00:00Z"), deletedAt: null },
  ];
  const originals = [Insemination.find, Pregnancy.find, Calving.find];
  const seen = [];
  Insemination.find = (filter) => { seen.push(filter); return { populate() { return this; }, lean: async () => aiRecords.filter((item) => matchesAI(item, filter)) }; };
  Pregnancy.find = (filter) => { seen.push(filter); return { populate() { return this; }, lean: async () => pregnancyRecords.filter((item) => item.deletedAt === null && (item.confirmation?.confirmedBy?._id || item.confirmation?.confirmedBy) === filter["confirmation.confirmedBy"] && inRange(item.pregnancyDiagnosis?.date, filter["pregnancyDiagnosis.date"])) }; };
  Calving.find = (filter) => { seen.push(filter); return { populate() { return this; }, lean: async () => calvingRecords.filter((item) => item.deletedAt === null && (item.technicianId?._id || item.technicianId) === filter.technicianId && inRange(item.date, filter.date)) }; };
  try {
    const { statusCode, body } = await invoke();
    assert.equal(statusCode, 200);
    assert.equal(body.serviceType, "ai");
    assert.equal(body.count, 2);
    assert.deepEqual(body.records.map((item) => item.recordId), ["ai-1", "ai-2"]);
    assert.deepEqual(body.context, { artificialInsemination: [], pregnancyDiagnosis: [] });
    assert.deepEqual(seen[0].$and, buildAIRequestMutationOwnershipGuard({ technicianId: "tech-1" }).$and);
    assert.equal(body.records[0].serviceDate, aiRecords[0].inseminationDate);
    assert.equal(body.records[0].semenDosesUsed, 2);
    assert.equal(body.records[0].outcome, "Pending");
    assert.equal(body.records[0].brand, "B-1");
    assert.equal(body.records[0].color, "Brown");
    assert.equal(Object.hasOwn(body.records[0], "createdAt"), false);
    assert.equal(seen[0].inseminationDate.$gte.toISOString(), "2026-09-30T16:00:00.000Z");
    assert.equal(seen[0].inseminationDate.$lt.toISOString(), "2026-10-31T16:00:00.000Z");
  } finally {
    [Insemination.find, Pregnancy.find, Calving.find] = originals;
  }
});

test("monthly accomplishment rejects invalid month and year before querying records", async () => {
  for (const [month, year] of [["0", "2026"], ["13", "2026"], ["abc", "2026"], ["1.5", "2026"], ["10", "abc"], ["10", "26"]]) {
    const result = await invoke(month, year);
    assert.equal(result.statusCode, 400, `${month}/${year}`);
  }
});

test("monthly accomplishment route denies Admin while allowing Technician", () => {
  const route = reportRouter.stack.find((layer) => layer.route?.path === "/monthly-accomplishment").route;
  const roleGuard = route.stack[1].handle;
  for (const [role, expected] of [["admin", 403], ["technician", 200]]) {
    let statusCode = 200;
    let continued = false;
    roleGuard({ user: { role } }, { status(code) { statusCode = code; return this; }, json() {} }, () => { continued = true; });
    assert.equal(statusCode, expected);
    assert.equal(continued, role === "technician");
  }
});
