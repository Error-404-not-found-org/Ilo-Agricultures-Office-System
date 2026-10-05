import test from "node:test";
import assert from "node:assert/strict";
import { getFarmerProfileActivity } from "./farmerProfileActivity.ts";

test("labels canonical tasks without a generic Field Task label", () => {
  const rows = getFarmerProfileActivity([
    { _id: "pd", type: "task", taskType: "PD", createdAt: "2026-09-29" },
    { _id: "cd", type: "task", taskType: "CD", createdAt: "2026-09-28" },
    { _id: "visit", type: "task", taskType: "GeneralVisit", createdAt: "2026-09-27" },
  ]);
  assert.deepEqual(rows.map((row) => row.title), ["Pregnancy Check", "Expected Calving", "General Visit"]);
});

test("hides only an explicitly linked Health mirror already in the preview", () => {
  const rows = getFarmerProfileActivity([
    { _id: "task-1", type: "task", taskType: "Health", relatedRecordType: "health", relatedRecordId: "health-1" },
    { _id: "health-1", type: "health" },
    { _id: "task-2", type: "task", taskType: "Health", relatedRecordType: "health", relatedRecordId: "health-2" },
  ]);
  assert.deepEqual(rows.map((row) => row.id), ["health-1", "task-2"]);
});

test("retains unlinked work and uses creation time only as an added date", () => {
  const rows = getFarmerProfileActivity([
    { _id: "a", type: "task", taskType: "Health", animalId: { earTag: "01" }, createdAt: "2026-09-29" },
    { _id: "b", type: "health", animalId: { earTag: "01" }, createdAt: "2026-09-28" },
  ]);
  assert.deepEqual(rows.map((row) => row.title), ["Health Visit", "Health Request"]);
  assert.deepEqual(rows.map((row) => row.animalLabel), ["Tag #01", "Tag #01"]);
  assert.equal(rows[0].addedAt, "2026-09-29");
});

test("uses workflow-specific recent activity icons", () => {
  const rows = getFarmerProfileActivity([
    { _id: "ai", type: "ai" },
    { _id: "health", type: "health" },
    { _id: "pd", type: "task", taskType: "PD" },
    { _id: "cd", type: "task", taskType: "CD" },
    { _id: "other", type: "task", taskType: "Other" },
  ], 5);
  assert.deepEqual(rows.map((row) => row.icon), [
    "needle", "medical-bag", "calendar-heart", "baby-carriage", "clipboard-text-outline",
  ]);
});
