import { describe, expect, it } from "vitest";
import { buildUnaipMonthlyRows } from "./unaipMonthlyRows";

const ai = (recordId) => ({ recordId, animalId: "A-1", serviceDate: "2026-03-01", barangay: "Botong" });
const pd = (recordId, linkedInseminationId) => ({ recordId, linkedInseminationId, animalId: "A-1", diagnosisDate: "2026-04-02" });
const cd = (recordId, linkedPregnancyId, linkedInseminationId) => ({ recordId, linkedPregnancyId, linkedInseminationId, animalId: "A-1", calvingDate: "2026-09-03" });

describe("UNAIP selected-service association", () => {
  it("keeps separate AI attempts as separate accomplishments", () => {
    const rows = buildUnaipMonthlyRows({ serviceType: "ai", records: [ai("ai-1"), ai("ai-2")], context: { artificialInsemination: [], pregnancyDiagnosis: [] } });
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.ai.recordId)).toEqual(["ai-1", "ai-2"]);
    expect(rows.every((row) => row.type === "AI" && !row.pd && !row.calving)).toBe(true);
  });

  it("uses the exact Pregnancy and AI IDs for a Calving anchor, not the same animal", () => {
    const rows = buildUnaipMonthlyRows({
      serviceType: "calving",
      records: [cd("cd-1", "pd-1", "ai-2")],
      context: { artificialInsemination: [ai("ai-1"), ai("ai-2")], pregnancyDiagnosis: [pd("pd-1", "ai-2")] },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "CD", ai: { recordId: "ai-2" }, pd: { recordId: "pd-1" }, calving: { recordId: "cd-1" } });
  });
});
