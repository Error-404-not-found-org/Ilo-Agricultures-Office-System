import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { updateRequestStatus } from "../src/controllers/ai-request.controllers.js";
import { Insemination } from "../src/models/insemination.model.js";

const readSource = (relativePath) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");

const functionSource = (source, exportName, nextExportName) => {
  const start = source.indexOf(`export const ${exportName}`);
  const end = nextExportName
    ? source.indexOf(`export const ${nextExportName}`, start + 1)
    : source.length;
  assert.notEqual(start, -1, `${exportName} must exist`);
  return source.slice(start, end === -1 ? source.length : end);
};

test("Workflow consolidation: legacy AI status route delegates to canonical controller", () => {
  const routes = readSource("../src/routes/technician.routes.js");
  assert.match(
    routes,
    /updateRequestStatus as updateCanonicalAIRequestStatus/,
  );
  assert.match(
    routes,
    /router\.patch\(\s*"\/inseminations\/:id\/status",\s*requireRole\(\["technician", "admin"\]\),\s*updateCanonicalAIRequestStatus,\s*\)/,
  );
});

test("Workflow consolidation: technician pregnancy check uses unified confirmation service", () => {
  const source = readSource("../src/controllers/technician.controllers.js");
  const handler = functionSource(source, "recordPregnancyCheck", "recordCalving");
  assert.match(handler, /confirmPregnancyDiagnosis\(\{/);
  assert.doesNotMatch(handler, /Pregnancy\.create\(/);
  assert.doesNotMatch(handler, /Insemination\.findByIdAndUpdate\(/);
  assert.doesNotMatch(handler, /Animal\.findByIdAndUpdate\(/);
});

test("Workflow consolidation: technician calving uses shared calving service", () => {
  const source = readSource("../src/controllers/technician.controllers.js");
  const handler = functionSource(source, "recordCalving", "getDashboardStats");
  assert.match(handler, /persistCalving\(\{/);
  assert.doesNotMatch(handler, /Calving\.create\(/);
  assert.doesNotMatch(handler, /Animal\.create\(/);
  assert.doesNotMatch(handler, /Animal\.findByIdAndUpdate\(/);
});

test("Workflow consolidation: health controller does not rewrite resolved medical record", () => {
  const source = readSource("../src/controllers/health-request.controllers.js");
  const handler = functionSource(
    source,
    "updateHealthRequestStatus",
    "walkInHealthRequest",
  );
  assert.match(handler, /resolveHealthRequest\(\{/);
  assert.doesNotMatch(handler, /MedicalRecord\.updateOne\(/);
});

test("Workflow consolidation: canonical AI completion does not repeat transaction writes", () => {
  const source = readSource("../src/controllers/ai-request.controllers.js");
  const handler = functionSource(source, "updateRequestStatus", "confirmAIOutcome");
  assert.match(handler, /completeInsemination\(\{/);
  assert.doesNotMatch(handler, /Animal\.findByIdAndUpdate\(/);
  assert.doesNotMatch(handler, /Task\.create\(/);
});

const createResponseRecorder = () => {
  const recorder = { statusCode: null, body: null };
  recorder.response = {
    status(code) {
      recorder.statusCode = code;
      return {
        json(payload) {
          recorder.body = payload;
        },
      };
    },
  };
  return recorder;
};

test("Workflow consolidation: legacy compatibility route and canonical route share the same handler", () => {
  const routes = readSource("../src/routes/technician.routes.js");
  assert.match(
    routes,
    /router\.patch\(\s*"\/inseminations\/:id\/status",\s*requireRole\(\["technician", "admin"\]\),\s*updateCanonicalAIRequestStatus,\s*\)/,
  );
  assert.match(
    routes,
    /import \{ updateRequestStatus as updateCanonicalAIRequestStatus \} from "\.\.\/controllers\/ai-request\.controllers\.js"/,
  );
});

test("Workflow consolidation: legacy re-insemination URL is only a canonical compatibility adapter", () => {
  const routes = readSource("../src/routes/animals.routes.js");
  const animalController = readSource("../src/controllers/animals.controllers.js");
  const aiController = readSource("../src/controllers/ai-request.controllers.js");
  const adapter = functionSource(
    aiController,
    "createLegacyReInseminationRequest",
    "getMyRequests",
  );

  assert.match(routes, /createLegacyReInseminationRequest/);
  assert.match(
    routes,
    /router\.post\([\s\S]*"\/re-inseminate"[\s\S]*requestLimiter[\s\S]*createLegacyReInseminationRequest/,
  );
  assert.doesNotMatch(animalController, /export const requestReInsemination/);
  assert.match(adapter, /createReInseminationRequest\(req, res\)/);
  assert.match(adapter, /res\.set\("Deprecation", "true"\)/);
  assert.match(adapter, /rel="successor-version"/);
});

test("Workflow consolidation: inactive technician AI status controller is removed", () => {
  const source = readSource("../src/controllers/technician.controllers.js");
  assert.doesNotMatch(source, /export const updateInseminationStatus/);
  assert.doesNotMatch(source, /UpdateInseminationStatus Error/);
});

test("Workflow consolidation: AI status transitions reject invalid moves (e.g. pending -> done)", async () => {
  const originalFindById = Insemination.findById;
  Insemination.findById = () => ({
    populate: () => ({
      _id: "507f1f77bcf86cd799439021",
      status: "pending",
      approvedBy: "507f1f77bcf86cd799439011",
    }),
  });

  const recorder = createResponseRecorder();

  try {
    await updateRequestStatus(
      {
        params: { id: "507f1f77bcf86cd799439021" },
        body: { status: "done" },
        user: { _id: "507f1f77bcf86cd799439011", role: "technician" },
      },
      recorder.response,
    );
    assert.equal(recorder.statusCode, 409);
    assert.equal(recorder.body.code, "INVALID_STATUS_TRANSITION");
  } finally {
    Insemination.findById = originalFindById;
  }
});
