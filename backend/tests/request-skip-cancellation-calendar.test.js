import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { declineTechnicianRequest } from "../src/controllers/technician.controllers.js";
import { Insemination } from "../src/models/insemination.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const technician = (overrides = {}) => ({
  _id: "507f1f77bcf86cd799439011",
  role: "technician",
  name: "Technician A",
  isVerified: true,
  profileClaimStatus: "claimed",
  status: "active",
  deletedAt: null,
  dispatchProfile: {
    acceptsNewRequests: true,
    availabilityStatus: "available",
    serviceCapabilities: ["AI", "HEALTH"],
    serviceMunicipalities: [{ municipalityCode: "063034000" }],
  },
  ...overrides,
});

const pendingRequest = (overrides = {}) => ({
  _id: "507f1f77bcf86cd799439021",
  status: "pending",
  deletedAt: null,
  dispatch: { location: { municipalityCode: "063034000" }, stage: "local" },
  declinedByTechnicianIds: [],
  ...overrides,
});

const responseRecorder = () => {
  const recorder = { statusCode: null, body: null };
  recorder.response = {
    status(code) { recorder.statusCode = code; return this; },
    json(body) { recorder.body = body; return this; },
  };
  return recorder;
};

test("Technician skip is atomic, pending-only, unassigned, and status preserving", async (t) => {
  const originals = {
    aiFindOne: Insemination.findOne,
    aiUpdate: Insemination.findOneAndUpdate,
    healthFindOne: HealthRequest.findOne,
    healthUpdate: HealthRequest.findOneAndUpdate,
  };
  t.after(() => {
    Insemination.findOne = originals.aiFindOne;
    Insemination.findOneAndUpdate = originals.aiUpdate;
    HealthRequest.findOne = originals.healthFindOne;
    HealthRequest.findOneAndUpdate = originals.healthUpdate;
  });

  for (const [type, Model] of [["ai", Insemination], ["health", HealthRequest]]) {
    await t.test(`${type} skip preserves pending and cannot assign or unassign`, async () => {
      let filter;
      let update;
      Model.findOne = async () => pendingRequest();
      Model.findOneAndUpdate = async (nextFilter, nextUpdate) => {
        filter = nextFilter;
        update = nextUpdate;
        return { ...pendingRequest(), declinedByTechnicianIds: [technician()._id] };
      };
      const recorder = responseRecorder();
      await declineTechnicianRequest(
        { params: { type, id: pendingRequest()._id }, body: {}, user: technician() },
        recorder.response,
      );

      assert.equal(recorder.statusCode, 200);
      assert.equal(filter.status, "pending");
      assert.deepEqual(filter.declinedByTechnicianIds, { $ne: technician()._id });
      if (type === "ai") {
        assert.equal(filter.approvedBy, null);
        assert.equal(filter.technicianId, null);
      } else {
        assert.equal(filter.handledBy, null);
        assert.equal(filter.assignedTechnicianId, null);
      }
      assert.equal(update.$set, undefined);
      assert.equal(update.$unset, undefined);
      assert.deepEqual(update.$addToSet, { declinedByTechnicianIds: technician()._id });
      assert.equal(update.$push.statusHistory.status, "skipped_by_technician");
    });
  }
});

test("Technician skip rejects Admin, duplicates, and no-longer-unassigned work", async (t) => {
  const originalFindOne = Insemination.findOne;
  const originalUpdate = Insemination.findOneAndUpdate;
  t.after(() => {
    Insemination.findOne = originalFindOne;
    Insemination.findOneAndUpdate = originalUpdate;
  });

  const adminRecorder = responseRecorder();
  await declineTechnicianRequest(
    { params: { type: "ai", id: "id" }, body: {}, user: technician({ role: "admin" }) },
    adminRecorder.response,
  );
  assert.equal(adminRecorder.statusCode, 403);
  assert.equal(adminRecorder.body.code, "TECHNICIAN_SKIP_FORBIDDEN");

  Insemination.findOne = async () => pendingRequest({ declinedByTechnicianIds: [technician()._id] });
  Insemination.findOneAndUpdate = async () => null;
  const duplicateRecorder = responseRecorder();
  await declineTechnicianRequest(
    { params: { type: "ai", id: pendingRequest()._id }, body: {}, user: technician() },
    duplicateRecorder.response,
  );
  assert.equal(duplicateRecorder.statusCode, 409);
  assert.equal(duplicateRecorder.body.code, "REQUEST_ALREADY_SKIPPED");

  Insemination.findOne = async () => pendingRequest({ approvedBy: "tech-a", status: "scheduled" });
  const ownedRecorder = responseRecorder();
  await declineTechnicianRequest(
    { params: { type: "ai", id: pendingRequest()._id }, body: {}, user: technician() },
    ownedRecorder.response,
  );
  assert.equal(ownedRecorder.statusCode, 409);
  assert.equal(ownedRecorder.body.code, "REQUEST_SKIP_CONCURRENT_UPDATE");
});

test("scheduled Farmer cancellation requests use atomic ownership and lifecycle predicates", () => {
  for (const [file, code] of [
    ["backend/src/controllers/ai-request.controllers.js", "AI_CANCELLATION_REQUEST_CONCURRENT_UPDATE"],
    ["backend/src/controllers/health-request.controllers.js", "HEALTH_CANCELLATION_REQUEST_CONCURRENT_UPDATE"],
  ]) {
    const contents = source(file);
    assert.match(contents, /farmerId:\s*actor\._id[\s\S]*status:\s*"scheduled"/);
    assert.match(contents, /cancellationStatus:\s*\{\s*\$nin:\s*\["requested",\s*"approved"\]/);
    assert.match(contents, /\$push:\s*\{[\s\S]*statusHistory:[\s\S]*cancellation_requested/);
    assert.match(contents, new RegExp(code));
  }
});

test("Calendar agenda requires real schedules and preserves cancellation review state", () => {
  const contents = source("backend/src/controllers/technician.controllers.js");
  assert.match(contents, /hasScheduledVisit\s*=\s*Boolean\(ins\.scheduledDate\)/);
  assert.match(contents, /hasScheduledVisit\s*=\s*Boolean\(healthRequest\.scheduledDate\)/);
  assert.match(contents, /Cancellation requested/);
  const skipSource = contents.slice(
    contents.indexOf("export const declineTechnicianRequest"),
    contents.indexOf("export const claimRequest"),
  );
  assert.doesNotMatch(skipSource, /role:technician|\$unset|\$set:\s*\{[\s\S]*status:\s*"pending"/);
});

test("Mobile presents Skip and canonical Farmer cancellation review actions", () => {
  for (const file of [
    "mobile/features/technician-requests/components/AIRequestDetails.tsx",
    "mobile/features/technician-health-request/components/HealthRequestDetails.tsx",
  ]) {
    const contents = source(file);
    assert.match(contents, /accessibilityLabel="Skip Request"/);
    assert.match(contents, /confirmText="Skip Request"/);
    assert.match(contents, /CancellationReviewPanel/);
    assert.match(contents, /respondToCancellationRequest/);
    assert.doesNotMatch(contents, />\s*Decline Request\s*</);
  }

  const panel = source(
    "mobile/features/technician-requests/components/CancellationReviewPanel.tsx",
  );
  assert.match(panel, /Approve cancellation/);
  assert.match(panel, /Decline cancellation request/);
  assert.match(panel, /Farmer requested cancellation/);
});
