import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "../../lib/axios";
import BarangayInsights from "./BarangayInsights";
import {
  formatBarangayMetric,
  formatBarangayPercentage,
  mapBarangayInsight,
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

describe("Barangay Insights backend contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps canonical fields, ignores fabricated aliases, and preserves zeroes", () => {
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
      aiSuccessRate: 75,
      activityScore: 68,
      status: "attention",
    });
    expect(mapped).not.toHaveProperty("technicians");
  });

  it("distinguishes missing data from zero and uses the backend 0–100 percentage unit", () => {
    expect(formatBarangayMetric(0)).toBe("0");
    expect(formatBarangayMetric(null)).toBe("Not available");
    expect(formatBarangayPercentage(0)).toBe("0%");
    expect(formatBarangayPercentage(75)).toBe("75%");
    expect(formatBarangayPercentage(null)).toBe("Not available");
  });

  it("renders canonical metrics and status without unsupported Technician coverage", async () => {
    axiosInstance.get.mockResolvedValue({
      data: [{ ...canonicalInsight, technicians: [{ _id: "unsupported" }] }],
    });
    renderPage();

    const card = await screen.findByRole("article", {
      name: "Poblacion East barangay insight",
    });
    expect(within(card).getByLabelText("Farmers: 12")).toBeInTheDocument();
    expect(within(card).getByLabelText("Animals: 34")).toBeInTheDocument();
    expect(
      within(card).getByLabelText("Pending health: 2"),
    ).toBeInTheDocument();
    expect(within(card).getByLabelText("AI success: 75%")).toBeInTheDocument();
    expect(within(card).getByText("Needs attention")).toBeInTheDocument();
    expect(within(card).queryByText(/technician/i)).not.toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenCalledTimes(1);
  });

  it("renders real zeroes, missing placeholders, and canonical status labels", async () => {
    axiosInstance.get.mockResolvedValue({
      data: [
        {
          ...canonicalInsight,
          barangay: "Zero Barangay",
          farmersCount: 0,
          animalsCount: 0,
          pendingHealthRequests: 0,
          aiSuccessRate: 0,
          status: "healthy",
        },
        {
          barangay: "Missing Barangay",
          municipality: "Oton",
          status: "critical",
        },
      ],
    });
    renderPage();

    const zeroCard = await screen.findByRole("article", {
      name: "Zero Barangay barangay insight",
    });
    expect(within(zeroCard).getByLabelText("Farmers: 0")).toBeInTheDocument();
    expect(within(zeroCard).getByLabelText("AI success: 0%")).toBeInTheDocument();
    expect(within(zeroCard).getByText("Healthy")).toBeInTheDocument();

    const missingCard = screen.getByRole("article", {
      name: "Missing Barangay barangay insight",
    });
    expect(
      within(missingCard).getByLabelText("Farmers: Not available"),
    ).toBeInTheDocument();
    expect(
      within(missingCard).getByLabelText("AI success: Not available"),
    ).toBeInTheDocument();
    expect(within(missingCard).getByText("Critical")).toBeInTheDocument();
  });

  it("keeps search client-side and does not introduce N+1 requests", async () => {
    axiosInstance.get.mockResolvedValue({
      data: [
        canonicalInsight,
        { ...canonicalInsight, barangay: "Abilay Norte" },
      ],
    });
    renderPage();

    await screen.findByRole("article", {
      name: "Poblacion East barangay insight",
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Search barangays" }), {
      target: { value: "abilay" },
    });

    expect(
      screen.queryByRole("article", {
        name: "Poblacion East barangay insight",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("article", { name: "Abilay Norte barangay insight" }),
    ).toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenCalledTimes(1);
    expect(axiosInstance.get).toHaveBeenCalledWith(
      "/admin/barangays/insights",
    );
  });

  it("preserves loading, empty, error, and invalid-contract states", async () => {
    let resolveRequest;
    axiosInstance.get.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const loadingView = renderPage();
    expect(
      screen.getAllByLabelText("Loading barangay insights"),
    ).toHaveLength(6);
    resolveRequest({ data: [] });
    await screen.findByText("No barangay records match this view.");
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
