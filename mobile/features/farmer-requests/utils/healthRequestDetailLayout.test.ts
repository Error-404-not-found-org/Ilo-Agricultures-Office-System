import assert from "node:assert/strict";
import test from "node:test";

import { getFarmerHealthRequestDetailSections } from "./healthRequestDetailLayout.ts";

test("keeps pending Health requests request-first", () => {
  assert.deepEqual(
    getFarmerHealthRequestDetailSections({ status: "pending" }),
    ["original_request", "progress"],
  );
});

test("puts a scheduled Farm Visit before the original request", () => {
  assert.deepEqual(
    getFarmerHealthRequestDetailSections({ status: "scheduled" }),
    ["scheduled_visit", "original_request", "progress"],
  );
});

test("puts resolved Advice before the original request and keeps truthful progress", () => {
  assert.deepEqual(
    getFarmerHealthRequestDetailSections({
      status: "resolved",
      handlingMethod: "advice",
    }),
    ["response", "original_request", "progress"],
  );
});

test("puts resolved Office Pickup before the original request and keeps truthful progress", () => {
  assert.deepEqual(
    getFarmerHealthRequestDetailSections({
      status: "resolved",
      handlingMethod: "office-pickup",
    }),
    ["response", "original_request", "progress"],
  );
});

test("preserves clinical details only for a linked MedicalRecord", () => {
  assert.deepEqual(
    getFarmerHealthRequestDetailSections({
      status: "resolved",
      handlingMethod: "farm_visit",
      medicalRecordId: "medical-record-1",
    }),
    ["original_request", "progress", "clinical_details"],
  );
});
