import test from "node:test";
import assert from "node:assert/strict";

import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Calving } from "../src/models/calving.model.js";
import {
  getMyPregnancyChecks,
  getMyCalvings,
} from "../src/controllers/technician.controllers.js";

const ownerId = "technician-owner";
const peerId = "technician-peer";

const pregnancyRecords = [
  { _id: "pregnancy-own", deletedAt: null, confirmation: { stage: "confirmed", confirmedBy: ownerId } },
  { _id: "pregnancy-peer", deletedAt: null, confirmation: { stage: "confirmed", confirmedBy: peerId } },
  { _id: "pregnancy-archived", deletedAt: new Date(), confirmation: { stage: "confirmed", confirmedBy: ownerId } },
];

const calvingRecords = [
  { _id: "calving-own", deletedAt: null, technicianId: ownerId },
  { _id: "calving-peer", deletedAt: null, technicianId: peerId },
  { _id: "calving-archived", deletedAt: new Date(), technicianId: ownerId },
];

const matches = (record, filter) =>
  record.deletedAt === filter.deletedAt &&
  (!Object.hasOwn(filter, "confirmation.confirmedBy") ||
    record.confirmation?.confirmedBy === filter["confirmation.confirmedBy"]) &&
  (!Object.hasOwn(filter, "technicianId") || record.technicianId === filter.technicianId);

const withListFixture = async (Model, records, run) => {
  const originalFind = Model.find;
  const originalCount = Model.countDocuments;
  Model.find = (filter) => ({
    populate() { return this; },
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    lean: async () => records.filter((record) => matches(record, filter)),
  });
  Model.countDocuments = async (filter) => records.filter((record) => matches(record, filter)).length;
  try {
    await run();
  } finally {
    Model.find = originalFind;
    Model.countDocuments = originalCount;
  }
};

const invoke = async (handler, role, actorId) => {
  let statusCode = 200;
  let body;
  await handler(
    { user: { _id: actorId, role }, query: { page: "1", limit: "10" } },
    { status(code) { statusCode = code; return this; }, json(value) { body = value; return this; } },
  );
  return { statusCode, body };
};

for (const { label, Model, records, handler, ownId, peerRecordId } of [
  { label: "Pregnancy", Model: Pregnancy, records: pregnancyRecords, handler: getMyPregnancyChecks, ownId: "pregnancy-own", peerRecordId: "pregnancy-peer" },
  { label: "Calving", Model: Calving, records: calvingRecords, handler: getMyCalvings, ownId: "calving-own", peerRecordId: "calving-peer" },
]) {
  test(`${label} list retains the viewing Technician's record but excludes peer and archived records`, () =>
    withListFixture(Model, records, async () => {
      const result = await invoke(handler, "technician", ownerId);
      assert.equal(result.statusCode, 200);
      assert.deepEqual(result.body.data.map((record) => record._id), [ownId]);
      assert.equal(result.body.pagination.total, 1);

      const peerResult = await invoke(handler, "technician", peerId);
      assert.equal(peerResult.statusCode, 200);
      assert.deepEqual(peerResult.body.data.map((record) => record._id), [peerRecordId]);
      assert.equal(peerResult.body.pagination.total, 1);
    }));

  test(`${label} list preserves authorized Admin visibility of active records`, () =>
    withListFixture(Model, records, async () => {
      const result = await invoke(handler, "admin", "admin-one");
      assert.equal(result.statusCode, 200);
      assert.deepEqual(result.body.data.map((record) => record._id), [ownId, peerRecordId]);
      assert.equal(result.body.pagination.total, 2);
    }));
}
