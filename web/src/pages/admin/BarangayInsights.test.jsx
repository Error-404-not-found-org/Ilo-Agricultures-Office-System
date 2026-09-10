import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "../../lib/axios";
import BarangayInsights from "./BarangayInsights";
import {
  formatBarangayMetric,
  getDefaultBarangaySort,
  mapBarangayInsight,
  sortBarangayInsights,
  sumBarangayMetric,
} from "./barangayInsightsPresentation";

vi.mock("../../lib/axios", () => ({
  default: { get: vi.fn() },
}));

vi.mock("../../components/layout/Topbar", () => ({
  default: ({ title, subtitle }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  ),
}));

const canonicalInsight = {
  barangay: "Poblacion East",
  municipality: "Oton",
  city: "Oton",
  district: "",
  farmersCount: 12,
  animalsCount: 34,
  pendingHealthRequests: 2,
  pendingAIRequests: 3,
  activePregnancies: 4,
  incompleteRecordsCount: 5,
  aiSuccessRate: 75,
  activityScore: 68,
  status: "attention",
};

const secondInsight = {
  ...canonicalInsight,
  barangay: "Abilay Norte",
  farmersCount: 3,
  animalsCount: 8,
  pendingHealthRequests: 0,
  pendingAIRequests: 1,
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BarangayInsights />
    </QueryClientProvider>,
  );
};

const tableBarangayNames = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).queryByRole("rowheader")?.textContent)
    .filter(Boolean);

describe("Barangay Insights factual table", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps only canonical factual fields and preserves real zeroes", () => {
    const mapped = mapBarangayInsight({
      ...canonicalInsight,
      farmersCount: 0,
      farmers: 999,
      farmerCount: 888,
      technicians: [{ _id: "unsupported" }],
    });

    expect(mapped).toMatchObject({
      farmersCount: 0,
      animalsCount: 34,
      pendingHealthRequests: 2,
      pendingAIRequests: 3,
      activePregnancies: 4,
      incompleteRecordsCount: 5,
    });
    expect(mapped).not.toHaveProperty("technicians");
    expect(mapped).not.toHaveProperty("status");
    expect(mapped).not.toHaveProperty("activityScore");
    expect(mapped).not.toHaveProperty("aiSuccessRate");
    expect(formatBarangayMetric(0)).toBe("0");
    expect(formatBarangayMetric(null)).toBe("Not available");
  });

  it("calculates truthful totals and refuses partial totals", () => {
    const rows = [
      mapBarangayInsight(canonicalInsight),
      mapBarangayInsight(secondInsight),
    ];

    expect(sumBarangayMetric(rows, "farmersCount")).toBe(15);
    expect(sumBarangayMetric(rows, "animalsCount")).toBe(42);
    expect(sumBarangayMetric(rows, "pendingHealthRequests")).toBe(2);
    expect(
      sumBarangayMetric(
        [...rows, { ...rows[0], farmersCount: null }],
        "farmersCount",
      ),
    ).toBeNull();
  });

  it("defaults to pending Health descending, then alphabetic when no workload exists", () => {
    const rows = [
      mapBarangayInsight(secondInsight),
      mapBarangayInsight(canonicalInsight),
    ];

    expect(getDefaultBarangaySort(rows)).toEqual({
      key: "pendingHealthRequests",
      direction: "desc",
    });
    expect(
      sortBarangayInsights(rows, getDefaultBarangaySort(rows)).map(
        (item) => item.name,
      ),
    ).toEqual(["Poblacion East", "Abilay Norte"]);

    const noPending = rows.map((item) => ({
      ...item,
      pendingHealthRequests: 0,
    }));
    expect(getDefaultBarangaySort(noPending)).toEqual({
      key: "name",
      direction: "asc",
    });
  });

  it("renders factual summary totals and table columns without heuristic labels", async () => {
    axiosInstance.get.mockResolvedValue({
      data: [canonicalInsight, secondInsight],
    });
    renderPage();

    await screen.findByText("15");
    const summary = await screen.findByRole("region", {
      name: "Barangay summary",
    });
    expect(within(summary).getByText("Total Barangays")).toBeInTheDocument();
    expect(within(summary).getByText("Total Farmers")).toBeInTheDocument();
    expect(within(summary).getByText("Total Animals")).toBeInTheDocument();
    expect(
      within(summary).getByText("Pending Health Requests"),
    ).toBeInTheDocument();
    expect(within(summary).getByText("15")).toBeInTheDocument();
    expect(within(summary).getByText("42")).toBeInTheDocument();

    const table = screen.getByRole("table");
    expect(table).toHaveClass("table-pin-rows", "min-w-180");
    expect(table.parentElement).toHaveClass("overflow-x-auto");
    expect(within(table).getByText("Barangay")).toBeInTheDocument();
    expect(within(table).getByText("Farmers")).toBeInTheDocument();
    expect(within(table).getByText("Animals")).toBeInTheDocument();
    expect(within(table).getByText("Pending Health")).toBeInTheDocument();
    expect(within(table).getByText("Pending AI")).toBeInTheDocument();
    expect(screen.queryByText("Healthy")).not.toBeInTheDocument();
    expect(screen.queryByText("Critical")).not.toBeInTheDocument();
    expect(screen.queryByText("Needs attention")).not.toBeInTheDocument();
    expect(screen.queryByText(/activity score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/AI success/i)).not.toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(axiosInstance.get).toHaveBeenCalledTimes(1);
  });

  it("sorts every factual column in both directions", async () => {
    axiosInstance.get.mockResolvedValue({
      data: [canonicalInsight, secondInsight],
    });
    renderPage();

    await screen.findByText("Poblacion East");
    expect(tableBarangayNames()).toEqual(["Poblacion East", "Abilay Norte"]);

    const farmersSort = screen.getByRole("button", {
      name: "Sort by Farmers",
    });
    fireEvent.click(farmersSort);
    expect(tableBarangayNames()).toEqual(["Poblacion East", "Abilay Norte"]);
    expect(
      screen.getByRole("columnheader", { name: /Farmers/ }),
    ).toHaveAttribute("aria-sort", "descending");

    fireEvent.click(farmersSort);
    expect(tableBarangayNames()).toEqual(["Abilay Norte", "Poblacion East"]);
    expect(
      screen.getByRole("columnheader", { name: /Farmers/ }),
    ).toHaveAttribute("aria-sort", "ascending");

    fireEvent.click(screen.getByRole("button", { name: "Sort by Barangay" }));
    expect(tableBarangayNames()).toEqual(["Abilay Norte", "Poblacion East"]);

    for (const label of ["Animals", "Pending Health", "Pending AI"]) {
      const control = screen.getByRole("button", {
        name: `Sort by ${label}`,
      });
      fireEvent.click(control);
      expect(
        screen.getByRole("columnheader", { name: new RegExp(label) }),
      ).toHaveAttribute("aria-sort", "descending");
      fireEvent.click(control);
      expect(
        screen.getByRole("columnheader", { name: new RegExp(label) }),
      ).toHaveAttribute("aria-sort", "ascending");
    }
  });

  it("filters the visible table without changing summary totals or making N+1 requests", async () => {
    axiosInstance.get.mockResolvedValue({
      data: [canonicalInsight, secondInsight],
    });
    renderPage();

    await screen.findByText("Poblacion East");
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search barangays" }),
      {
        target: { value: "abilay" },
      },
    );

    expect(screen.queryByText("Poblacion East")).not.toBeInTheDocument();
    expect(screen.getByText("Abilay Norte")).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("region", { name: "Barangay summary" }),
      ).getByText("15"),
    ).toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenCalledTimes(1);
    expect(axiosInstance.get).toHaveBeenCalledWith("/admin/barangays/insights");

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search barangays" }),
      {
        target: { value: "missing" },
      },
    );
    expect(
      screen.getByText("No barangays match your search."),
    ).toBeInTheDocument();
  });

  it("preserves loading, empty, error, retry, and invalid-contract states", async () => {
    let resolveRequest;
    axiosInstance.get.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const loadingView = renderPage();
    expect(screen.getAllByLabelText("Loading barangay insights")).toHaveLength(
      6,
    );
    resolveRequest({ data: [] });
    await screen.findByText("No barangay records are available.");
    loadingView.unmount();

    axiosInstance.get.mockRejectedValue(new Error("network unavailable"));
    const errorView = renderPage();
    expect(
      await screen.findByText("Failed to load barangay insights."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    errorView.unmount();

    axiosInstance.get.mockResolvedValue({ data: { barangays: [] } });
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText("Failed to load barangay insights."),
      ).toBeInTheDocument(),
    );
  });
});
