import { describe, expect, it } from "vitest";
import { buildMonthlyAccomplishmentRows } from "./monthlyAccomplishmentRows";

describe("Technician monthly accomplishment legacy export compatibility", () => {
  it("retains one row per official record, canonical dates/results, and real zeroes", () => {
    const { headers, rows } = buildMonthlyAccomplishmentRows({
      artificialInsemination: [
        { recordId: "ai-1", serviceDate: "2026-10-03T00:00:00Z", animalId: "BS-1", farmerName: "Farmer", barangay: "Oton", attemptNumber: 1, semenDosesUsed: 0 },
        { recordId: "ai-2", serviceDate: "2026-10-24T00:00:00Z", animalId: "BS-1", farmerName: "Farmer" },
      ],
      pregnancyDiagnosis: [{ recordId: "pd-1", diagnosisDate: "2026-10-25T00:00:00Z", result: "Empty", animalId: "BS-1" }],
      calving: [{ recordId: "cd-1", calvingDate: "2026-10-30T00:00:00Z", totalDelivered: 0, animalId: "BS-1" }],
    });
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row[0])).toEqual(["AI", "AI", "PD", "CD"]);
    expect(rows[0][headers.indexOf("Service Date")]).toBe("2026-10-03T00:00:00Z");
    expect(rows[2][headers.indexOf("Result / Outcome")]).toBe("Empty");
    expect(rows[3][headers.indexOf("Total Delivered")]).toBe(0);
    expect(rows[0][headers.indexOf("Semen Doses Used")]).toBe(0);
  });
});
