import test from "node:test";
import assert from "node:assert/strict";
import {
  firstGenuineHealthRecordNote,
  normalizeHealthRecordNote,
} from "../src/domain/health-record-note.js";

test("legacy synthetic Health note is omitted from official presentation", () => {
  assert.equal(
    normalizeHealthRecordNote("Resolved through health request queue."),
    undefined,
  );
});

test("genuine Technician Health notes remain visible", () => {
  assert.equal(
    normalizeHealthRecordNote("Animal remained weak after treatment."),
    "Animal remained weak after treatment.",
  );
});

test("Health note selection uses only the first genuine entered value", () => {
  assert.equal(
    firstGenuineHealthRecordNote(
      undefined,
      "Resolved through health request queue.",
      "Animal remained weak after treatment.",
    ),
    "Animal remained weak after treatment.",
  );
});
