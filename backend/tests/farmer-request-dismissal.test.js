import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Insemination } from "../src/models/insemination.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { dismissAIRequestForFarmer } from "../src/controllers/ai-request.controllers.js";
import { dismissHealthRequestForFarmer } from "../src/controllers/health-request.controllers.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const responseRecorder = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return body;
  },
});

const assertDismissesTerminalRequest = async ({ Model, handler }) => {
  const originalFindOne = Model.findOne;
  const originalUpdateOne = Model.updateOne;
  let lookupQuery;
  let updateQuery;
  let updateDocument;

  Model.findOne = (query) => {
    lookupQuery = query;
    return {
      select: async () => ({
        _id: "507f1f77bcf86cd799439099",
        status: "cancelled",
        farmerDismissedAt: null,
      }),
    };
  };
  Model.updateOne = async (query, update) => {
    updateQuery = query;
    updateDocument = update;
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  };

  const response = responseRecorder();
  try {
    await handler(
      {
        params: { id: "507f1f77bcf86cd799439099" },
        user: {
          _id: "507f1f77bcf86cd799439011",
          role: "farmer",
        },
      },
      response,
    );
  } finally {
    Model.findOne = originalFindOne;
    Model.updateOne = originalUpdateOne;
  }

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.message, "Request removed from your history.");
  assert.equal(String(lookupQuery.farmerId), "507f1f77bcf86cd799439011");
  assert.deepEqual(updateQuery.status, { $in: ["cancelled", "rejected"] });
  assert.equal(updateQuery.farmerDismissedAt, null);
  assert.ok(updateDocument.$set.farmerDismissedAt instanceof Date);
};

test("farmer can dismiss a cancelled AI request without deleting it", async () => {
  await assertDismissesTerminalRequest({
    Model: Insemination,
    handler: dismissAIRequestForFarmer,
  });
});

test("farmer can dismiss a cancelled health request without deleting it", async () => {
  await assertDismissesTerminalRequest({
    Model: HealthRequest,
    handler: dismissHealthRequestForFarmer,
  });
});

test("active requests cannot be dismissed from farmer history", async () => {
  const originalFindOne = Insemination.findOne;
  const originalUpdateOne = Insemination.updateOne;
  let updateCalled = false;
  Insemination.findOne = () => ({
    select: async () => ({
      _id: "507f1f77bcf86cd799439099",
      status: "scheduled",
      farmerDismissedAt: null,
    }),
  });
  Insemination.updateOne = async () => {
    updateCalled = true;
  };

  const response = responseRecorder();
  try {
    await dismissAIRequestForFarmer(
      {
        params: { id: "507f1f77bcf86cd799439099" },
        user: { _id: "507f1f77bcf86cd799439011", role: "farmer" },
      },
      response,
    );
  } finally {
    Insemination.findOne = originalFindOne;
    Insemination.updateOne = originalUpdateOne;
  }

  assert.equal(response.statusCode, 409);
  assert.equal(updateCalled, false);
  assert.match(response.body.message, /Only cancelled or rejected/);
});

test("dismissal remains farmer-only and preserves admin cleanup routes", () => {
  const aiRoutes = source("backend/src/routes/ai-request.routes.js");
  const healthRoutes = source("backend/src/routes/health-request.routes.js");
  const aiController = source("backend/src/controllers/ai-request.controllers.js");
  const healthController = source("backend/src/controllers/health-request.controllers.js");

  assert.match(aiRoutes, /router\.patch\("\/:id\/dismiss", protectedRoute, dismissAIRequestForFarmer\)/);
  assert.match(healthRoutes, /router\.patch\("\/:id\/dismiss", protectedRoute, dismissHealthRequestForFarmer\)/);
  assert.match(aiRoutes, /router\.delete\("\/:id", protectedRoute, AdminOnly, deleteRequest\)/);
  assert.match(healthRoutes, /router\.delete\("\/:id", protectedRoute, AdminOnly, deleteHealthRequest\)/);
  assert.match(aiController, /farmerId, deletedAt: null, farmerDismissedAt: null/);
  assert.match(healthController, /farmerId, deletedAt: null, farmerDismissedAt: null/);
});

test("farmer mobile calls dismissal endpoint and removes the card after success", () => {
  const mobile = source("mobile/app/(farmer)/my-requests.tsx");

  assert.match(mobile, /`\/ai-request\/\$\{id\}\/dismiss`/);
  assert.match(mobile, /`\/health-request\/\$\{id\}\/dismiss`/);
  assert.match(mobile, /await api\.patch\(endpoint\)/);
  assert.match(mobile, /setAllRequests\(\(current\) =>/);
  assert.doesNotMatch(mobile, /just refresh list/);
});
