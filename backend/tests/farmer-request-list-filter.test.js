import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFarmerRequestStatusFilter,
} from "../src/domain/farmer-request-list-filter.js";
import { getMyHealthRequests } from "../src/controllers/health-request.controllers.js";
import { getMyRequests } from "../src/controllers/ai-request.controllers.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { Insemination } from "../src/models/insemination.model.js";

const responseRecorder = () => {
  const recorder = { statusCode: 200, body: null };
  recorder.response = {
    status(code) {
      recorder.statusCode = code;
      return this;
    },
    json(payload) {
      recorder.body = payload;
      return this;
    },
  };
  return recorder;
};

const populatedQuery = (value) => {
  const query = {
    populate() {
      return query;
    },
    sort() {
      return query;
    },
    skip() {
      return query;
    },
    limit() {
      return query;
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
  return query;
};

test("Health Pending group includes review states and excludes scheduled", () => {
  assert.deepEqual(
    buildFarmerRequestStatusFilter("health", { statusGroup: "pending" }),
    { $in: ["pending", "approved", "assigned", "triaged"] },
  );
});

test("Health In Progress group includes both persisted aliases", () => {
  assert.deepEqual(
    buildFarmerRequestStatusFilter("health", {
      statusGroup: "in_progress",
    }),
    { $in: ["in-progress", "in_progress"] },
  );
});

test("AI In Progress group includes canonical and legacy aliases", () => {
  assert.deepEqual(
    buildFarmerRequestStatusFilter("ai", { statusGroup: "in_progress" }),
    { $in: ["in-progress", "in_progress"] },
  );
});

test("exact statuses and all preserve the existing query contract", () => {
  assert.equal(
    buildFarmerRequestStatusFilter("health", { status: "scheduled" }),
    "scheduled",
  );
  assert.equal(
    buildFarmerRequestStatusFilter("health", { status: "all" }),
    undefined,
  );
});

test("unknown status groups are rejected instead of widening the query", () => {
  assert.throws(
    () =>
      buildFarmerRequestStatusFilter("health", {
        statusGroup: "not_a_group",
      }),
    (error) =>
      error?.status === 400 && error?.code === "INVALID_REQUEST_STATUS_GROUP",
  );
});

test("Health Pending filtering is applied before database pagination and counting", async (t) => {
  const originalFind = HealthRequest.find;
  const originalCount = HealthRequest.countDocuments;
  t.after(() => {
    HealthRequest.find = originalFind;
    HealthRequest.countDocuments = originalCount;
  });

  let findQuery;
  let countQuery;
  HealthRequest.find = (query) => {
    findQuery = query;
    return populatedQuery([]);
  };
  HealthRequest.countDocuments = async (query) => {
    countQuery = query;
    return 0;
  };

  const recorder = responseRecorder();
  await getMyHealthRequests(
    {
      user: { _id: "farmer-1" },
      query: { page: "2", limit: "10", statusGroup: "pending" },
    },
    recorder.response,
  );

  assert.equal(recorder.statusCode, 200);
  assert.deepEqual(findQuery.status, {
    $in: ["pending", "approved", "assigned", "triaged"],
  });
  assert.deepEqual(countQuery.status, findQuery.status);
});

test("AI In Progress filtering is applied before database pagination and counting", async (t) => {
  const originalFind = Insemination.find;
  const originalCount = Insemination.countDocuments;
  t.after(() => {
    Insemination.find = originalFind;
    Insemination.countDocuments = originalCount;
  });

  let findQuery;
  let countQuery;
  Insemination.find = (query) => {
    findQuery = query;
    return populatedQuery([]);
  };
  Insemination.countDocuments = async (query) => {
    countQuery = query;
    return 0;
  };

  const recorder = responseRecorder();
  await getMyRequests(
    {
      user: { _id: "farmer-1" },
      query: { page: "3", limit: "10", statusGroup: "in_progress" },
    },
    recorder.response,
  );

  assert.equal(recorder.statusCode, 200);
  assert.deepEqual(findQuery.status, { $in: ["in-progress", "in_progress"] });
  assert.deepEqual(countQuery.status, findQuery.status);
});

test("invalid grouped query returns 400 before reading Farmer request data", async (t) => {
  const originalFind = HealthRequest.find;
  t.after(() => {
    HealthRequest.find = originalFind;
  });
  let findCalled = false;
  HealthRequest.find = () => {
    findCalled = true;
    return populatedQuery([]);
  };

  const recorder = responseRecorder();
  await getMyHealthRequests(
    {
      user: { _id: "farmer-1" },
      query: { statusGroup: "unsupported" },
    },
    recorder.response,
  );

  assert.equal(recorder.statusCode, 400);
  assert.equal(recorder.body.code, "INVALID_REQUEST_STATUS_GROUP");
  assert.equal(findCalled, false);
});
