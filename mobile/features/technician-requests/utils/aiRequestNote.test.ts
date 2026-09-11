import assert from "node:assert/strict";
import test from "node:test";
import { extractFarmerNote, formatHeatSignLabel } from "./aiRequestNote.ts";

test("CASE A: extracts actual note from legacy composite comment", () => {
  const legacyComposite = `Observed Heat Signs:
• Standing to be Mounted (Standing Heat)
• Attempting to Mount Other Cows

Additional Notes:
Sir pa ai ko bwas`;
  assert.equal(extractFarmerNote(legacyComposite), "Sir pa ai ko bwas");
});

test("CASE B: returns empty string for legacy composite with no actual note", () => {
  const legacyNoNote = `Observed Heat Signs:
• Standing to be Mounted (Standing Heat)
• Attempting to Mount Other Cows`;
  assert.equal(extractFarmerNote(legacyNoNote), "");
});

test("CASE C: returns actual note from legacy Additional Notes: format", () => {
  const legacyOnlyNotes = `Additional Notes:
Sir pa ai ko bwas`;
  assert.equal(extractFarmerNote(legacyOnlyNotes), "Sir pa ai ko bwas");

  const singleLine = "Additional Notes: Please visit before noon";
  assert.equal(extractFarmerNote(singleLine), "Please visit before noon");
});

test("CASE D: returns modern plain comment unchanged", () => {
  assert.equal(extractFarmerNote("Sir pa ai ko bwas"), "Sir pa ai ko bwas");
  assert.equal(
    extractFarmerNote("Call me before coming"),
    "Call me before coming",
  );
});

test("CASE E: returns empty string for null, undefined, or whitespace", () => {
  assert.equal(extractFarmerNote(null), "");
  assert.equal(extractFarmerNote(undefined), "");
  assert.equal(extractFarmerNote(""), "");
  assert.equal(extractFarmerNote("   \n\t  "), "");
});

test("formatHeatSignLabel: established labels and fallbacks", () => {
  assert.equal(formatHeatSignLabel("standing_heat"), "Standing Heat");
  assert.equal(formatHeatSignLabel("attempt_mount"), "Attempting to Mount");
  assert.equal(
    formatHeatSignLabel("attempting_to_mount"),
    "Attempting to Mount",
  );
  assert.equal(
    formatHeatSignLabel("clear_mucus"),
    "Clear Mucus Discharge",
  );
  assert.equal(
    formatHeatSignLabel("mucus_discharge"),
    "Clear Mucus Discharge",
  );
  assert.equal(formatHeatSignLabel("custom_observation"), "Custom Observation");
  assert.equal(formatHeatSignLabel(""), "");
});
