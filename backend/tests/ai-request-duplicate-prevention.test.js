import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_AI_REQUEST_CONFLICT_MESSAGE,
  activeAIRequestQuery,
  createAIRequestWithGuard,
  isVerifiedFailedAIAttempt,
} from "../src/services/ai-request-creation.service.js";
import {
  ACTIVE_AI_REQUEST_STATUSES,
  AI_STATUS,
  LEGACY_ACTIVE_AI_STATUS,
} from "../src/domain/status-vocabulary.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Animal } from "../src/models/animal.model.js";
import { createAIRequest } from "../src/controllers/ai-request.controllers.js";
import { claimRequest } from "../src/controllers/technician.controllers.js";
import {
  AI_REQUEST_INVALIDATION_KEYS,
  findActiveAIRequestForAnimal,
  getAIRequestSubmitErrorMessage,
  getAIRequestSubmitState,
} from "../../mobile/features/farmer-requests/utils/aiRequestState.ts";

const originalFindOne = Insemination.findOne;
const originalCreate = Insemination.create;
const originalFindById = Insemination.findById;
const originalFindOneAndUpdate = Insemination.findOneAndUpdate;
const originalAnimalFindOne = Animal.findOne;

const installMemoryStore = (seed = []) => {
  const records = seed.map((record, index) => ({
    _id: record._id || `request-${index + 1}`,
    deletedAt: null,
    attemptNumber: index + 1,
    ...record,
  }));

  Insemination.findOne = (query) => ({
    sort: async (sort) => {
      const matches = records.filter((record) => {
        if (String(record.animalId) !== String(query.animalId)) return false;
        if (query.deletedAt === null && record.deletedAt !== null) return false;
        if (query.status?.$in && !query.status.$in.includes(record.status)) return false;
        if (typeof query.status === "string" && record.status !== query.status) return false;
        if (
          query.inseminationDate?.$exists === true &&
          (record.inseminationDate === undefined || record.inseminationDate === null)
        ) return false;
        return true;
      });
      const field = Object.keys(sort)[0];
      const direction = sort[field];
      return matches.sort((a, b) =>
        direction * ((a[field] || 0) > (b[field] || 0) ? 1 : -1),
      )[0] || null;
    },
  });

  Insemination.create = async (payload) => {
    const collision = records.find(
      (record) =>
        record.activeRequestKey &&
        record.activeRequestKey === payload.activeRequestKey,
    );
    if (collision) {
      const error = new Error("duplicate key");
      error.code = 11000;
      error.keyPattern = { activeRequestKey: 1 };
      error.keyValue = { activeRequestKey: payload.activeRequestKey };
      throw error;
    }
    const created = { _id: `request-${records.length + 1}`, ...payload };
    records.push(created);
    return created;
  };

  return records;
};

test.afterEach(() => {
  Insemination.findOne = originalFindOne;
  Insemination.create = originalCreate;
  Insemination.findById = originalFindById;
  Insemination.findOneAndUpdate = originalFindOneAndUpdate;
  Animal.findOne = originalAnimalFindOne;
});

test("first request for an eligible animal succeeds", async () => {
  const records = installMemoryStore();
  const result = await createAIRequestWithGuard({
    animalId: "animal-1",
    farmerId: "farmer-1",
    status: AI_STATUS.PENDING,
  });
  assert.equal(result.status, AI_STATUS.PENDING);
  assert.equal(records.length, 1);
  assert.equal(result.activeRequestKey, "animal-1");
});

for (const status of [
  AI_STATUS.PENDING,
  AI_STATUS.APPROVED,
  AI_STATUS.SCHEDULED,
  AI_STATUS.IN_PROGRESS,
]) {
  test(`second request is rejected while the first is ${status}`, async () => {
    installMemoryStore([{ animalId: "animal-1", status }]);
    await assert.rejects(
      createAIRequestWithGuard({
        animalId: "animal-1",
        farmerId: "farmer-1",
        status: AI_STATUS.PENDING,
      }),
      (error) =>
        error.status === 409 && error.code === "ACTIVE_AI_REQUEST_EXISTS",
    );
  });
}

test("rapid concurrent submissions create only one active request", async () => {
  const records = installMemoryStore();
  const results = await Promise.allSettled([
    createAIRequestWithGuard({ animalId: "animal-1", farmerId: "farmer-1", status: AI_STATUS.PENDING }),
    createAIRequestWithGuard({ animalId: "animal-1", farmerId: "farmer-1", status: AI_STATUS.PENDING }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(records.filter((record) => record.animalId === "animal-1").length, 1);
});

test("repeated API attempts cannot create a second request", async () => {
  const records = installMemoryStore();
  const payload = { animalId: "animal-1", farmerId: "farmer-1", status: AI_STATUS.PENDING };
  await createAIRequestWithGuard(payload);
  await assert.rejects(createAIRequestWithGuard(payload), { code: "ACTIVE_AI_REQUEST_EXISTS" });
  assert.equal(records.length, 1);
});

test("requests for different animals and farmers remain independent", async () => {
  const records = installMemoryStore();
  await createAIRequestWithGuard({ animalId: "animal-1", farmerId: "farmer-1", status: AI_STATUS.PENDING });
  await createAIRequestWithGuard({ animalId: "animal-2", farmerId: "farmer-1", status: AI_STATUS.PENDING });
  await createAIRequestWithGuard({ animalId: "animal-3", farmerId: "farmer-2", status: AI_STATUS.PENDING });
  assert.equal(records.length, 3);
});

test("a terminal request does not itself block a later domain-eligible request", async () => {
  const records = installMemoryStore([{ animalId: "animal-1", status: AI_STATUS.CANCELLED }]);
  await createAIRequestWithGuard({ animalId: "animal-1", farmerId: "farmer-1", status: AI_STATUS.PENDING });
  assert.equal(records.length, 2);
});

test("cancelled and rejected requests do not consume an official AI attempt number", async () => {
  const records = installMemoryStore([
    { animalId: "animal-1", status: AI_STATUS.CANCELLED, attemptNumber: 1 },
    { animalId: "animal-1", status: AI_STATUS.REJECTED, attemptNumber: 2 },
  ]);
  const created = await createAIRequestWithGuard({
    animalId: "animal-1",
    farmerId: "farmer-1",
    status: AI_STATUS.PENDING,
  });
  assert.equal(created.attemptNumber, 1);
  assert.equal(records.length, 3);
});

test("Attempt 2 links to Attempt 1 and preserves the breeding series", async () => {
  installMemoryStore([
    {
      _id: "attempt-1",
      animalId: "animal-1",
      farmerId: "farmer-1",
      status: AI_STATUS.DONE,
      inseminationDate: new Date("2026-06-01T00:00:00.000Z"),
      attemptNumber: 1,
      attemptSeriesId: "series-1",
      isSuccess: false,
      outcome: "Failed (Re-heat)",
      outcomeVerificationStatus: "verified",
    },
  ]);
  const attempt2 = await createAIRequestWithGuard({
    animalId: "animal-1",
    farmerId: "farmer-1",
    status: AI_STATUS.PENDING,
    previousAttemptId: "attempt-1",
    attemptSeriesId: "series-1",
  });

  assert.equal(attempt2.attemptNumber, 2);
  assert.equal(attempt2.previousAttemptId, "attempt-1");
  assert.equal(attempt2.attemptSeriesId, "series-1");
});

test("only a completed and verified failed AI attempt can start re-insemination", () => {
  const base = {
    status: AI_STATUS.DONE,
    isSuccess: false,
    outcome: "Failed (Re-heat)",
  };
  assert.equal(isVerifiedFailedAIAttempt(base), false);
  assert.equal(
    isVerifiedFailedAIAttempt({
      ...base,
      outcomeVerificationStatus: "verified",
    }),
    true,
  );
  assert.equal(
    isVerifiedFailedAIAttempt({
      ...base,
      farmerOutcomeReport: "return_to_heat",
    }),
    false,
  );
  assert.equal(
    isVerifiedFailedAIAttempt({
      ...base,
      outcome: "Failed (Negative PD)",
    }),
    true,
  );
});

test("duplicate conflict is specific and includes the existing request", async () => {
  installMemoryStore([{ _id: "existing-1", animalId: "animal-1", status: AI_STATUS.SCHEDULED }]);
  await assert.rejects(
    createAIRequestWithGuard({ animalId: "animal-1", farmerId: "farmer-1", status: AI_STATUS.PENDING }),
    (error) => {
      assert.equal(error.message, ACTIVE_AI_REQUEST_CONFLICT_MESSAGE);
      assert.equal(error.details.existingRequestId, "existing-1");
      assert.equal(error.details.existingRequestStatus, AI_STATUS.SCHEDULED);
      return true;
    },
  );
});

test("all documented legacy active statuses are recognized", () => {
  for (const status of Object.values(LEGACY_ACTIVE_AI_STATUS)) {
    assert.ok(ACTIVE_AI_REQUEST_STATUSES.includes(status), status);
  }
  assert.deepEqual(activeAIRequestQuery("animal-1").animalId, "animal-1");
});

test("the schema declares a sparse unique active-request index", () => {
  const index = Insemination.schema.indexes().find(
    ([fields]) => fields.activeRequestKey === 1,
  );
  assert.ok(index);
  assert.equal(index[1].unique, true);
  assert.equal(index[1].sparse, true);
});

test("mobile finds populated and unpopulated active animal requests", () => {
  const requests = [
    { animalId: { _id: "animal-1" }, status: AI_STATUS.SCHEDULED },
    { animalId: "animal-2", status: AI_STATUS.PENDING },
  ];
  assert.equal(findActiveAIRequestForAnimal(requests, "animal-1")?.status, AI_STATUS.SCHEDULED);
  assert.equal(findActiveAIRequestForAnimal(requests, "animal-2")?.status, AI_STATUS.PENDING);
});

test("mobile maps duplicate code, disables submit, and exposes cache keys", () => {
  const error = { response: { data: { code: "ACTIVE_AI_REQUEST_EXISTS", message: "server text" } } };
  assert.match(getAIRequestSubmitErrorMessage(error), /active AI service request/i);
  assert.equal(getAIRequestSubmitState({ hasActiveRequest: true, isSubmitting: false }).disabled, true);
  assert.equal(getAIRequestSubmitState({ hasActiveRequest: false, isSubmitting: true }).disabled, true);
  assert.deepEqual(AI_REQUEST_INVALIDATION_KEYS, [
    ["farmer", "requests"],
    ["farmer", "ai-requests"],
    ["ai-requests"],
  ]);
});

test("a farmer cannot request AI for an animal they do not own", async () => {
  let ownershipQuery;
  Animal.findOne = async (query) => {
    ownershipQuery = query;
    return null;
  };
  let statusCode;
  let body;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
  };
  await createAIRequest({
    user: { _id: "farmer-1" },
    body: { animalId: "animal-owned-by-someone-else" },
  }, res);
  assert.equal(statusCode, 404);
  assert.equal(ownershipQuery.farmerId, "farmer-1");
  assert.match(body.message, /does not belong to you/i);
});

test("two technicians cannot claim the same request concurrently", async () => {
  Insemination.findById = async () => ({
    _id: "request-1",
    animalId: "animal-1",
    status: "pending",
    approvedBy: null,
  });
  let claimed = false;
  Insemination.findOneAndUpdate = () => {
    const query = {
      populate() {
        return this;
      },
      then(resolve) {
        if (claimed) return resolve(null);
        claimed = true;
        return resolve({ _id: "request-1", approvedBy: "technician-1" });
      },
    };
    return query;
  };
  const makeRes = () => ({
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  });
  const app = { get: () => ({ to: () => ({ emit: () => {} }) }) };
  const firstRes = makeRes();
  const secondRes = makeRes();
  await Promise.all([
    claimRequest({ params: { type: "ai", id: "request-1" }, user: { _id: "technician-1", role: "technician" }, app }, firstRes),
    claimRequest({ params: { type: "ai", id: "request-1" }, user: { _id: "technician-2", role: "technician" }, app }, secondRes),
  ]);
  assert.deepEqual([firstRes.statusCode, secondRes.statusCode].sort(), [200, 409]);
  assert.equal(secondRes.body.code, "REQUEST_ALREADY_CLAIMED");
});
