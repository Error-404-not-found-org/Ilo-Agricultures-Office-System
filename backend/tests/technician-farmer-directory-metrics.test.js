import assert from "node:assert/strict";
import test from "node:test";

import { User } from "../src/models/user.model.js";
import { Animal } from "../src/models/animal.model.js";
import {
  buildTechnicianFarmerMetricsPipeline,
  getFarmerAppAccountStatus,
  getUsers,
} from "../src/controllers/user.controllers.js";

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

const queryResult = (value) => {
  const query = {
    select() { return query; },
    sort() { return query; },
    skip() { return query; },
    limit() { return query; },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
  return query;
};

test("metrics pipeline uses the full filtered Farmer scope and ignores pagination", () => {
  const match = {
    role: "farmer",
    deletedAt: null,
    $or: [
      { name: { $regex: "Mario", $options: "i" } },
      { email: { $regex: "Mario", $options: "i" } },
      { phoneNumber: { $regex: "Mario", $options: "i" } },
    ],
    "address.barangay": "Botong",
  };

  const pipeline = buildTechnicianFarmerMetricsPipeline(match);

  assert.deepEqual(pipeline[0], { $match: match });
  assert.equal(pipeline.some((stage) => "$skip" in stage), false);
  assert.equal(pipeline.some((stage) => "$limit" in stage), false);
});

test("metrics pipeline counts only current Animals and reuses account-status semantics", () => {
  const pipeline = buildTechnicianFarmerMetricsPipeline({ role: "farmer" });
  const lookup = pipeline.find((stage) => stage.$lookup)?.$lookup;
  const group = pipeline.find((stage) => stage.$group)?.$group;

  assert.equal(lookup.from, Animal.collection.name);
  assert.deepEqual(lookup.pipeline[0].$match.$expr, { $eq: ["$farmerId", "$$farmerId"] });
  assert.deepEqual(lookup.pipeline[1], { $match: { deletedAt: null } });
  assert.ok(group.withAnimals);
  assert.ok(group.noAnimals);
  assert.ok(group.noAppAccount);

  const managedExpression = JSON.stringify(group.noAppAccount);
  assert.match(managedExpression, /no_app_account/);
  assert.match(managedExpression, /profile_only/);
  assert.doesNotMatch(managedExpression, /connected|blocked/);
});

test("No App Account metrics use the established directory access mapping", () => {
  assert.equal(
    getFarmerAppAccountStatus({ profileClaimStatus: "unclaimed" }),
    "no_app_account",
  );
  assert.equal(getFarmerAppAccountStatus({ email: "legacy@example.test" }), "profile_only");
  assert.equal(
    getFarmerAppAccountStatus({ clerkId: "user_linked", profileClaimStatus: "claimed" }),
    "connected",
  );
  assert.equal(getFarmerAppAccountStatus({ profileClaimStatus: "blocked" }), "blocked");
});

test("Technician directory returns aggregate metrics independently of its page", async (t) => {
  const originals = {
    find: User.find,
    countDocuments: User.countDocuments,
    aggregate: User.aggregate,
  };
  t.after(() => {
    User.find = originals.find;
    User.countDocuments = originals.countDocuments;
    User.aggregate = originals.aggregate;
  });

  let aggregateCalls = 0;
  User.find = () => queryResult([]);
  User.countDocuments = async () => 24;
  User.aggregate = async () => {
    aggregateCalls += 1;
    return [{ farmersFound: 24, withAnimals: 18, noAnimals: 6, noAppAccount: 10 }];
  };

  const recorder = responseRecorder();
  await getUsers(
    {
      user: { role: "technician" },
      query: {
        page: "2",
        limit: "10",
        search: "Mario",
        barangay: "Botong",
      },
    },
    recorder.response,
  );

  assert.equal(recorder.statusCode, 200);
  assert.equal(aggregateCalls, 1);
  assert.deepEqual(recorder.body.metrics, {
    farmersFound: 24,
    withAnimals: 18,
    noAnimals: 6,
    noAppAccount: 10,
  });
  assert.equal(recorder.body.page, 2);
  assert.deepEqual(recorder.body.data, []);
});
