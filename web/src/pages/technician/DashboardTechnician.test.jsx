import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "../../lib/axios";
import { getPhilippineTodayKey } from "../../utils/technicianSchedulePresentation";
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

    fireEvent.click(
      screen.getByRole("button", {
        name: /Record (?:AI|Insemination\s*)Service/i,
      }),
    );
    expect(
      screen.getByText(
        /Existing records only · Record AI Now · Add Past Record/,
      ),
    ).toBeTruthy();
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

  it("shows overdue unresolved work and keeps Pregnancy Loss Review distinct", async () => {
    renderDashboard({
      stats: {}, pendingRequests: [],
      agendaItems: [{
        id: "loss-overdue", taskId: "loss-overdue", type: "task",
        taskType: "BreedingFollowUp", sourceType: "farmer_pregnancy_loss_report",
        status: "Pending", dueDate: "2020-09-19T00:00:00.000Z",
      }],
    });
    expect(await screen.findByText("Pregnancy Loss Review")).toBeTruthy();
    expect(screen.getByText("Needs review")).toBeTruthy();
    expect(screen.getByText("Farmer reported pregnancy loss")).toBeTruthy();
    expect(screen.queryByText("Task")).toBeNull();
    expect(screen.queryByText(/Planned:/)).toBeNull();
    expect(screen.queryByText("No work due today")).toBeNull();
  });

  it("uses work-type icons rather than completion or decorative status icons", async () => {
    const today = getPhilippineTodayKey();
    renderDashboard({
      stats: {},
      pendingRequests: [],
      agendaItems: [
        {
          id: "follow-up",
          taskId: "follow-up",
          type: "task",
          taskType: "BreedingFollowUp",
          status: "Pending",
          dueDate: today,
          scheduleLabel: "Breeding Follow-up",
        },
        {
          id: "pregnancy-check",
          taskId: "pregnancy-check",
          type: "task",
          taskType: "PD",
          status: "Pending",
          dueDate: today,
          scheduleLabel: "Pregnancy Check",
        },
        {
          id: "pregnancy-loss",
          taskId: "pregnancy-loss",
          type: "task",
          taskType: "BreedingFollowUp",
          sourceType: "farmer_pregnancy_loss_report",
          status: "Pending",
          dueDate: today,
          scheduleLabel: "Pregnancy Loss Review",
        },
        {
          id: "expected-calving",
          taskId: "expected-calving",
          type: "task",
          taskType: "Calving",
          status: "Pending",
          dueDate: today,
          scheduleLabel: "Expected Calving",
        },
      ],
    });

    await screen.findByText("Pregnancy Loss Review");
    const cards = document.querySelectorAll("article");
    const cardFor = (title) =>
      Array.from(cards).find((card) => card.textContent.includes(title));

    expect(cardFor("Breeding Follow-up")?.querySelector(".lucide-calendar-check")).toBeTruthy();
    expect(cardFor("Pregnancy Check")?.querySelector(".lucide-heart-pulse")).toBeTruthy();
    expect(cardFor("Pregnancy Check")?.querySelector(".lucide-circle-check")).toBeNull();
    expect(cardFor("Pregnancy Loss Review")?.querySelector(".lucide-heart-crack")).toBeTruthy();
    expect(cardFor("Expected Calving")?.querySelector(".lucide-baby")).toBeTruthy();
    expect(cardFor("Expected Calving")?.querySelector(".lucide-sparkles")).toBeNull();
  });

  it("renders in-progress AI Today's Work card with canonical status, service title, planned schedule, and farmer home address instead of farm GPS location", async () => {
    renderDashboard({
      stats: { urgentHealth: 0, completedToday: 0 },
      pendingRequests: [],
      agendaItems: [
        {
          id: "in-progress-ai-03mc",
          type: "insemination",
          status: "in-progress",
          scheduledDate: "2026-09-12T00:00:00.000Z",
          visitPeriod: "afternoon",
          farmer: "Mario Cabanig",
          animalTag: "03MC",
          location: "Bita Sur, Oton",
          farmLocationLabel:
            "PHF6+GGQ, Doña Luz, Jaro, Iloilo City, Philippines",
          raw: {
            farmerId: {
              name: "Mario Cabanig",
              address: {
                barangay: "Bita Sur",
                municipality: "Oton",
              },
              farmLocation: {
                detectedAddress:
                  "PHF6+GGQ, Doña Luz, Jaro, Iloilo City, Philippines",
              },
            },
          },
        },
      ],
    });

    expect(await screen.findByText("In Progress")).toBeTruthy();
    expect(screen.getByText("Artificial Insemination")).toBeTruthy();
    expect(screen.getByText("#03MC")).toBeTruthy();
    expect(screen.getByText("Mario Cabanig")).toBeTruthy();
    expect(screen.getByText("Bita Sur, Oton")).toBeTruthy();
    expect(
      screen.queryByText(/PHF6\+GGQ, Doña Luz, Jaro, Iloilo City/),
    ).toBeNull();
    expect(screen.getByText("Planned: Sep 12, 2026 · Afternoon")).toBeTruthy();
    expect(screen.getByRole("link", { name: /View Work/i })).toBeTruthy();
    expect(screen.queryByText("Scheduled AI Visit")).toBeNull();
  });
});
