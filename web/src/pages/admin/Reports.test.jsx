import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "../../lib/axios";
import Reports from "./Reports";
import { formatReportCount, getCurrentReportMonth } from "./reportsPresentation";

const toast = {
  error: vi.fn(),
  success: vi.fn(),
};

vi.mock("../../lib/axios", () => ({
  default: { get: vi.fn() },
}));

vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => toast,
}));

vi.mock("../../components/layout/Topbar", () => ({
  default: ({ title, subtitle }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  ),
}));

vi.mock("jspdf", () => ({
  jsPDF: vi.fn(),
}));

vi.mock("jspdf-autotable", () => ({}));

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Reports />
    </QueryClientProvider>,
  );
};

describe("Admin Reports correctness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosInstance.get.mockImplementation((url) => {
      if (url === "/admin/stats") {
        return Promise.resolve({
          data: { inseminations: 14, pregnancies: 6, calvings: 2 },
        });
      }
      if (url === "/user?role=farmer") return Promise.resolve({ data: [] });
      if (url.startsWith("/reports/monthly-accomplishment")) {
        return Promise.resolve({ data: [] });
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
  });

  it("uses the current local month instead of a fixed reporting period", () => {
    expect(getCurrentReportMonth(new Date(2026, 7, 30))).toBe("2026-08");
    renderPage();
    expect(screen.getByLabelText("Compilation Month")).toHaveValue(
      getCurrentReportMonth(),
    );
  });

  it("keeps only AI/Pregnancy/Calving sources so Advice and Office Pickup cannot be exported as clinical records", async () => {
    renderPage();

    const reportType = screen.getByLabelText("Report Type Template");
    expect(reportType).toHaveTextContent(
      "Department of Agriculture Unified Accomplishment",
    );
    expect(reportType).toHaveTextContent("Veterinary AI Insemination Logs");
    expect(reportType).not.toHaveTextContent(/health|triage|diagnostic/i);
    expect(screen.queryByText(/clinical health triage logs/i)).not.toBeInTheDocument();

    await waitFor(() => expect(axiosInstance.get).toHaveBeenCalledTimes(2));
    expect(axiosInstance.get).not.toHaveBeenCalledWith("/health-request");
  });

  it("renders distinct factual counts without a duplicated success metric", async () => {
    renderPage();

    expect(await screen.findByText("14")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Insemination Entries")).toBeInTheDocument();
    expect(screen.getByText("Pregnancy Records")).toBeInTheDocument();
    expect(screen.getByText("Calving Records")).toBeInTheDocument();
    expect(screen.queryByText(/breeding accomplishments rate/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pregnancy diagnosis accuracy/i)).not.toBeInTheDocument();
    expect(screen.queryByText("84%")).not.toBeInTheDocument();
  });

  it("preserves real zeroes and does not make missing counts look like zero", () => {
    expect(formatReportCount(0)).toBe("0");
    expect(formatReportCount(null)).toBe("—");
    expect(formatReportCount(undefined)).toBe("—");
  });

  it("keeps the breeding export endpoint and uses agricultural empty-state copy", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Compilation Month"), {
      target: { value: "2026-08" },
    });
    fireEvent.click(screen.getByRole("button", { name: /export csv file/i }));

    await waitFor(() =>
      expect(axiosInstance.get).toHaveBeenCalledWith(
        "/reports/monthly-accomplishment?month=8&year=2026",
      ),
    );
    expect(toast.error).toHaveBeenCalledWith(
      "No breeding records found for the selected month and barangay.",
    );
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringMatching(/telemetry/i));
  });
});
