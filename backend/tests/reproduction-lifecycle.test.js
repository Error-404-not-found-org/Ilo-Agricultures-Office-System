import test from "node:test";
import assert from "node:assert/strict";
import { getReproductionEligibility } from "../src/domain/reproduction-lifecycle.js";

const animal = {
  reproductiveStatus: "Normal",
  species: "Cattle",
  breed: "Brahman",
};

test("blocks a new AI request while pregnancy is active", () => {
  const result = getReproductionEligibility({ animal, activePregnancy: { _id: "pregnancy" } });
  assert.equal(result.eligible, false);
  assert.equal(result.code, "ACTIVE_REPRODUCTIVE_WORKFLOW");
});

test("blocks a new AI request during postpartum recovery", () => {
  const result = getReproductionEligibility({
    animal: { ...animal, lastCalvingDate: new Date() },
    activePregnancy: null,
    activeRequest: null,
  });
  assert.equal(result.eligible, false);
  assert.equal(result.code, "POSTPARTUM_RECOVERY");
});

test("allows a normal animal without active workflow to request AI", () => {
  const result = getReproductionEligibility({ animal, activePregnancy: null, activeRequest: null });
  assert.equal(result.eligible, true);
  assert.equal(result.code, "AVAILABLE");
});
