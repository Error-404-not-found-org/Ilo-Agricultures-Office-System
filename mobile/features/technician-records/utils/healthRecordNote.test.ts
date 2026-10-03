import test from "node:test";
import assert from "node:assert/strict";
import { getVisibleHealthTechnicianNote } from "./healthRecordNote.ts";
import {
  formatHealthAssistanceLabel,
  getStructuredHealthRequestPresentation,
} from "../../farmer-requests/utils/healthRequestInput.ts";

test("Technician Mobile hides the exact legacy synthetic Health note", () => {
  assert.equal(
    getVisibleHealthTechnicianNote("Resolved through health request queue."),
    undefined,
  );
});

test("Technician Mobile preserves genuine Health notes", () => {
  assert.equal(
    getVisibleHealthTechnicianNote("Animal remained weak after treatment."),
    "Animal remained weak after treatment.",
  );
});

test("Technician Mobile uses canonical assistance and observed-sign labels", () => {
  assert.equal(formatHealthAssistanceLabel("disease"), "Sick or Injured Animal");
  assert.deepEqual(
    getStructuredHealthRequestPresentation({
      requestDetails: {
        version: 1,
        assistanceRequested: "health_concern",
        observedSigns: ["diarrhea"],
        farmerDescription: "Loose stool since yesterday.",
      },
    }),
    {
      assistanceLabel: "Sick or Injured Animal",
      observedSigns: ["Diarrhea"],
      farmerDescription: "Loose stool since yesterday.",
    },
  );
});
