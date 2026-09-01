import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../../lib/axios", () => ({
  default: {
    get: mocks.get,
    patch: mocks.patch,
    post: mocks.post,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.success,
    error: mocks.error,
    info: vi.fn(),
  },
}));

vi.mock("../../components/layout/Topbar", () => ({
  default: ({ title }) => <h1>{title}</h1>,
}));

vi.mock("../../components/dialogs/HealthRequestActionModal", () => ({
  default: ({ isOpen, task }) =>
    isOpen ? (
      <div
        role="dialog"
        aria-label="Owned Health request"
        data-request-id={task?.id}
        data-workflow-id={task?.workflowId}
      />
    ) : null,
}));

vi.mock("../../components/dialogs/AIServiceModal", () => ({
  default: ({ isOpen, workflowId }) =>
    isOpen ? <div role="dialog" aria-label={`AI ${workflowId}`} /> : null,
}));

vi.mock("../../components/dialogs/PregnancyDiagnosisModal", () => ({
  default: ({ isOpen, taskId }) =>
    isOpen ? <div role="dialog" aria-label={`Pregnancy ${taskId}`} /> : null,
}));

vi.mock("../../components/dialogs/RecordCalvingModal", () => ({
  default: ({ isOpen, taskId, pregnancyData }) =>
    isOpen ? (
      <div
        role="dialog"
        aria-label={`Calving ${taskId}`}
        data-pregnancy-id={pregnancyData?._id}
      />
    ) : null,
}));

import WorkQueue from "./WorkQueue";

const ids = {
  health: "507f1f77bcf86cd799439011",
  healthTask: "507f1f77bcf86cd799439012",
  ai: "507f1f77bcf86cd799439021",
  aiTask: "507f1f77bcf86cd799439022",
  pregnancyTask: "507f1f77bcf86cd799439031",
  calvingTask: "507f1f77bcf86cd799439041",
  followUpTask: "507f1f77bcf86cd799439061",
  farmer: "507f1f77bcf86cd799439071",
  animal: "507f1f77bcf86cd799439081",
};

const baseTask = {
  status: "in-progress",
  displayStatus: "in-progress",
  displayDate: "2026-08-31T04:00:00.000Z",
  farmerName: "Test Farmer",
  animalTag: "TEST-1",
  farmer: { name: "Test Farmer" },
  animal: { name: "Test Animal", earTag: "TEST-1" },
  schedule: { date: "2026-08-31", visitPeriod: "afternoon" },
};

const renderWorkQueue = (initialEntry = "/technician/requests?section=myWork") => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <WorkQueue />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const renderQueue = (tasks, { taskDetailsById = {} } = {}) => {
  mocks.get.mockImplementation((url) => {
    if (url.startsWith("/tasks/")) {
      const taskId = decodeURIComponent(url.slice("/tasks/".length));
      return Promise.resolve({ data: taskDetailsById[taskId] || null });
    }

    return Promise.resolve({
      data: {
        data: tasks,
        pagination: {
          page: 1,
          limit: 8,
          total: tasks.length,
          totalPages: 1,
        },
        counts: {
          all: tasks.length,
          ai: 0,
          health: 0,
          pregnancy: 0,
          calving: 0,
        },
      },
    });
  });
  renderWorkQueue();
};

describe("Work Queue owned Health workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.patch.mockResolvedValue({ data: {} });
  });

  it("opens request-linked Health recording without creating a walk-in", async () => {
    renderQueue([
      {
        ...baseTask,
        id: ids.health,
        workflowId: ids.health,
        taskId: ids.healthTask,
        workflowType: "Health",
        type: "health",
        taskType: "Health",
        serviceType: "Health Assistance",
        allowedAction: "RECORD_SERVICE",
        actionLabel: "Complete Visit",
        raw: { _id: ids.health, status: "in-progress" },
      },
    ]);

    fireEvent.click(
      await screen.findByRole("button", { name: "Complete Visit" }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Owned Health request",
    });
    expect(dialog.getAttribute("data-request-id")).toBe(ids.health);
    expect(dialog.getAttribute("data-workflow-id")).toBe(ids.health);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("opens scheduled Health through the same request-linked action system", async () => {
    renderQueue([
      {
        ...baseTask,
        id: ids.health,
        workflowId: ids.health,
        workflowType: "Health",
        type: "health",
        taskType: "Health",
        status: "scheduled",
        displayStatus: "scheduled",
        serviceType: "Health Assistance",
        allowedAction: "START_SERVICE",
        actionLabel: "Start Visit",
        raw: { _id: ids.health, status: "scheduled" },
      },
    ]);

    fireEvent.click(
      await screen.findByRole("button", { name: "Start Visit" }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Owned Health request",
    });
    expect(dialog.getAttribute("data-request-id")).toBe(ids.health);
    expect(dialog.getAttribute("data-workflow-id")).toBe(ids.health);
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("preserves the existing AI, Pregnancy, and Calving record actions", async () => {
    renderQueue([
      {
        ...baseTask,
        id: ids.ai,
        workflowId: ids.ai,
        taskId: ids.aiTask,
        workflowType: "AI",
        type: "insemination",
        taskType: "AI",
        serviceType: "AI",
        allowedAction: "RECORD_SERVICE",
        actionLabel: "Record AI",
        raw: { _id: ids.ai, status: "in-progress" },
      },
      {
        ...baseTask,
        id: ids.pregnancyTask,
        workflowId: null,
        taskId: ids.pregnancyTask,
        workflowType: "PD",
        type: "pregnancy",
        taskType: "PD",
        serviceType: "Pregnancy",
        allowedAction: "RECORD_SERVICE",
        actionLabel: "Record Pregnancy Check",
        raw: { _id: ids.pregnancyTask, taskType: "PD" },
      },
      {
        ...baseTask,
        id: ids.calvingTask,
        workflowId: null,
        taskId: ids.calvingTask,
        workflowType: "Calving",
        type: "calving",
        taskType: "Calving",
        serviceType: "Calving",
        allowedAction: "RECORD_SERVICE",
        actionLabel: "Record Calving",
        context: { pregnancyId: "507f1f77bcf86cd799439051" },
        raw: { _id: ids.calvingTask, taskType: "Calving" },
      },
    ]);

    fireEvent.click(await screen.findByRole("button", { name: "Record AI" }));
    expect(screen.getByRole("dialog", { name: `AI ${ids.ai}` })).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Record Pregnancy Check" }),
    );
    expect(
      screen.getByRole("dialog", { name: `Pregnancy ${ids.pregnancyTask}` }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Record Calving" }));
    expect(
      screen.getByRole("dialog", { name: `Calving ${ids.calvingTask}` }),
    ).toBeTruthy();
    expect(
      screen.getByRole("dialog", { name: `Calving ${ids.calvingTask}` }),
    ).toHaveAttribute("data-pregnancy-id", "507f1f77bcf86cd799439051");
  });

  it("loads canonical breeding and farmer details before recording follow-up", async () => {
    renderQueue(
      [
        {
          ...baseTask,
          id: ids.followUpTask,
          taskId: ids.followUpTask,
          workflowType: "BreedingFollowUp",
          type: "task",
          taskType: "BreedingFollowUp",
          serviceType: "Breeding Follow-up",
          allowedAction: "RECORD_BREEDING_OBSERVATION",
          actionLabel: "Record Follow-up",
          context: { inseminationId: ids.ai },
          raw: { _id: ids.followUpTask, taskType: "BreedingFollowUp" },
        },
      ],
      {
        taskDetailsById: {
          [ids.followUpTask]: {
            _id: ids.followUpTask,
            farmerId: {
              _id: ids.farmer,
              name: "Dong Pongase",
              imageUrl: "https://images.example/dong-pongase.jpg",
              phoneNumber: "09171234567",
            },
            animalIds: [
              {
                _id: ids.animal,
                name: "02DP",
                earTag: "02DP",
                species: "Cattle",
                breed: "Native",
              },
            ],
            insemination: {
              _id: ids.ai,
              inseminationDate: "2024-08-25T04:00:00.000Z",
              attemptNumber: 1,
              sireCode: "44-12",
              sireBreed: "Brahman",
            },
          },
        },
      },
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Record Follow-up" }),
    );

    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith(`/tasks/${ids.followUpTask}`),
    );
    expect(await screen.findByText(/August 25, 2024/)).toBeTruthy();
    expect(screen.getByText("#1")).toBeTruthy();
    expect(screen.getByText("44-12")).toBeTruthy();
    expect(screen.getByText("Dong Pongase")).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "Dong Pongase profile" }),
    ).toHaveAttribute("src", "https://images.example/dong-pongase.jpg");

    fireEvent.click(
      screen.getAllByRole("button", { name: "Record Follow-up" })[1],
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit Follow-up" }));

    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        `/ai-request/${ids.ai}/technician-observation`,
        { reportType: "possible_pregnancy", notes: "" },
      ),
    );
  });

  it("uses sire breed only when the canonical sire code is unavailable", async () => {
    renderQueue(
      [
        {
          ...baseTask,
          id: ids.followUpTask,
          taskId: ids.followUpTask,
          workflowType: "BreedingFollowUp",
          type: "task",
          taskType: "BreedingFollowUp",
          serviceType: "Breeding Follow-up",
          allowedAction: "RECORD_BREEDING_OBSERVATION",
          actionLabel: "Record Follow-up",
          context: { inseminationId: ids.ai },
          raw: { _id: ids.followUpTask, taskType: "BreedingFollowUp" },
        },
      ],
      {
        taskDetailsById: {
          [ids.followUpTask]: {
            farmerId: { _id: ids.farmer, name: "Dong Pongase" },
            animalIds: [{ _id: ids.animal, earTag: "02DP" }],
            insemination: {
              _id: ids.ai,
              inseminationDate: "2024-08-25T04:00:00.000Z",
              attemptNumber: 1,
              sireCode: "",
              sireBreed: "Brahman",
            },
          },
        },
      },
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Record Follow-up" }),
    );

    expect(await screen.findByText("Brahman")).toBeTruthy();
  });

  it("keeps the genuine quick-action walk-in endpoint intact", () => {
    const walkInSource = readFileSync(
      resolve("src/components/dialogs/WalkInHealthModal.jsx"),
      "utf8",
    );
    const dashboardSource = readFileSync(
      resolve("src/pages/technician/DashboardTechnician.jsx"),
      "utf8",
    );

    expect(walkInSource).toContain(
      'axiosInstance.post("/health-request/walk-in", data)',
    );
    expect(dashboardSource).toContain("<WalkInHealthModal");
    expect(dashboardSource).toContain("existingOnly");
  });
});

describe("My Work canonical server data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.patch.mockResolvedValue({ data: {} });
    mocks.get.mockImplementation((_url, config = {}) => {
      const params = config.params || {};
      const page = params.page || 1;
      return Promise.resolve({
        data: {
          data: [
            {
              ...baseTask,
              id: `server-task-${page}`,
              workflowId: null,
              taskId: `server-task-${page}`,
              workflowType: "StandaloneTask",
              type: "task",
              taskType: "GeneralVisit",
              serviceType: "General Visit",
              allowedAction: null,
              actionLabel: null,
              raw: { _id: `server-task-${page}` },
            },
          ],
          pagination: { page, limit: 8, total: 24, totalPages: 3 },
          counts: { all: 24, ai: 7, health: 8, pregnancy: 5, calving: 4 },
        },
      });
    });
  });

  it("uses backend pagination and totals, including the completed state", async () => {
    renderWorkQueue();

    expect(await screen.findByRole("heading", { name: "My Work" })).toBeTruthy();
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith("/technician/work-queue", {
        params: {
          page: 1,
          limit: 8,
          workState: "active",
          type: "all",
        },
      }),
    );
    expect(screen.queryByText("Active owned work: 24")).toBeNull();
    expect(screen.getByText("Showing 1–1 of 24")).toBeTruthy();
    expect(screen.getByText("Page 1 of 3")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(mocks.get).toHaveBeenLastCalledWith("/technician/work-queue", {
        params: {
          page: 2,
          limit: 8,
          workState: "active",
          type: "all",
        },
      }),
    );
    expect(await screen.findByText("Page 2 of 3")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Completed" }));
    await waitFor(() =>
      expect(mocks.get).toHaveBeenLastCalledWith("/technician/work-queue", {
        params: {
          page: 1,
          limit: 8,
          workState: "completed",
          type: "all",
        },
      }),
    );
    expect(screen.queryByText("Completed owned work: 24")).toBeNull();
  });

  it("loads completed My Work directly from the canonical URL state", async () => {
    renderWorkQueue(
      "/technician/requests?section=myWork&workState=completed",
    );

    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith("/technician/work-queue", {
        params: {
          page: 1,
          limit: 8,
          workState: "completed",
          type: "all",
        },
      }),
    );
    expect(screen.queryByText("Completed owned work: 24")).toBeNull();
  });

  it("sends service type and search to the backend and resets to page one", async () => {
    renderWorkQueue();
    await screen.findByText("Page 1 of 3");

    fireEvent.change(screen.getByLabelText("Service type"), {
      target: { value: "health" },
    });
    await waitFor(() =>
      expect(mocks.get).toHaveBeenLastCalledWith("/technician/work-queue", {
        params: {
          page: 1,
          limit: 8,
          workState: "active",
          type: "health",
        },
      }),
    );

    fireEvent.change(screen.getByLabelText("Search My Work"), {
      target: { value: "Maria" },
    });
    await waitFor(() =>
      expect(mocks.get).toHaveBeenLastCalledWith("/technician/work-queue", {
        params: {
          page: 1,
          limit: 8,
          workState: "active",
          type: "health",
          search: "Maria",
        },
      }),
    );
  });
});
