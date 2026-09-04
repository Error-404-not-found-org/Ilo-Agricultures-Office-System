import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDirectHealthRecordPayload,
  DIRECT_HEALTH_SERVICE_TYPES,
  formatDirectHealthDateKey,
} from "./directHealthRecord.ts";

test("Mobile direct Health uses the canonical service vocabulary", () => {
  assert.deepEqual(
    DIRECT_HEALTH_SERVICE_TYPES.map(({ value }) => value),
    [
      "disease",
      "medicine",
      "checkup",
      "injury",
      "vaccination",
      "deworming",
      "other",
    ],
  );
});

test("Mobile direct Health builds the canonical MedicalRecord payload", () => {
  assert.deepEqual(
    buildDirectHealthRecordPayload({
      animalId: "animal-1",
      requestType: "medicine",
      serviceDate: "2026-09-03",
      diagnosis: "Mild infection",
      treatment: "Cleaned affected area",
      medicineGiven: "Penicillin",
      dosage: "10 ml",
      withdrawalPeriodDays: 7,
      advice: "Keep the area dry",
      resolutionNotes: "Condition resolved",
      followUpDate: "2026-09-10",
    }),
    {
      animalId: "animal-1",
      type: "Treatment",
      serviceDate: "2026-09-03",
      details: {
        serviceType: "medicine",
        diagnosis: "Mild infection",
        treatment: "Cleaned affected area",
        medicineName: "Penicillin",
        dosage: "10 ml",
        withdrawalPeriodDays: 7,
        advice: "Keep the area dry",
      },
      withdrawalPeriodDays: 7,
      note: "Condition resolved",
      followUpDate: "2026-09-10",
    },
  );
  assert.equal(formatDirectHealthDateKey(new Date(2026, 8, 3)), "2026-09-03");
});
