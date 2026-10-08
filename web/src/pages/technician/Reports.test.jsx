import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), exportWorkbook: vi.fn(), toastError: vi.fn() }));
vi.mock("../../lib/axios", () => ({ default: { get: mocks.get } }));
vi.mock("../../components/layout/Topbar", () => ({ default: ({ title, subtitle }) => <header><h1>{title}</h1><p>{subtitle}</p></header> }));
vi.mock("../../contexts/ToastContext", () => ({ useToast: () => ({ success: vi.fn(), error: mocks.toastError }) }));
vi.mock("./unaipMonthlyWorkbook", () => ({ downloadUnaipMonthlyWorkbook: mocks.exportWorkbook }));

import Reports from "./Reports";

const monthly = {
  month: 10, year: 2026, serviceType: "ai", count: 2,
  records: [{ recordId: "ai-1" }, { recordId: "ai-2" }],
  context: { artificialInsemination: [], pregnancyDiagnosis: [] },
};

const renderReports = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Reports /></QueryClientProvider>);

describe("Technician Reports & Documents", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.exportWorkbook.mockReset();
    mocks.toastError.mockReset();
    mocks.get.mockResolvedValue({ data: monthly });
  });

  it("shows one selected-service count and fetches no legacy operations data", async () => {
    renderReports();
    expect(screen.getByRole("heading", { name: "Reports & Documents" })).toBeInTheDocument();
    expect(screen.getByLabelText("Monthly accomplishment month")).toBeInTheDocument();
    expect(screen.getByLabelText("Monthly accomplishment service type")).toHaveValue("ai");
    await screen.findByText("2 official records");
    const monthlySection = screen.getByRole("region", { name: "Monthly Accomplishment" });
    expect(within(monthlySection).getByRole("group", { name: "Artificial Insemination: 2 records" })).toBeInTheDocument();
    expect(within(monthlySection).queryByRole("group", { name: /Pregnancy Diagnosis:|Calving:/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Print Monthly Form" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export Excel" })).toBeInTheDocument();
    for (const legacy of ["Operations Center", "Operational Summary", "Live Work Logs", "Municipal Archives", "Operational Alerts", "Upcoming Events Timeline"]) {
      expect(screen.queryByText(legacy)).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: /Export PDF|Export CSV/i })).not.toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.get).toHaveBeenCalledWith("/reports/monthly-accomplishment", { params: expect.objectContaining({ month: expect.any(Number), year: expect.any(Number), serviceType: "ai" }) });
  });

  it("refetches the selected service and shows only its anchor count", async () => {
    mocks.get.mockImplementation(async (_, config) => ({ data: config.params.serviceType === "calving"
      ? { ...monthly, serviceType: "calving", count: 1, records: [{ recordId: "cd-1" }] }
      : monthly }));
    renderReports();
    await screen.findByText("2 official records");
    fireEvent.change(screen.getByLabelText("Monthly accomplishment service type"), { target: { value: "calving" } });
    expect(await screen.findByRole("group", { name: "Calving: 1 record" })).toBeInTheDocument();
    expect(screen.getByText("1 official record")).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith("/reports/monthly-accomplishment", { params: expect.objectContaining({ serviceType: "calving" }) });
  });

  it("treats zero as an empty month and still prints a blank official form", async () => {
    mocks.get.mockResolvedValue({ data: { ...monthly, count: 0, records: [] } });
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderReports();
    await screen.findByText("0 official records");
    fireEvent.click(screen.getByRole("button", { name: "Print Monthly Form" }));
    expect(print).toHaveBeenCalledOnce();
    expect(document.body).toHaveClass("unaip-printing");
    window.dispatchEvent(new Event("afterprint"));
    await waitFor(() => expect(document.body).not.toHaveClass("unaip-printing"));
    print.mockRestore();
  });

  it("does not describe an unselected month as loading", async () => {
    renderReports();
    await screen.findByText("2 official records");
    fireEvent.change(screen.getByLabelText("Monthly accomplishment month"), { target: { value: "" } });
    expect(screen.getByText("Choose a month to view official records.")).toBeInTheDocument();
    expect(screen.queryByText(/Loading official monthly records/)).not.toBeInTheDocument();
  });

  it("exports the selected canonical report once, disables repeat clicks, then restores the action", async () => {
    let finish;
    mocks.exportWorkbook.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    renderReports();
    await screen.findByText("2 official records");
    const selectedMonth = screen.getByLabelText("Monthly accomplishment month").value;
    fireEvent.click(screen.getByRole("button", { name: "Export Excel" }));
    expect(screen.getByRole("button", { name: "Exporting..." })).toBeDisabled();
    await waitFor(() => expect(mocks.exportWorkbook).toHaveBeenCalledOnce());
    expect(mocks.exportWorkbook).toHaveBeenCalledWith(monthly, selectedMonth);
    finish();
    await waitFor(() => expect(screen.getByRole("button", { name: "Export Excel" })).toBeEnabled());
  });

  it("shows a safe error if workbook generation fails", async () => {
    mocks.exportWorkbook.mockRejectedValue(new Error("private stack detail"));
    renderReports();
    await screen.findByText("2 official records");
    fireEvent.click(screen.getByRole("button", { name: "Export Excel" }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Could not export the monthly accomplishment. Try again."));
    expect(screen.getByRole("button", { name: "Export Excel" })).toBeEnabled();
  });
});
