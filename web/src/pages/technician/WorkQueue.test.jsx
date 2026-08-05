import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock("../../lib/axios", () => ({
  default: {
    get: mocks.get,
    patch: mocks.patch,
    put: mocks.put,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    info: mocks.toastInfo,
  },
}));

vi.mock("../../components/layout/Topbar", () => ({
  default: ({ title }) => <div>{title}</div>,
}));

vi.mock("../../components/dialogs/AIServiceModal", () => ({
  default: ({ isOpen, workflowId, taskId, requestContext }) =>
    isOpen ? (
      <div
        data-testid="ai-service-modal"
        data-workflow-id={workflowId}
        data-task-id={taskId || ""}
      >
        {requestContext?.farmer?.name} · {requestContext?.animal?.earTag}
      </div>
    ) : null,
}));

vi.mock("../../components/dialogs/WalkInHealthModal", () => ({
  default: ({ isOpen }) =>
    isOpen ? <div data-testid="health-modal">Health modal</div> : null,
}));

vi.mock("../../components/dialogs/PregnancyDiagnosisModal", () => ({
  default: ({ isOpen }) =>
    isOpen ? <div data-testid="pd-modal">PD modal</div> : null,
}));

vi.mock("../../components/dialogs/RecordCalvingModal", () => ({
  default: ({ isOpen }) =>
    isOpen ? <div data-testid="calving-modal">Calving modal</div> : null,
}));

vi.mock("../../components/ui/Modal", () => ({
  default: ({ isOpen, title, subtitle, children }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <p>{subtitle}</p>
        {children}
      </div>
    ) : null,
}));

import WorkQueue from "./WorkQueue";

const workflowId = "507f1f77bcf86cd799439001";
const taskId = "507f1f77bcf86cd799439099";
const farmerId = "507f1f77bcf86cd799439010";
const animalId = "507f1f77bcf86cd799439020";

const aiItem = (overrides = {}) => ({
  id: workflowId,
  workflowId,
  taskId,
  workflowType: "AI",
  serviceType: "Artificial Insemination",
  status: "scheduled",
  allowedAction: "RECORD_SERVICE",
  actionLabel: "Record Insemination",
  farmer: {
    id: farmerId,
    name: "Maria Santos",
    phone: "09171234567",
    location: "San Roque, Oton",
  },
  animal: { id: animalId, name: "Bessie", earTag: "EAR-17" },
  schedule: {
    date: "2026-08-08T04:00:00.000Z",
    visitPeriod: "morning",
  },
  requestedAt: "2026-08-04T01:00:00.000Z",
  completedAt: null,
  displayDate: "2026-08-08T04:00:00.000Z",
  displayStatus: "scheduled",
  farmerName: "Maria Santos",
  animalTag: "EAR-17",
  location: "San Roque, Oton",
  type: "insemination",
  taskType: "AI",
  raw: {
    _id: workflowId,
    farmerId: { _id: farmerId, name: "Maria Santos" },
    animalId: { _id: animalId, name: "Bessie", earTag: "EAR-17" },
    heatSigns: ["Standing heat"],
  },
  ...overrides,
});

const renderQueue = (items) => {
  mocks.get.mockImplementation(() =>
    Promise.resolve({ data: { data: items } }),
  );
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <WorkQueue />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return queryClient;
};

describe("Technician My Work AI actions", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it.each(["scheduled", "in-progress"])(
    "%s AI uses the backend Record Insemination action without Start Service",
    async (status) => {
      renderQueue([
        aiItem({ status, displayStatus: status, taskId: status === "scheduled" ? taskId : null }),
      ]);

      const action = await screen.findByRole("button", {
        name: "Record Insemination",
      });
      expect(
        screen.queryByRole("button", { name: "Start Service" }),
      ).not.toBeInTheDocument();
      expect(screen.getByText("August 8, 2026 · Morning")).toBeInTheDocument();

      fireEvent.click(action);

      const modal = screen.getByTestId("ai-service-modal");
      expect(modal).toHaveAttribute("data-workflow-id", workflowId);
      expect(modal).toHaveAttribute(
        "data-task-id",
        status === "scheduled" ? taskId : "",
      );
      expect(modal).toHaveTextContent("Maria Santos · EAR-17");
      expect(mocks.patch).not.toHaveBeenCalled();
      expect(mocks.put).not.toHaveBeenCalled();
      expect(mocks.toastSuccess).not.toHaveBeenCalledWith("Service started");
    },
  );

  it("opens completed AI as a view-only record without mutation", async () => {
    renderQueue([
      aiItem({
        status: "done",
        displayStatus: "done",
        allowedAction: "VIEW_RECORD",
        actionLabel: "View Record",
        completedAt: "2026-08-08T08:00:00.000Z",
        raw: { sireBreed: "Holstein", sireCode: "H-42" },
      }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Completed" }));
    const view = await screen.findByRole("button", { name: "View Record" });
    fireEvent.click(view);

    expect(
      screen.getByRole("dialog", { name: "Insemination record" }),
    ).toHaveTextContent("Completed AI service summary");
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("does not mutate for unknown actions or legacy AI START_SERVICE", async () => {
    renderQueue([
      aiItem({
        id: "507f1f77bcf86cd799439002",
        workflowId: "507f1f77bcf86cd799439002",
        allowedAction: "UNKNOWN_ACTION",
        actionLabel: "Unknown action",
      }),
      aiItem({
        id: "507f1f77bcf86cd799439003",
        workflowId: "507f1f77bcf86cd799439003",
        allowedAction: "START_SERVICE",
        actionLabel: "Start Service",
      }),
    ]);

    fireEvent.click(
      await screen.findByRole("button", { name: "Unknown action" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Start Service" }));

    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalled();
  });

  it("completes only a standalone Task with a valid taskId", async () => {
    mocks.put.mockResolvedValue({ data: {} });
    renderQueue([
      {
        ...aiItem(),
        id: taskId,
        workflowId: null,
        taskId,
        workflowType: "StandaloneTask",
        type: "task",
        taskType: "Other",
        serviceType: "Farm inspection",
        allowedAction: "COMPLETE_TASK",
        actionLabel: "Complete Task",
      },
    ]);

    fireEvent.click(await screen.findByRole("button", { name: "Complete" }));
    await waitFor(() =>
      expect(mocks.put).toHaveBeenCalledWith(`/tasks/${taskId}/complete`, {}),
    );
    expect(mocks.put.mock.calls[0][0]).not.toContain(workflowId);
  });

  it("blocks COMPLETE_TASK when taskId is missing", async () => {
    renderQueue([
      {
        ...aiItem(),
        id: "malformed-visible-id",
        workflowId: null,
        taskId: null,
        workflowType: "StandaloneTask",
        type: "task",
        taskType: "Other",
        allowedAction: "COMPLETE_TASK",
        actionLabel: "Complete Task",
      },
    ]);

    fireEvent.click(await screen.findByRole("button", { name: "Complete" }));
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "This standalone task has an invalid task identifier.",
    );
  });

  it.each([
    ["Health", "Record Health", "health-modal"],
    ["PD", "Record Diagnosis", "pd-modal"],
    ["Calving", "Record Calving", "calving-modal"],
  ])("preserves the %s recording modal", async (workflowType, label, testId) => {
    renderQueue([
      {
        ...aiItem(),
        workflowType,
        type: workflowType === "Health" ? "health" : "task",
        taskType: workflowType === "Calving" ? "CD" : workflowType,
        allowedAction: "RECORD_SERVICE",
        actionLabel: label,
      },
    ]);

    fireEvent.click(await screen.findByRole("button", { name: label }));
    expect(screen.getByTestId(testId)).toBeInTheDocument();
    expect(screen.queryByTestId("ai-service-modal")).not.toBeInTheDocument();
  });
});
