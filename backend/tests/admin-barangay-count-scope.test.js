import assert from "node:assert/strict";
import test from "node:test";
import { User } from "../src/models/user.model.js";
import { Animal } from "../src/models/animal.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { getBarangaysInsightsList } from "../src/controllers/admin.controllers.js";

test("Barangay insight counts include active Farmers but exclude archived Farmer-owned records", async (t) => {
  const models = [User, Animal, Pregnancy, Insemination, HealthRequest];
  const originals = models.map((model) => model.aggregate);
  t.after(() => models.forEach((model, index) => { model.aggregate = originals[index]; }));

  const location = { barangay: "Poblacion East", city: "Oton", municipality: "", district: "" };
  const active = { _id: "active", role: "farmer", deletedAt: null, address: location };
  const archived = { _id: "archived", role: "farmer", deletedAt: new Date(), address: location };
  const farmers = [active, archived];
  const captured = [];
  const aggregate = (modelName, records) => async (pipeline) => {
    captured.push({ modelName, pipeline });
    const joinedMatch = pipeline.find((stage) => stage.$match?.["farmer.address.barangay"]);
    const firstMatch = pipeline[0].$match;
    const qualifying = records.filter((record) => {
      const farmer = farmers.find((item) => item._id === (record.farmerId || record._id));
      if (!farmer) return false;
      if (firstMatch?.role && farmer.role !== firstMatch.role) return false;
      if (firstMatch?.deletedAt === null && record.deletedAt != null) return false;
      if (firstMatch?.status && record.status !== firstMatch.status) return false;
      if (joinedMatch?.$match["farmer.deletedAt"] === null && farmer.deletedAt != null) return false;
      return true;
    });
    return qualifying.length ? [{ _id: location, count: qualifying.length }] : [];
  };
  User.aggregate = aggregate("user", farmers);
  Animal.aggregate = aggregate("animal", [
    { farmerId: "active", deletedAt: null },
    { farmerId: "archived", deletedAt: null },
  ]);
  Pregnancy.aggregate = async () => [];
  Insemination.aggregate = aggregate("ai", [
    { farmerId: "active", deletedAt: null, status: "pending" },
    { farmerId: "archived", deletedAt: null, status: "pending" },
    { farmerId: "active", deletedAt: null, status: "completed" },
  ]);
  HealthRequest.aggregate = aggregate("health", [
    { farmerId: "active", deletedAt: null, status: "pending" },
    { farmerId: "archived", deletedAt: null, status: "pending" },
  ]);

  let result;
  await getBarangaysInsightsList({}, {
    status() { return this; },
    json(value) { result = value; return this; },
  });
  assert.equal(result.length, 1);
  assert.deepEqual(
    [result[0].farmersCount, result[0].animalsCount, result[0].pendingAIRequests, result[0].pendingHealthRequests],
    [1, 1, 1, 1],
  );
  for (const name of ["animal", "ai", "health"]) {
    const pipeline = captured.find((item) => item.modelName === name).pipeline;
    assert.equal(pipeline.find((stage) => stage.$match?.["farmer.address.barangay"]).$match["farmer.deletedAt"], null);
  }
});
