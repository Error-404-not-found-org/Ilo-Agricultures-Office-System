import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAnimalDirectoryMetricQueries,
  getAllAnimals,
} from "../src/controllers/animals.controllers.js";
import { getManilaMonthUtcRange } from "../src/domain/service-date-time.js";
import { Animal } from "../src/models/animal.model.js";

const queryResult = (value) => {
  const chain = {
    populate() { return chain; },
    sort() { return chain; },
    skip() { return chain; },
    limit() { return chain; },
    lean() { return Promise.resolve(value); },
  };
  return chain;
};

const responseRecorder = () => {
  const recorder = { statusCode: 200, body: null };
  recorder.response = {
    status(code) { recorder.statusCode = code; return this; },
    json(body) { recorder.body = body; return this; },
  };
  return recorder;
};

test("Animal directory metrics share the complete filtered scope and ignore pagination", () => {
  const filteredScope = {
    $and: [
      { deletedAt: null, species: "Carabao", gender: "Female" },
      { earTag: { $regex: "01", $options: "i" } },
    ],
  };

  const queries = buildAnimalDirectoryMetricQueries(
    filteredScope,
    new Date("2026-09-15T10:00:00.000Z"),
  );

  assert.equal(queries.animalsFound, filteredScope);
  assert.equal(queries.inseminated.$and[0], filteredScope);
  assert.deepEqual(queries.inseminated.$and[1], {
    reproductiveStatus: "Inseminated",
  });
  assert.equal(queries.pregnant.$and[0], filteredScope);
  assert.deepEqual(queries.pregnant.$and[1], {
    reproductiveStatus: "Pregnant",
  });
  assert.equal(queries.expectedCalvingThisMonth.$and[0], filteredScope);
  assert.equal("page" in queries.animalsFound, false);
  assert.equal("limit" in queries.animalsFound, false);
});

test("Expected-calving metric uses pregnant status and Asia/Manila month boundaries", () => {
  const range = getManilaMonthUtcRange(
    new Date("2026-09-30T15:59:59.999Z"),
  );
  assert.equal(range.start.toISOString(), "2026-08-31T16:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-09-30T16:00:00.000Z");

  const query = buildAnimalDirectoryMetricQueries(
    { deletedAt: null },
    new Date("2026-09-30T15:59:59.999Z"),
  ).expectedCalvingThisMonth;
  assert.deepEqual(query.$and[1], { reproductiveStatus: "Pregnant" });
  assert.deepEqual(query.$and[2], {
    expectedCalvingDate: { $gte: range.start, $lt: range.end },
  });
});

test("Manila month changes at midnight even when UTC is still the prior day", () => {
  const beforeMidnight = getManilaMonthUtcRange(
    new Date("2026-09-30T15:59:59.999Z"),
  );
  const atMidnight = getManilaMonthUtcRange(
    new Date("2026-09-30T16:00:00.000Z"),
  );

  assert.equal(beforeMidnight.start.toISOString(), "2026-08-31T16:00:00.000Z");
  assert.equal(atMidnight.start.toISOString(), "2026-09-30T16:00:00.000Z");
  assert.equal(atMidnight.end.toISOString(), "2026-10-31T16:00:00.000Z");
});

test("Paginated directory response exposes full filtered metrics without changing legacy summary", async (t) => {
  const originalFind = Animal.find;
  const originalCountDocuments = Animal.countDocuments;
  t.after(() => {
    Animal.find = originalFind;
    Animal.countDocuments = originalCountDocuments;
  });

  Animal.find = () => queryResult([{ _id: "one-visible-row" }]);
  const counts = [42, 30, 7, 15, 12, 3];
  const countQueries = [];
  Animal.countDocuments = async (query) => {
    countQueries.push(query);
    return counts[countQueries.length - 1];
  };

  const recorder = responseRecorder();
  await getAllAnimals(
    {
      user: { role: "technician" },
      query: { page: "2", limit: "1", species: "Carabao", gender: "Female" },
    },
    recorder.response,
  );

  assert.equal(recorder.statusCode, 200);
  assert.equal(recorder.body.animals.length, 1);
  assert.equal(recorder.body.total, 42);
  assert.deepEqual(recorder.body.metrics, {
    animalsFound: 42,
    inseminated: 12,
    pregnant: 7,
    expectedCalvingThisMonth: 3,
  });
  assert.deepEqual(recorder.body.summary, {
    total: 42,
    cattle: 30,
    pregnant: 7,
    available: 15,
  });
  for (const metricQuery of [countQueries[0], countQueries[2].$and[0], countQueries[4].$and[0], countQueries[5].$and[0]]) {
    assert.equal(metricQuery.species, "Carabao");
    assert.equal(metricQuery.gender, "Female");
    assert.equal(metricQuery.deletedAt, null);
    assert.equal("page" in metricQuery, false);
    assert.equal("limit" in metricQuery, false);
  }
});
