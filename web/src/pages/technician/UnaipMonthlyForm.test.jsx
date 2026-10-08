import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import UnaipMonthlyForm from "./UnaipMonthlyForm";

describe("UNAIP monthly print form", () => {
  it("prints locality, exact-linked services and both calf pairs without inventing No. of Calving or signatories", () => {
    render(<UnaipMonthlyForm report={{
      month: 10, year: 2026,
      serviceType: "calving",
      records: [{ recordId: "cd-1", linkedPregnancyId: "pd-1", linkedInseminationId: "ai-1", animalId: "DAM-1", barangay: "Botong", farmerName: "Farmer One", calvingDate: "2026-10-25", totalDelivered: 2, calves: [{ earTag: "TWIN-1", sex: "F" }, { earTag: "TWIN-2", sex: "M" }] }],
      context: {
        artificialInsemination: [{ recordId: "ai-1", serviceDate: "2026-03-01", attemptNumber: 1 }],
        pregnancyDiagnosis: [{ recordId: "pd-1", linkedInseminationId: "ai-1", diagnosisDate: "2026-04-03", result: "Pregnant" }],
      },
    }} />);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader", { name: "Calf ID No." })).toHaveLength(2);
    const firstRow = within(table).getAllByRole("row")[2];
    expect(within(firstRow).getAllByRole("cell")[0]).toHaveTextContent("CD");
    expect(within(firstRow).getAllByRole("cell")[10]).toHaveTextContent("03/01/2026");
    expect(firstRow).toHaveTextContent("Botong");
    expect(firstRow).toHaveTextContent("TWIN-1");
    expect(firstRow).toHaveTextContent("TWIN-2");
    expect(within(firstRow).getAllByRole("cell")[18]).toBeEmptyDOMElement();
    expect(screen.getByText("Prepared by:").closest("div")).not.toHaveTextContent("Technician One");
  });

  it("does not silently discard additional calf references beyond the two paper columns", () => {
    render(<UnaipMonthlyForm report={{ month: 10, year: 2026, serviceType: "calving", records: [{ recordId: "cd-1", calves: [{ earTag: "C-1", sex: "F" }, { earTag: "C-2", sex: "M" }, { earTag: "C-3", sex: "F" }] }], context: { artificialInsemination: [], pregnancyDiagnosis: [] } }} />);
    expect(screen.getByText(/Additional calf references/)).toHaveTextContent("C-3 (F)");
  });
});
