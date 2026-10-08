import { describe, expect, it } from "vitest";
import { buildUnaipMonthlyWorkbook, unaipWorkbookFilename } from "./unaipMonthlyWorkbook";

const sampleReport = {
  month: 10, year: 2026, serviceType: "calving", count: 1,
  records: [{ recordId: "cd-1", linkedPregnancyId: "pd-1", linkedInseminationId: "ai-1", animalId: "A-1", farmerName: "Farmer One", barangay: "Botong", calvingDate: "2026-10-20T00:00:00.000Z", totalDelivered: 2, calves: [{ earTag: "C-1", sex: "F" }, { earTag: "C-2", sex: "M" }] }],
  context: {
    artificialInsemination: [{ recordId: "ai-1", serviceDate: "2026-09-30T16:00:00.000Z", attemptNumber: 0 }],
    pregnancyDiagnosis: [{ recordId: "pd-1", linkedInseminationId: "ai-1", diagnosisDate: "2026-04-10T00:00:00.000Z", result: "Pregnant" }],
  },
};

describe("UNAIP Excel workbook", () => {
  it("uses the print form's exact-ID rows, fields, grouped headings, and typed Manila dates", () => {
    const workbook = buildUnaipMonthlyWorkbook(sampleReport);
    expect(workbook.worksheets).toHaveLength(1);
    const sheet = workbook.getWorksheet("Monthly Accomplishment");
    expect(sheet.getCell("A10").value).toBe("Animal Identification");
    expect(sheet.getCell("K10").value).toBe("Artificial Insemination");
    expect(sheet.getCell("P10").value).toBe("Pregnancy Diagnosis");
    expect(sheet.getCell("R10").value).toBe("Calf Drop");
    expect(sheet.getCell("T11").value).toBe("Calf ID No.");
    expect(sheet.getCell("V11").value).toBe("Calf ID No.");
    expect(sheet.getCell("A12").value).toBe("CD");
    expect(sheet.getCell("A13").value).toBe("");
    expect(sheet.getCell("I12").value).toBe("Botong");
    expect(sheet.getCell("E12").value).toBe("");
    expect(sheet.getCell("H12").value).toBe("");
    expect(sheet.getCell("L12").value).toBe(0);
    expect(sheet.getCell("P12").value).toEqual(new Date("2026-04-10T00:00:00.000Z"));
    expect(sheet.getCell("S12").value).toBe("");
    expect(["T", "U", "V", "W"].map((column) => sheet.getCell(`${column}12`).value)).toEqual(["C-1", "F", "C-2", "M"]);
    expect(sheet.getCell("K12").value).toEqual(new Date("2026-10-01T00:00:00.000Z"));
    expect(sheet.getCell("K12").numFmt).toBe("mm/dd/yyyy");
    expect(sheet.getColumn("K").width).toBeGreaterThanOrEqual(12);
    expect(sheet.getCell("A11").border.left.style).toBe("thin");
    expect(sheet.getCell("A11").alignment.wrapText).toBe(true);
    expect(sheet.pageSetup.orientation).toBe("landscape");
    expect(sheet.pageSetup.fitToWidth).toBe(1);
    for (let row = 12; row <= 27; row += 1) {
      for (let column = 1; column <= 24; column += 1) {
        const value = sheet.getCell(row, column).value;
        expect(["undefined", "null", "NaN", "N/A", "Not recorded", "-"].includes(value)).toBe(false);
      }
    }
  });

  it("keeps zero-record months as a valid blank form and uses the exact filename", async () => {
    const workbook = buildUnaipMonthlyWorkbook({ month: 10, year: 2026, serviceType: "calving", count: 0, records: [], context: { artificialInsemination: [], pregnancyDiagnosis: [] } });
    const sheet = workbook.getWorksheet("Monthly Accomplishment");
    expect(sheet.getCell("A12").value).toBe("");
    expect(sheet.getCell("A27").value).toBe("");
    expect(sheet.getCell("A4").value).toContain("UNIFIED NATIONAL ARTIFICIAL INSEMINATION PROGRAM");
    expect(sheet.getCell("A6").value).toBe("For the Month of October 2026");
    expect(unaipWorkbookFilename("2026-10")).toBe("BreedSmart_Accomplishment_2026-10.xlsx");
    expect(sheet.pageSetup.printArea).toMatch(/^A1:X\d+$/);
    expect((await workbook.xlsx.writeBuffer()).byteLength).toBeGreaterThan(1000);
  });
});
