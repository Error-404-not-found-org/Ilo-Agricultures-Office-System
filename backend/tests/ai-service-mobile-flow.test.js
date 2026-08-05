import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  EARLY_START_GRACE_MS,
  getEarlyStartTiming,
} from "../src/domain/service-timing.js";
import { updateRequestStatus } from "../src/controllers/ai-request.controllers.js";
import { walkInInsemination } from "../src/controllers/technician.controllers.js";
import { Insemination } from "../src/models/insemination.model.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("AI service timing only requires confirmation outside the start grace period", () => {
  const now = new Date("2026-07-30T01:00:00.000Z");
  const early = getEarlyStartTiming(
    new Date(now.getTime() + 45 * 60 * 1000),
    now,
  );
  const withinGrace = getEarlyStartTiming(
    new Date(now.getTime() + EARLY_START_GRACE_MS),
    now,
  );

  assert.equal(early.isEarly, true);
  assert.equal(early.earlyStartMinutes, 45);
  assert.equal(withinGrace.isEarly, false);
  assert.equal(withinGrace.earlyStartMinutes, 0);
});

test("AI status endpoint rejects an unconfirmed early start with a readable contract", async (t) => {
  const originalFindById = Insemination.findById;
  Insemination.findById = async () => ({
    _id: "request-1",
    status: "scheduled",
    scheduledDate: new Date(Date.now() + 60 * 60 * 1000),
    approvedBy: "technician-1",
  });
  t.after(() => {
    Insemination.findById = originalFindById;
  });

  let statusCode = 200;
  let responseBody;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  await updateRequestStatus(
    {
      params: { id: "request-1" },
      body: { status: "in-progress" },
      user: {
        _id: "technician-1",
        role: "technician",
        name: "Test Technician",
      },
    },
    response,
  );

  assert.equal(statusCode, 409);
  assert.equal(responseBody.code, "EARLY_START_CONFIRMATION_REQUIRED");
  assert.match(responseBody.message, /confirm.+start.+early/i);
  assert.ok(responseBody.earlyStartMinutes >= 59);
});

test("walk-in AI rejects a non-string technician note before recording", async () => {
  let statusCode = 200;
  let responseBody;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  await walkInInsemination(
    {
      body: { inseminationDetails: { technicianNote: { invalid: true } } },
      user: { _id: "technician-1", role: "technician" },
    },
    response,
  );

  assert.equal(statusCode, 400);
  assert.equal(responseBody.code, "INVALID_TECHNICIAN_NOTE");
});

test("technician request starts and AI completion stay responsive and visible", () => {
  const details = source("mobile/app/(technician)/request-details.tsx");
  const rootLayout = source("mobile/app/_layout.tsx");
  const confirmationModal = source("mobile/components/ConfirmationModal.tsx");
  const dateRangeSelector = source(
    "mobile/features/technician-records/components/DateRangeSelector.tsx",
  );
  const list = source(
    "mobile/features/technician-requests/screens/TechnicianRequestsScreen.tsx",
  );
  const controller = source("backend/src/controllers/ai-request.controllers.js");
  const healthController = source(
    "backend/src/controllers/health-request.controllers.js",
  );

  // Assertions for removed inline forms and early start modals have been removed as part of Batch A UI parity.
  assert.doesNotMatch(rootLayout, /PortalHost/);
  assert.match(confirmationModal, /<Modal/);
  assert.doesNotMatch(confirmationModal, /Dialog/);
  assert.match(dateRangeSelector, /<Modal/);
  assert.doesNotMatch(dateRangeSelector, /Dialog/);

  assert.match(details, /keyboardShouldPersistTaps="handled"/);
  assert.match(details, /err\.response\?\.data\?\.message/);
  assert.match(details, /accessibilityRole="alert"/);
  assert.doesNotMatch(
    details.slice(
      details.indexOf("const handleUpdateStatus"),
      details.indexOf("const formatDate"),
    ),
    /toast\.error/,
  );
  assert.match(details, /if \(result\?\.request\) \{\s*setRequest\(result\.request\)/);
  assert.match(details, /void fetchRequestDetails\(\)/);
  assert.doesNotMatch(details, /await fetchRequestDetails\(\)/);


  assert.match(
    list,
    /if \(currentStatus === "scheduled"\) \{\s*handleActionPress\(item\)/,
  );
  assert.match(controller, /EARLY_START_CONFIRMATION_REQUIRED/);
  assert.match(controller, /updateData\.serviceStartedAt/);
  assert.match(controller, /updateData\.earlyStartMinutes/);
  assert.match(controller, /request = await completeInsemination\(\{/);
  assert.match(controller, /normalizeTechnicianNoteInput\(req\.body\)/);
  assert.match(
    controller,
    /normalizedTechnicianNote !== undefined[\s\S]*updateData\.technicianNote = normalizedTechnicianNote/,
  );
  assert.match(healthController, /request = await resolveHealthRequest\(\{/);
});
