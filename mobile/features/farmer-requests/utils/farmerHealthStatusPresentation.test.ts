import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  getFarmerHealthStatusLabel,
  getFarmerRequestFilterQuery,
  getFarmerRequestListStatusLabel,
} from "./requestDetailPresentation.ts";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const readMobileSource = (...parts: string[]) =>
  fs.readFileSync(
    path.resolve(currentDirectory, "../../..", ...parts),
    "utf8",
  );

test("Health statuses use path-aware Farmer wording", () => {
  assert.equal(getFarmerHealthStatusLabel("pending"), "Awaiting Review");
  assert.equal(getFarmerHealthStatusLabel("approved"), "Under Review");
  assert.equal(getFarmerHealthStatusLabel("assigned"), "Under Review");
  assert.equal(getFarmerHealthStatusLabel("triaged"), "Under Review");
  assert.equal(getFarmerHealthStatusLabel("scheduled"), "Scheduled");
  assert.equal(getFarmerHealthStatusLabel("in-progress"), "In Progress");
  assert.equal(getFarmerHealthStatusLabel("in_progress"), "In Progress");
  assert.equal(
    getFarmerHealthStatusLabel("resolved", "advice"),
    "Advice Provided",
  );
  assert.equal(
    getFarmerHealthStatusLabel("resolved", "office_pickup"),
    "Pickup Arranged",
  );
  assert.equal(
    getFarmerHealthStatusLabel("resolved", "farm_visit"),
    "Completed",
  );
  assert.equal(getFarmerHealthStatusLabel("resolved"), "Resolved");
  assert.equal(getFarmerHealthStatusLabel("cancelled"), "Cancelled");
  assert.equal(getFarmerHealthStatusLabel("rejected"), "Not Approved");
  assert.equal(getFarmerHealthStatusLabel("legacy_unknown"), "Status Unavailable");
});

test("Farmer filters use server-side lifecycle groups where aliases exist", () => {
  assert.deepEqual(getFarmerRequestFilterQuery("health", "pending"), {
    statusGroup: "pending",
  });
  assert.deepEqual(getFarmerRequestFilterQuery("health", "in-progress"), {
    statusGroup: "in_progress",
  });
  assert.deepEqual(getFarmerRequestFilterQuery("ai", "in-progress"), {
    statusGroup: "in_progress",
  });
  assert.deepEqual(getFarmerRequestFilterQuery("health", "scheduled"), {
    status: "scheduled",
  });
  assert.deepEqual(getFarmerRequestFilterQuery("health", "completed"), {
    status: "resolved",
  });
  assert.deepEqual(getFarmerRequestFilterQuery("ai", "completed"), {
    status: "done",
  });
  assert.deepEqual(getFarmerRequestFilterQuery("health", "all"), {
    status: "all",
  });
  assert.deepEqual(getFarmerRequestFilterQuery("ai", "scheduled"), {
    status: "scheduled",
  });
});

test("cancelled requests remain under All and outside Completed", () => {
  assert.deepEqual(getFarmerRequestFilterQuery("health", "all"), {
    status: "all",
  });
  assert.deepEqual(getFarmerRequestFilterQuery("health", "completed"), {
    status: "resolved",
  });
  assert.equal(getFarmerHealthStatusLabel("cancelled"), "Cancelled");
});

test("AI scheduled work remains discoverable when cancellation is only an overlay", () => {
  assert.deepEqual(getFarmerRequestFilterQuery("ai", "scheduled"), {
    status: "scheduled",
  });
  assert.equal(getFarmerRequestListStatusLabel("approved"), "Scheduling Pending");
});

test("Farmer request UI uses five lifecycle tabs and preserves cancellation as an overlay", () => {
  const listSource = readMobileSource("app", "(farmer)", "my-requests.tsx");

  for (const label of ["All", "Pending", "Scheduled", "In Progress", "Completed"]) {
    assert.match(listSource, new RegExp(`label: "${label}"`));
  }
  assert.doesNotMatch(listSource, /label: "Pending Cancellation"/);
  assert.match(listSource, /Cancellation Requested/);
  assert.match(listSource, /getStatusColor\(req\.status\)/);
  assert.match(
    listSource,
    /getFarmerHealthStatusLabel\(req\.status, req\.handlingMethod\)/,
  );
  assert.doesNotMatch(
    listSource,
    /displayedStatus\s*=\s*isPendingCancellation/,
  );
});

test("Health list and detail use the Health mapper without changing the AI mapper", () => {
  const listSource = readMobileSource("app", "(farmer)", "my-requests.tsx");
  const detailSource = readMobileSource(
    "app",
    "(farmer)",
    "health-request-detail.tsx",
  );

  assert.match(listSource, /getFarmerHealthStatusLabel/);
  assert.match(detailSource, /getFarmerHealthStatusLabel/);
  assert.doesNotMatch(detailSource, /StatusBadge label=\{statusLabel\}/);
});
