import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  POSTPARTUM_TEST_IDENTIFIERS,
  buildPostpartumTestAnimals,
  validatePostpartumTestAnimals,
} from "../scripts/seed-postpartum-test-animals.js";

test("postpartum test seeder builds recovering and recovered fixtures", () => {
  const now = new Date("2026-08-27T00:00:00.000Z");
  const animals = buildPostpartumTestAnimals({
    farmerId: new mongoose.Types.ObjectId(),
    now,
  });
  const result = validatePostpartumTestAnimals(animals, now);

  assert.equal(animals.length, 2);
  assert.equal(
    animals[0].animalId,
    `DEV-${POSTPARTUM_TEST_IDENTIFIERS.RECOVERING}`,
  );
  assert.equal(animals[0].reproductiveStatus, "Post-partum");
  assert.equal(result.recoveringEligibility.eligible, false);
  assert.equal(result.recoveringEligibility.code, "POSTPARTUM_RECOVERY");

  assert.equal(
    animals[1].animalId,
    `DEV-${POSTPARTUM_TEST_IDENTIFIERS.RECOVERY_COMPLETE}`,
  );
  assert.equal(animals[1].reproductiveStatus, "Post-partum");
  assert.equal(result.recoveredEligibility.eligible, true);
  assert.equal(result.recoveredEligibility.effectiveReproductiveStatus, "Normal");
  assert.notEqual(
    result.recoveredEligibility.effectiveReproductiveStatus,
    "In Heat",
  );
});
