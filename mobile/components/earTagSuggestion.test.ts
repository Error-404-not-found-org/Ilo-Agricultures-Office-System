import test from "node:test";
import assert from "node:assert/strict";
import * as suggestion from "./earTagSuggestion.ts";

test("proposes the next unused sequence for a Farmer's active herd", () => {
  assert.equal(typeof suggestion.generateEarTagSuggestion, "function");
  assert.equal(
    suggestion.generateEarTagSuggestion({ farmerName: "Dario Perez", existingEarTags: ["01DP", "02dp"] }),
    "03DP",
  );
});

test("does not reuse a lower gap when a higher active sequence exists", () => {
  assert.equal(
    suggestion.generateEarTagSuggestion({ farmerName: "Dario Perez", existingEarTags: ["02DP"] }),
    "03DP",
  );
});

test("generated suggestions remain representable beyond two sequence digits", () => {
  assert.equal(suggestion.generateEarTagSuggestion({ farmerName: "Dario Perez" }), "01DP");
  assert.equal(suggestion.generateEarTagSuggestion({ farmerName: "Dario Perez", existingEarTags: ["98DP"] }), "99DP");
  assert.equal(suggestion.generateEarTagSuggestion({ farmerName: "Dario Perez", existingEarTags: ["99DP"] }), "100DP");
  assert.equal(suggestion.generateEarTagSuggestion({ farmerName: "Dario Perez", existingEarTags: ["998DP"] }), "999DP");
});

test("accepts manual tags through 20 characters and rejects longer values explicitly", () => {
  assert.equal(suggestion.getEarTagValidationError("100DP"), null);
  assert.equal(suggestion.getEarTagValidationError("MANUAL-TAG-123456789"), null);
  assert.equal(
    suggestion.getEarTagValidationError("MANUAL-TAG-1234567890"),
    "Ear tag must be 20 characters or fewer.",
  );
});
