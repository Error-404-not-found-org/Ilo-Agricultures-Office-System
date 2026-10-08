import { describe, expect, it } from "vitest";
import { buildUnaipMonthlyRows } from "./unaipMonthlyRows";
import { getUnaipFormCells } from "./unaipMonthlyFormData";

const ai = (recordId, serviceDate = "2026-03-10T00:00:00Z") => ({ recordId, animalId: "A-1", serviceDate, attemptNumber: recordId === "ai-1" ? 1 : 2, sireCode: recordId, barangay: "Botong" });
const pd = (recordId, linkedInseminationId, diagnosisDate = "2026-04-10T00:00:00Z") => ({ recordId, linkedInseminationId, animalId: "A-1", diagnosisDate, result: "Pregnant" });
const cd = (recordId, linkedPregnancyId, linkedInseminationId) => ({ recordId, linkedPregnancyId, linkedInseminationId, animalId: "A-1", calvingDate: "2026-09-10T00:00:00Z" });
const report = (serviceType, records, context = {}) => ({ serviceType, records, context: { artificialInsemination: context.ai ?? [], pregnancyDiagnosis: context.pd ?? [] } });

describe("selected-service UNAIP monthly rows", () => {
  it("produces only AI anchor rows with AI Data and empty PD/Calf Drop cells", () => {
    const rows = buildUnaipMonthlyRows(report("ai", [ai("ai-1", "2026-09-01T00:00:00Z")]));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "AI", ai: { recordId: "ai-1" }, pd: null, calving: null });
    const cells = getUnaipFormCells(rows[0], 0);
    expect(cells[0]).toBe("AI");
    expect(cells.slice(15, 24)).toEqual(Array(9).fill(""));
  });

  it("uses only exact authorized earlier AI as context for a PD anchor", () => {
    const rows = buildUnaipMonthlyRows(report("pregnancy", [pd("pd-sep", "ai-2", "2026-09-01T00:00:00Z")], { ai: [ai("ai-1"), ai("ai-2")] }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "PD", ai: { recordId: "ai-2" }, pd: { recordId: "pd-sep" }, calving: null });
    expect(getUnaipFormCells(rows[0], 0)[0]).toBe("PD");
    expect(getUnaipFormCells(rows[0], 0).slice(17, 24)).toEqual(Array(7).fill(""));
  });

  it("leaves unauthorized AI context blank without hiding the PD anchor", () => {
    const rows = buildUnaipMonthlyRows(report("pregnancy", [pd("pd-sep", "ai-peer", "2026-09-01T00:00:00Z")], { ai: [ai("ai-own")] }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "PD", ai: null, pd: { recordId: "pd-sep" } });
    expect(getUnaipFormCells(rows[0], 0).slice(10, 15)).toEqual(Array(5).fill(""));
  });

  it("shows exact authorized AI and PD history for Calving without creating extra rows", () => {
    const rows = buildUnaipMonthlyRows(report("calving", [cd("cd-sep", "pd-1", "ai-1")], { ai: [ai("ai-1")], pd: [pd("pd-1", "ai-1")] }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "CD", ai: { recordId: "ai-1" }, pd: { recordId: "pd-1" }, calving: { recordId: "cd-sep" } });
    expect(getUnaipFormCells(rows[0], 0)[0]).toBe("CD");
  });

  it("keeps a Calving anchor when PD is unauthorized but its direct exact AI is authorized", () => {
    const rows = buildUnaipMonthlyRows(report("calving", [cd("cd-sep", "pd-peer", "ai-1")], { ai: [ai("ai-1")] }));
    expect(rows[0]).toMatchObject({ type: "CD", ai: { recordId: "ai-1" }, pd: null, calving: { recordId: "cd-sep" } });
    expect(getUnaipFormCells(rows[0], 0).slice(15, 17)).toEqual(["", ""]);
  });

  it("blanks disputed context when Calving and linked Pregnancy point to different AI attempts", () => {
    const rows = buildUnaipMonthlyRows(report("calving", [cd("cd-sep", "pd-1", "ai-2")], { ai: [ai("ai-1"), ai("ai-2")], pd: [pd("pd-1", "ai-1")] }));
    expect(rows[0]).toMatchObject({ type: "CD", ai: null, pd: null, calving: { recordId: "cd-sep" } });
  });

  it("never joins by animal, Farmer, month, or nearest date", () => {
    const rows = buildUnaipMonthlyRows(report("calving", [cd("cd-sep", "unrelated-pd", "unrelated-ai")], { ai: [ai("ai-1")], pd: [pd("pd-1", "ai-1")] }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ai: null, pd: null, calving: { recordId: "cd-sep" } });
  });
});
