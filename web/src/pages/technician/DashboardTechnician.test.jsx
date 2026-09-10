import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "../../lib/axios";
import Dashboard from "./DashboardTechnician";

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

vi.mock("../../components/dialogs/AIServiceModal", () => ({
  default: ({ isOpen, existingOnly }) =>
    isOpen ? (
      <div role="dialog">
        {existingOnly ? "Existing records only" : "Registration allowed"} · Record AI Now · Add Past Record
      </div>
    ) : null,
}));
vi.mock("../../components/dialogs/WalkInHealthModal", () => ({
  default: ({ isOpen }) =>
    isOpen ? <div role="dialog">Walk-in Health</div> : null,
}));
vi.mock("../../components/dialogs/RegisterFarmerModal", () => ({
  default: ({ isOpen }) =>
    isOpen ? <div role="dialog">Register Farmer form</div> : null,
}));
vi.mock("../../components/dialogs/RegisterLivestockModal", () => ({
  default: ({ isOpen }) =>
    isOpen ? <div role="dialog">Register Animal form</div> : null,
}));

const dashboardResponse = {
  stats: {
    urgentHealth: 2,
    completedToday: 3,
    aiCompletedToday: 3,
    totalInsemMonth: 12,
    successRate: "75.0%",
  },
  pendingRequests: [{ id: "eligible-request", type: "health" }],
  agendaItems: [
    {
      id: "today-health",
      type: "health",
      status: "scheduled",
      handlingMethod: "farm_visit",
      scheduledDate: getPhilippineTodayKey(),
      visitPeriod: "morning",
      farmer: "Farmer One",
      animalTag: "COW-1",
    },
  ],
};

function renderDashboard(response = dashboardResponse) {
  axiosInstance.get.mockImplementation(async (url) => {
    if (url === "/technician/profile") {
      return {
        data: {
          name: "Tech One",
          phoneNumber: "09170000000",
          address: { barangay: "Poblacion" },
        },
      };
    }
    return { data: response };
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Technician Dashboard current-work hierarchy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows authoritative overview and canonical today's work without duplicating Requests", async () => {
    renderDashboard();

    expect(await screen.findByText("Scheduled Health Farm Visit")).toBeTruthy();
    expect(screen.getByText("Inseminated Today")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("Monthly Inseminations")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("Success Rate")).toBeTruthy();
    expect(screen.getByText("75.0%")).toBeTruthy();
    expect(screen.getByText("Scheduled Health Farm Visit")).toBeTruthy();
    expect(screen.getByText("Morning")).toBeTruthy();
    expect(screen.queryByText("Farmer Requests")).toBeNull();
    expect(
      screen.getByRole("link", { name: /View Schedule/i }),
    ).toHaveAttribute("href", "/technician/schedule");
  });

  it("uses the shared two-mode AI service modal for genuine direct and registration actions", async () => {
    renderDashboard();
    await screen.findByText("Quick Actions");

    fireEvent.click(screen.getByRole("button", { name: /Record AI Service/i }));
    expect(screen.getByText(/Existing records only · Record AI Now · Add Past Record/)).toBeTruthy();
    expect(screen.queryByText("Direct or walk-in service")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /Record Health Assistance/i }),
    );
    expect(screen.getByText("Walk-in Health")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pregnancy Check" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Record Calving" })).toBeNull();
  });

  it("shows a useful empty state when no date-bound work is due today", async () => {
    renderDashboard({
      stats: { urgentHealth: 0, completedToday: 0 },
      pendingRequests: [],
      agendaItems: [],
    });

    expect(await screen.findByText("No work due today")).toBeTruthy();
    expect(
      screen.getByText("Future and overdue work remain available in Schedule."),
    ).toBeTruthy();
  });
});
