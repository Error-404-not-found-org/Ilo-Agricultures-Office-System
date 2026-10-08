import test from "node:test";
import assert from "node:assert/strict";
import { Insemination } from "../src/models/insemination.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Calving } from "../src/models/calving.model.js";
import { getMonthlyAccomplishmentReport } from "../src/controllers/report.controllers.js";

const date = (value) => new Date(value);
const animal = { _id: "animal-1", animalId: "A-1", earTag: "EAR-1", species: "Beef" };
const farmer = { _id: "farmer-1", name: "Farmer One", address: { barangay: "Botong" } };
const owner = { _id: "tech-1", name: "Owner" };
const peer = { _id: "tech-2", name: "Peer" };
const ai = (id, tech, when) => ({ _id: id, animalId: animal, farmerId: farmer, technicianId: tech, approvedBy: tech, status: "done", deletedAt: null, inseminationDate: date(when), attemptNumber: id === "ai-own" ? 1 : 2, sireCode: id });
const pd = (id, tech, aiId, when) => ({ _id: id, animalId: animal, farmerId: farmer, inseminationId: { _id: aiId }, confirmation: { confirmedBy: tech }, pregnancyDiagnosis: { date: date(when), result: "Pregnant" }, deletedAt: null });
const cd = (id, tech, pdId, aiId, when) => ({ _id: id, animalId: animal, farmerId: farmer, technicianId: tech, pregnancyId: pdId, inseminationId: aiId, date: date(when), calves: [], deletedAt: null });

const fixtures = {
  ai: [ai("ai-own", owner, "2026-03-10T00:00:00Z"), ai("ai-peer", peer, "2026-03-11T00:00:00Z"), ai("ai-sep", owner, "2026-09-10T00:00:00Z")],
  pd: [pd("pd-own", owner, "ai-own", "2026-04-10T00:00:00Z"), pd("pd-peer", peer, "ai-peer", "2026-04-11T00:00:00Z"), pd("pd-sep", owner, "ai-peer", "2026-09-11T00:00:00Z")],
  cd: [cd("cd-own", owner, "pd-own", "ai-own", "2026-09-12T00:00:00Z"), cd("cd-peer-pd", owner, "pd-peer", "ai-own", "2026-09-13T00:00:00Z"), cd("cd-conflict", owner, "pd-own", "ai-peer", "2026-09-14T00:00:00Z"), cd("cd-peer", peer, "pd-peer", "ai-peer", "2026-09-15T00:00:00Z")],
};

const id = (value) => value?._id ?? value;
const permittedAI = (record, filter) => {
  const actor = "tech-1";
  const owners = [id(record.approvedBy), id(record.technicianId)].filter(Boolean);
  return filter.deletedAt === null && filter.status === "done" && owners.includes(actor) && owners.every((value) => value === actor);
};
const matches = (record, filter, kind) => {
  if (record.deletedAt !== null) return false;
  if (filter._id?.$in && !filter._id.$in.includes(id(record))) return false;
  if (kind === "ai" && !permittedAI(record, filter)) return false;
  if (kind === "pd" && id(record.confirmation.confirmedBy) !== filter["confirmation.confirmedBy"]) return false;
  if (kind === "cd" && id(record.technicianId) !== filter.technicianId) return false;
  const field = kind === "ai" ? "inseminationDate" : kind === "pd" ? "pregnancyDiagnosis.date" : "date";
  const value = kind === "pd" ? record.pregnancyDiagnosis.date : record[field];
  return !filter[field]?.$gte || (value >= filter[field].$gte && value < filter[field].$lt);
};

const withFixtures = async (run) => {
  const originals = [Insemination.find, Pregnancy.find, Calving.find];
  const queried = [];
  for (const [model, kind] of [[Insemination, "ai"], [Pregnancy, "pd"], [Calving, "cd"]]) {
    model.find = (filter) => {
      queried.push({ kind, filter });
      return { populate() { return this; }, lean: async () => fixtures[kind].filter((record) => matches(record, filter, kind)) };
    };
  }
  try { return await run(queried); }
  finally { [Insemination.find, Pregnancy.find, Calving.find] = originals; }
};

const invoke = async (serviceType, month = "9") => {
  let statusCode = 200;
  let body;
  await getMonthlyAccomplishmentReport(
    { query: { month, year: "2026", serviceType }, user: { _id: "tech-1", role: "technician" } },
    { status(code) { statusCode = code; return this; }, json(value) { body = value; return this; } },
  );
  return { statusCode, body };
};

test("AI report anchors only September AI and has no historical context", () => withFixtures(async () => {
  const { statusCode, body } = await invoke("ai");
  assert.equal(statusCode, 200);
  assert.equal(body.serviceType, "ai");
  assert.equal(body.count, 1);
  assert.deepEqual(body.records.map((record) => record.recordId), ["ai-sep"]);
  assert.deepEqual(body.context, { artificialInsemination: [], pregnancyDiagnosis: [] });
}));

test("PD report retains its anchor but hides peer-owned exact AI context", () => withFixtures(async () => {
  const { body } = await invoke("pregnancy");
  assert.equal(body.count, 1);
  assert.deepEqual(body.records.map((record) => record.recordId), ["pd-sep"]);
  assert.equal(body.records[0].linkedInseminationId, null);
  assert.deepEqual(body.context.artificialInsemination, []);
  assert.deepEqual(body.context.pregnancyDiagnosis, []);
}));

test("PD report fetches only its exact authorized earlier AI, without counting it", () => withFixtures(async (queried) => {
  const { body } = await invoke("pregnancy", "4");
  assert.equal(body.count, 1);
  assert.deepEqual(body.records.map((record) => record.recordId), ["pd-own"]);
  assert.deepEqual(body.context.artificialInsemination.map((record) => record.recordId), ["ai-own"]);
  assert.equal(body.context.artificialInsemination[0].serviceDate.toISOString(), "2026-03-10T00:00:00.000Z");
  assert.deepEqual(queried.find(({ kind }) => kind === "ai").filter._id.$in, ["ai-own"]);
  assert.equal(Object.hasOwn(body.context.artificialInsemination[0], "technicianNote"), false);
}));

test("Calving report includes only owned anchors and exact authorized earlier history", () => withFixtures(async (queried) => {
  const { body } = await invoke("calving");
  assert.equal(body.count, 3);
  assert.deepEqual(body.records.map((record) => record.recordId), ["cd-own", "cd-peer-pd", "cd-conflict"]);
  assert.equal(body.records[1].linkedPregnancyId, null);
  assert.equal(body.records[1].linkedInseminationId, "ai-own");
  assert.equal(body.records[2].linkedPregnancyId, null);
  assert.equal(body.records[2].linkedInseminationId, null);
  assert.deepEqual(body.context.pregnancyDiagnosis.map((record) => record.recordId), ["pd-own"]);
  assert.deepEqual(body.context.artificialInsemination.map((record) => record.recordId), ["ai-own"]);
  assert.deepEqual(queried.find(({ kind }) => kind === "pd").filter._id.$in, ["pd-own", "pd-peer"]);
  assert.deepEqual(queried.find(({ kind }) => kind === "ai").filter._id.$in.sort(), ["ai-own", "ai-peer"].sort());
  assert.ok(queried.every(({ kind, filter }) => kind !== "pd" || filter["confirmation.confirmedBy"] === "tech-1"));
  assert.ok(queried.every(({ kind, filter }) => kind !== "ai" || permittedAI(fixtures.ai[0], filter)));
}));

test("unsupported service type fails before querying any records", () => withFixtures(async (queried) => {
  const result = await invoke("health");
  assert.equal(result.statusCode, 400);
  assert.equal(queried.length, 0);
}));
