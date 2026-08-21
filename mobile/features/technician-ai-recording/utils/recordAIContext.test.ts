import assert from "node:assert/strict";
import test from "node:test";

import { mergeRecordAIRequestSnapshot } from "./recordAIContext.ts";

test("Record AI status refresh preserves complete request-summary context", () => {
  const merged = mergeRecordAIRequestSnapshot(
    {
      _id: "request-1",
      status: "scheduled",
      requestKind: "re_insemination",
      attemptNumber: 2,
      farmerId: {
        _id: "farmer-1",
        name: "Maria Farmer",
        address: { barangay: "Poblacion" },
        farmLocation: { detectedAddress: "North field" },
      },
      animalId: {
        _id: "animal-1",
        earTag: "AI-002",
        species: "Cattle",
        breed: "Brahman",
      },
      previousAttemptId: {
        _id: "attempt-1",
        attemptNumber: 1,
        outcome: "Failed (Re-heat)",
      },
    },
    {
      _id: "request-1",
      status: "in-progress",
      farmerId: { _id: "farmer-1", name: "Maria Farmer" },
      animalId: { _id: "animal-1", earTag: "AI-002", species: "Cattle" },
    },
  );

  assert.equal(merged.status, "in-progress");
  assert.equal(merged.farmerId.address.barangay, "Poblacion");
  assert.equal(merged.farmerId.farmLocation.detectedAddress, "North field");
  assert.equal(merged.animalId.breed, "Brahman");
  assert.equal(merged.requestKind, "re_insemination");
  assert.equal(merged.attemptNumber, 2);
  assert.equal(merged.previousAttemptId.outcome, "Failed (Re-heat)");
});
