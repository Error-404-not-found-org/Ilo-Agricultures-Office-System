import { describe, expect, it } from "vitest";
import { getUnaipFormCells, UNAIP_HEADINGS, formatManilaDate, toExcelManilaDate } from "./unaipMonthlyFormData";

describe("shared UNAIP form cells", () => {
  it("keeps barangay, zero, two calves, and unresolved No. of Calving consistent", () => {
    const row = {
      type: "CD",
      ai: { animalId: "A-1", barangay: "Botong", attemptNumber: 0, serviceDate: "2026-09-30T16:00:00.000Z" },
      pd: { diagnosisDate: "2026-10-02T00:00:00.000Z", result: "Pregnant" },
      calving: { animalId: "A-1", barangay: "Botong", calvingDate: "2026-10-20T00:00:00.000Z", totalDelivered: 2, calves: [{ earTag: "C-1", sex: "F" }, { earTag: "C-2", sex: "M" }] },
    };
    const cells = getUnaipFormCells(row, 0, formatManilaDate);
    expect(UNAIP_HEADINGS).toHaveLength(24);
    expect(cells).toHaveLength(24);
    expect(cells[0]).toBe("CD");
    expect(cells[8]).toBe("Botong");
    expect(cells[10]).toBe("10/01/2026");
    expect(cells[11]).toBe(0);
    expect(cells[18]).toBe("");
    expect(cells.slice(19, 23)).toEqual(["C-1", "F", "C-2", "M"]);
    expect(cells.some((cell) => cell === null || cell === undefined || Number.isNaN(cell))).toBe(false);
  });

  it("uses a typed Manila calendar date for Excel while leaving unavailable dates blank", () => {
    expect(toExcelManilaDate("2026-09-30T16:00:00.000Z")).toEqual(new Date("2026-10-01T00:00:00.000Z"));
    expect(toExcelManilaDate(null)).toBe("");
    expect(toExcelManilaDate("bad-date")).toBe("");
  });
});
