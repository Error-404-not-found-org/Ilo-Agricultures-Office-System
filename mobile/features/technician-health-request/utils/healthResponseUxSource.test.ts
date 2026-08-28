import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));

const technicianSource = readFileSync(
  resolve(currentDirectory, "../components/HealthRequestDetails.tsx"),
  "utf8",
);
const farmerDetailSource = readFileSync(
  resolve(currentDirectory, "../../../app/(farmer)/health-request-detail.tsx"),
  "utf8",
);
const farmerResponseSource = readFileSync(
  resolve(
    currentDirectory,
    "../../farmer-requests/components/HealthRequestResponseSections.tsx",
  ),
  "utf8",
);

test("Advice and Office Pickup expose explicit locked loading states", () => {
  assert.match(technicianSource, /Sending advice\.\.\./);
  assert.match(technicianSource, /Sending pickup information\.\.\./);
  assert.match(technicianSource, /if \(updating\) return;/);
  assert.match(
    technicianSource,
    /disabled=\{submittingResponse === "advice"\}/,
  );
  assert.match(
    technicianSource,
    /disabled=\{submittingResponse === "office_pickup"\}/,
  );
});

test("confirmed responses use refresh-before-replace without a timer", () => {
  assert.match(technicianSource, /runConfirmedHealthResponseSubmission/);
  assert.match(
    technicianSource,
    /router\.replace\(TECHNICIAN_MY_WORK_COMPLETED_TARGET/,
  );
  assert.match(technicianSource, /Advice sent to farmer/);
  assert.match(technicianSource, /Pickup information sent to farmer/);
  assert.doesNotMatch(technicianSource, /setTimeout\s*\(/);
});

test("Farm Visit scheduling and the real attachment viewer remain wired", () => {
  assert.match(technicianSource, /<HealthVisitScheduleModal/);
  assert.match(technicianSource, /onConfirm=\{handleSchedule\}/);
  assert.match(technicianSource, /<ImageViewerModal/);
  assert.match(farmerDetailSource, /<ImageViewerModal/);
});

test("Farmer response projection never reads the internal technician note", () => {
  assert.doesNotMatch(farmerResponseSource, /technicianNote/);
  assert.match(farmerResponseSource, /Available for pickup/);
  assert.match(farmerResponseSource, /collection is not recorded/);
});

test("Farmer detail renders response or scheduled content before the original request", () => {
  const responseIndex = farmerDetailSource.indexOf(
    "responseFirst || scheduledVisitFirst",
  );
  const originalRequestIndex = farmerDetailSource.indexOf(
    '"Your original request"',
  );
  assert.ok(responseIndex >= 0);
  assert.ok(originalRequestIndex > responseIndex);
});
