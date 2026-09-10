import { describe, expect, it } from "vitest";
import {
  buildDirectHealthRecordPayload,
  DIRECT_HEALTH_SERVICE_TYPES,
  formatDirectHealthDateKey,
  medicalRecordTypeForHealthService,
} from "./directHealthRecord";

describe("direct Health MedicalRecord contract", () => {
  it("uses the canonical service vocabulary and record type mapping", () => {
    expect(DIRECT_HEALTH_SERVICE_TYPES.map(({ value }) => value)).toEqual([
      "disease",
      "medicine",
      "checkup",
      "injury",
      "vaccination",
      "deworming",
      "other",
    ]);
    expect(medicalRecordTypeForHealthService("medicine")).toBe("Treatment");
    expect(medicalRecordTypeForHealthService("vaccination")).toBe("Vaccination");
  });

  it("maps every clinical field to the canonical MedicalRecord payload", () => {
    expect(
      buildDirectHealthRecordPayload({
        animalId: "animal-1",
        serviceType: "medicine",
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
    ).toEqual({
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
    });
  });

  it("formats the service date from local calendar fields", () => {
    expect(formatDirectHealthDateKey(new Date(2026, 8, 3, 23, 30))).toBe(
      "2026-09-03",
    );
  });
});
