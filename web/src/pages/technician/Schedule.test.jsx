import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import axiosInstance from "../../lib/axios";
import TechnicianSchedule from "./Schedule";
import { getPhilippineDateKey } from "../../utils/technicianSchedulePresentation";

vi.mock("../../lib/axios", () => ({
  default: { get: vi.fn() },
}));

vi.mock("@fullcalendar/react", () => ({
  default: ({ dateClick, events }) => (
    <div data-testid="fullcalendar-mock">
      {events?.map((ev) => (
        <button
          key={ev.id}
          type="button"
          data-testid={`calendar-event-${ev.start}`}
          onClick={() => dateClick?.({ dateStr: ev.start })}
        >
          {ev.title}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("@fullcalendar/daygrid", () => ({ default: {} }));
vi.mock("@fullcalendar/interaction", () => ({ default: {} }));

vi.mock("../../components/layout/Topbar", () => ({
  default: () => <header>Topbar</header>,
}));

vi.mock("../../components/layout/PageMeta", () => ({
  default: () => null,
}));

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="schedule-location">{location.pathname}{location.search}</output>;
};

const renderSchedule = (agendaItems = [], initialEntry = "/technician/schedule") => {
  axiosInstance.get.mockResolvedValue({
    data: { agendaItems },
  });

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <TechnicianSchedule />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("TechnicianSchedule temporal work handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens read-only work details for future Pregnancy Check on Schedule without navigating to My Work", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 18); // Future date
    const futureDateIso = futureDate.toISOString();
    const futureDateKey = getPhilippineDateKey(futureDate);

    const futurePregnancyTask = {
      id: "task-pd-1",
      taskId: "task-pd-1",
      type: "task",
      taskType: "PD",
      status: "Pending",
      dueDate: futureDateIso,
      displayDate: futureDateIso,
      farmer: "Farmer Juan",
      farmerName: "Farmer Juan",
      farmerPhone: "09123456789",
      animalTag: "TAG-777",
      animalBreed: "Brahman",
      location: "Brgy. Poblacion",
      raw: {
        _id: "task-pd-1",
        taskType: "PD",
        dueDate: futureDateIso,
        description: "Scheduled pregnancy diagnosis check",
        metadata: { sireBreed: "Angus" },
        farmerId: { name: "Farmer Juan", phoneNumber: "09123456789" },
      },
    };

    renderSchedule([futurePregnancyTask]);

    // Calendar displays the future date event; click it to inspect that day's scheduled work
    const dayEventButton = await screen.findByTestId(`calendar-event-${futureDateKey}`);
    fireEvent.click(dayEventButton);

    // Future Pregnancy Check appears under Selected Day Work with "Upcoming" badge
    expect(screen.getByText("Upcoming")).toBeTruthy();
    const viewButton = screen.getByRole("button", { name: /View Task/i });
    expect(viewButton).toBeTruthy();

    // Click View Task
    fireEvent.click(viewButton);

    // Read-only modal opens directly on Schedule
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog).toHaveTextContent(/Upcoming work details/i);
    expect(dialog).toHaveTextContent(/scheduled for a future date/i);
    expect(dialog).toHaveTextContent(/Farmer Juan/i);
    expect(dialog).toHaveTextContent(/TAG-777/i);

    // Location remains on /technician/schedule - no navigation to My Work (/technician/requests)
    const location = screen.getByTestId("schedule-location");
    expect(location.textContent).not.toContain("section=myWork");
    expect(location.textContent).not.toContain("/technician/requests");

    // Close modal
    const closeBtn = screen.getByRole("button", { name: /^Close$/i });
    fireEvent.click(closeBtn);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("navigates due today Pregnancy Check to canonical actionable workflow in My Work", async () => {
    const todayIso = new Date().toISOString();

    const duePregnancyTask = {
      id: "task-pd-due",
      taskId: "task-pd-due",
      type: "task",
      taskType: "PD",
      status: "Pending",
      dueDate: todayIso,
      displayDate: todayIso,
      farmer: "Farmer Due",
      farmerName: "Farmer Due",
      animalTag: "COW-100",
      raw: {
        _id: "task-pd-due",
        taskType: "PD",
        dueDate: todayIso,
      },
    };

    renderSchedule([duePregnancyTask]);

    const viewButton = await screen.findByRole("button", { name: /View Task/i });
    fireEvent.click(viewButton);

    // Navigates to My Work for actionable execution
    const location = screen.getByTestId("schedule-location");
    expect(location.textContent).toContain("/technician/requests");
    expect(location.textContent).toContain("section=myWork");
    expect(location.textContent).toContain("taskId=task-pd-due");
  });

  it("opens read-only preview for upcoming Calving work directly on Schedule", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const futureIso = futureDate.toISOString();
    const futureKey = getPhilippineDateKey(futureDate);

    const futureCalving = {
      id: "calving-task-1",
      taskId: "calving-task-1",
      type: "task",
      taskType: "CD",
      status: "Pending",
      dueDate: futureIso,
      displayDate: futureIso,
      farmer: "Calving Farmer",
      farmerName: "Calving Farmer",
      animalTag: "CALF-55",
      raw: {
        _id: "calving-task-1",
        taskType: "CD",
        dueDate: futureIso,
      },
    };

    renderSchedule([futureCalving]);

    const dayEventButton = await screen.findByTestId(`calendar-event-${futureKey}`);
    fireEvent.click(dayEventButton);

    const viewButton = screen.getByRole("button", { name: /View Task/i });
    fireEvent.click(viewButton);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog).toHaveTextContent(/Calving/i);
    expect(dialog).toHaveTextContent(/Calving Farmer/i);
    expect(dialog).toHaveTextContent(/scheduled for a future date/i);

    // Remained on Schedule
    const location = screen.getByTestId("schedule-location");
    expect(location.textContent).not.toContain("/technician/requests");
  });

  it("opens preview directly when deep-linked with previewTaskId query parameter", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const futureDateIso = futureDate.toISOString();

    const futureTask = {
      id: "task-direct-preview",
      taskId: "task-direct-preview",
      type: "task",
      taskType: "PD",
      status: "Pending",
      dueDate: futureDateIso,
      displayDate: futureDateIso,
      farmer: "Farmer Deep",
      farmerName: "Farmer Deep",
      animalTag: "TAG-999",
      raw: {
        _id: "task-direct-preview",
        taskType: "PD",
        dueDate: futureDateIso,
      },
    };

    renderSchedule([futureTask], "/technician/schedule?previewTaskId=task-direct-preview");

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog).toHaveTextContent(/Farmer Deep/i);
    expect(dialog).toHaveTextContent(/TAG-999/i);
    expect(dialog).toHaveTextContent(/scheduled for a future date/i);
  });
});
