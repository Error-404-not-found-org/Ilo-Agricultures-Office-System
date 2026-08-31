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

vi.mock("../../components/dialogs/RequestActionModal", () => ({
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
  default: ({ isOpen, taskId }) =>
    isOpen ? <div role="dialog" aria-label={`Calving ${taskId}`} /> : null,
}));

import WorkQueue from "./WorkQueue";

const ids = {
  health: "507f1f77bcf86cd799439011",
  healthTask: "507f1f77bcf86cd799439012",
  ai: "507f1f77bcf86cd799439021",
  aiTask: "507f1f77bcf86cd799439022",
  pregnancyTask: "507f1f77bcf86cd799439031",
  calvingTask: "507f1f77bcf86cd799439041",
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

const renderQueue = (tasks) => {
  mocks.get.mockResolvedValue({ data: { data: tasks } });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WorkQueue />
      </MemoryRouter>
    </QueryClientProvider>,
  );
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
        actionLabel: "Record Service",
        raw: { _id: ids.health, status: "in-progress" },
      },
    ]);

    fireEvent.click(
      await screen.findByRole("button", { name: "Record Health" }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Owned Health request",
    });
    expect(dialog.getAttribute("data-request-id")).toBe(ids.health);
    expect(dialog.getAttribute("data-workflow-id")).toBe(ids.health);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("starts Health against the canonical singular request route", async () => {
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
        actionLabel: "Start Service",
        raw: { _id: ids.health, status: "scheduled" },
      },
    ]);

    fireEvent.click(
      await screen.findByRole("button", { name: "Start Service" }),
    );

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith(
        `/health-request/${ids.health}/status`,
        { status: "in-progress" },
      ),
    );
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
        actionLabel: "Record Diagnosis",
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
        raw: { _id: ids.calvingTask, taskType: "Calving" },
      },
    ]);

    fireEvent.click(await screen.findByRole("button", { name: "Record AI" }));
    expect(screen.getByRole("dialog", { name: `AI ${ids.ai}` })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Record Diagnosis" }));
    expect(
      screen.getByRole("dialog", { name: `Pregnancy ${ids.pregnancyTask}` }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Record Calving" }));
    expect(
      screen.getByRole("dialog", { name: `Calving ${ids.calvingTask}` }),
    ).toBeTruthy();
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
