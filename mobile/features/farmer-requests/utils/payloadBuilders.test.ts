import assert from "node:assert/strict";
import test from "node:test";
import { buildFarmerAIRequestPayload } from "./payloadBuilders.ts";

test("New AI request with heatSigns and Farmer note stores only note in comment", () => {
  const payload = buildFarmerAIRequestPayload(
    "animal-123",
    ["data:image/jpeg;base64,..."],
    "  Sir pa ai ko bwas  ",
    ["standing_heat", "attempt_mount"],
    [
      { id: "standing_heat", label: "Standing Heat" },
      { id: "attempt_mount", label: "Attempting to Mount" },
    ],
  );

  assert.equal(payload.animalId, "animal-123");
  assert.deepEqual(payload.heatSigns, ["standing_heat", "attempt_mount"]);
  assert.equal(payload.comment, "Sir pa ai ko bwas");
  assert.equal(payload.photos.length, 1);
});

test("New AI request with heatSigns and no Farmer note leaves comment empty", () => {
  const payload = buildFarmerAIRequestPayload(
    "animal-456",
    [],
    "   ",
    ["standing_heat"],
  );

  assert.equal(payload.animalId, "animal-456");
  assert.deepEqual(payload.heatSigns, ["standing_heat"]);
  assert.equal(payload.comment, "");
});
