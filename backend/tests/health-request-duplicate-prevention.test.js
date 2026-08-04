import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_HEALTH_REQUEST_STATUSES,
  HEALTH_STATUS,
} from "../src/domain/status-vocabulary.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import {
  activeHealthCaseQuery,
  createHealthRequestWithGuard,
} from "../src/services/health-request-creation.service.js";
import {
  findActiveHealthCase,
  getHealthRequestErrorMessage,
} from "../../mobile/features/farmer-requests/utils/healthRequestState.ts";

const originalFindOne = HealthRequest.findOne;
const originalCreate = HealthRequest.create;

const installMemoryStore = (seed = []) => {
  const records = seed.map((record, index) => ({
    _id: record._id || `health-${index + 1}`,
    deletedAt: null,
    requestType: "disease",
    ...record,
  }));

  HealthRequest.findOne = (query) => ({
    sort: async () =>
      records.find(
        (record) =>
          String(record.animalId) === String(query.animalId) &&
          record.requestType === query.requestType &&
          record.deletedAt === null &&
          query.status.$in.includes(record.status),
      ) || null,
  });

  HealthRequest.create = async (payload) => {
    const collision = records.find(
      (record) =>
        record.activeCaseKey && record.activeCaseKey === payload.activeCaseKey,
    );
    if (collision) {
      const error = new Error("duplicate key");
      error.code = 11000;
      error.keyPattern = { activeCaseKey: 1 };
      throw error;
    }
    const created = { _id: `health-${records.length + 1}`, ...payload };
    records.push(created);
    return created;
  };
  return records;
};

test.afterEach(() => {
  HealthRequest.findOne = originalFindOne;
  HealthRequest.create = originalCreate;
});

for (const status of ACTIVE_HEALTH_REQUEST_STATUSES) {
  test(`same health case type is blocked while status is ${status}`, async () => {
    installMemoryStore([
      {
        animalId: "animal-1",
        requestType: "disease",
        status,
        activeCaseKey: "animal-1:disease",
      },
    ]);
    await assert.rejects(
      createHealthRequestWithGuard({
        animalId: "animal-1",
        farmerId: "farmer-1",
        requestType: "disease",
        symptoms: "Fever",
        status: HEALTH_STATUS.PENDING,
      }),
      { code: "ACTIVE_HEALTH_CASE_EXISTS", status: 409 },
    );
  });
}

test("different active health case types remain independent", async () => {
  const records = installMemoryStore([
    {
      animalId: "animal-1",
      requestType: "injury",
      status: HEALTH_STATUS.PENDING,
      activeCaseKey: "animal-1:injury",
    },
  ]);
  await createHealthRequestWithGuard({
    animalId: "animal-1",
    farmerId: "farmer-1",
    requestType: "disease",
    symptoms: "Fever",
    status: HEALTH_STATUS.PENDING,
  });
  assert.equal(records.length, 2);
});

test("rapid health submissions create only one active case", async () => {
  const records = installMemoryStore();
  const payload = {
    animalId: "animal-1",
    farmerId: "farmer-1",
    requestType: "disease",
    symptoms: "Fever",
    status: HEALTH_STATUS.PENDING,
  };
  const results = await Promise.allSettled([
    createHealthRequestWithGuard(payload),
    createHealthRequestWithGuard(payload),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(records.length, 1);
});

test("health schema declares a sparse unique active-case index", () => {
  const index = HealthRequest.schema.indexes().find(
    ([fields]) => fields.activeCaseKey === 1,
  );
  assert.ok(index);
  assert.equal(index[1].unique, true);
  assert.equal(index[1].sparse, true);
});

test("mobile recognizes every active health status and maps the conflict", () => {
  for (const status of ACTIVE_HEALTH_REQUEST_STATUSES) {
    assert.ok(
      findActiveHealthCase(
        [{ animalId: { _id: "animal-1" }, requestType: "disease", status }],
        "animal-1",
        "disease",
      ),
      status,
    );
  }
  assert.match(
    getHealthRequestErrorMessage({
      response: { data: { code: "ACTIVE_HEALTH_CASE_EXISTS" } },
    }),
    /active health case/i,
  );
  assert.deepEqual(
    activeHealthCaseQuery("animal-1", "disease").status.$in,
    ACTIVE_HEALTH_REQUEST_STATUSES,
  );
});
