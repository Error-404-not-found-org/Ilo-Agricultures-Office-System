import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateTargetCalvingDate,
  checkInseminationAgeEligibility,
  verifyPostpartumWindow,
} from "../src/utils/cattleCore.js";

test("cattleCore: postpartum check rejects action dates before calving", () => {
  const result = verifyPostpartumWindow(
    new Date("2026-06-20T00:00:00.000Z"),
    new Date("2026-06-10T00:00:00.000Z"),
    "Beef Cattle",
    "Brahman",
  );

  assert.equal(result.isSafe, false);
  assert.equal(result.daysPassed < 0, true);
});

test("cattleCore: postpartum check allows action after required waiting period", () => {
  const result = verifyPostpartumWindow(
    new Date("2026-01-01T00:00:00.000Z"),
    new Date("2026-03-10T00:00:00.000Z"),
    "Beef Cattle",
    "Brahman",
  );

  assert.equal(result.isSafe, true);
  assert.equal(result.requiredDays, 55);
});

test("cattleCore: unknown species falls back to cattle gestation", () => {
  const target = calculateTargetCalvingDate(
    new Date("2026-01-01T00:00:00.000Z"),
    "Unknown Species",
  );

  assert.equal(target.toISOString().slice(0, 10), "2026-10-11");
});

test("cattleCore: missing birth date blocks AI eligibility", () => {
  const result = checkInseminationAgeEligibility(undefined, "Cattle");

  assert.equal(result.isEligible, false);
  assert.equal(result.code, "BIRTH_DATE_REQUIRED");
  assert.match(result.reason, /birth date is required/i);
});

test("cattleCore: invalid birth date blocks AI eligibility", () => {
  const result = checkInseminationAgeEligibility("not-a-valid-date", "Cattle");

  assert.equal(result.isEligible, false);
  assert.equal(result.code, "INVALID_BIRTH_DATE");
  assert.match(result.reason, /birth date is invalid/i);
});