import assert from "node:assert/strict";
import test from "node:test";

import { excludeRequestsWithOfficialMedicalRecords } from "../src/utils/health-records.js";

test("keeps unresolved health requests without an official medical record", () => {
  const pending = { _id: "request-pending", status: "pending" };

  assert.deepEqual(excludeRequestsWithOfficialMedicalRecords([pending], []), [
    pending,
  ]);
});

test("suppresses a health request once its linked medical record exists", () => {
  const resolved = { _id: "request-resolved", status: "resolved" };
  const pending = { _id: "request-pending", status: "pending" };
  const medicalRecords = [
    {
      _id: "medical-record",
      healthRequestId: { _id: "request-resolved" },
    },
  ];

  assert.deepEqual(
    excludeRequestsWithOfficialMedicalRecords(
      [resolved, pending],
      medicalRecords,
    ),
    [pending],
  );
});

test("does not merge unrelated medical records", () => {
  const request = { _id: "request-1", status: "pending" };
  const unrelatedRecord = { _id: "medical-record", healthRequestId: null };

  assert.deepEqual(
    excludeRequestsWithOfficialMedicalRecords([request], [unrelatedRecord]),
    [request],
  );
});
