import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
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
  default: ({ isOpen, task, onClose }) =>
    isOpen ? (
      <div
        role="dialog"
        aria-label="Owned Health request"
        data-request-id={task?.id}
        data-workflow-id={task?.workflowId}
      >
        <button type="button" onClick={onClose}>Close Health</button>
      </div>
    ) : null,
}));

vi.mock("../../components/dialogs/AIServiceModal", () => ({
  default: ({ isOpen, workflowId, onClose, onSuccess }) =>
    isOpen ? <div role="dialog" aria-label={`AI ${workflowId}`}><button type="button" onClick={onClose}>Close AI</button><button type="button" onClick={onSuccess}>Complete AI</button></div> : null,
}));

vi.mock("../../components/dialogs/PregnancyDiagnosisModal", () => ({
  default: ({ isOpen, taskId, onClose }) =>
    isOpen ? <div role="dialog" aria-label={`Pregnancy ${taskId}`}><button type="button" onClick={onClose}>Close Pregnancy</button></div> : null,
}));

vi.mock("../../components/dialogs/RecordCalvingModal", () => ({
  default: ({ isOpen, taskId, pregnancyData, onClose }) =>
    isOpen ? (
      <div
        role="dialog"
        aria-label={`Calving ${taskId}`}
        data-pregnancy-id={pregnancyData?._id}
      >
        <button type="button" onClick={onClose}>Close Calving</button>
      </div>
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
        <LocationProbe />
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

const LocationProbe = () => {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="technician-location">{location.pathname}{location.search}</output><button type="button" onClick={() => navigate(`/technician/requests?section=myWork&taskId=${ids.pregnancyTask}`)}>Open next deep link</button></>;
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

  it("routes completed AI View Record to the canonical official record detail", async () => {
    renderQueue([
      {
        ...baseTask,
        id: ids.ai,
        workflowId: ids.ai,
        workflowType: "AI",
        type: "insemination",
        taskType: "AI",
        serviceType: "Artificial Insemination",
        allowedAction: "VIEW_RECORD",
        actionLabel: "View Record",
        animal: { id: ids.animal, name: "Test Animal", earTag: "TEST-1" },
        raw: { _id: ids.ai, status: "done" },
      },
    ]);

    fireEvent.click(await screen.findByRole("button", { name: "View Record" }));

    await waitFor(() =>
      expect(screen.getByTestId("technician-location")).toHaveTextContent(
        "/technician/records?animalId=" +
          ids.animal +
          "&recordKind=insemination&recordId=" +
          ids.ai,
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

describe("My Work Schedule deep links", () => {
  const empty = {
    data: [],
    pagination: { page: 1, limit: 8, total: 0, totalPages: 1 },
    counts: { all: 0, ai: 0, health: 0, pregnancy: 0, calving: 0 },
  };

  const renderDeepLink = ({ parameter, id, target }) => {
    mocks.get.mockImplementation((_url, config) =>
      Promise.resolve({
        data: config?.params?.[parameter] === id
          ? { ...empty, data: target ? [target] : [], pagination: { ...empty.pagination, total: target ? 1 : 0 } }
          : empty,
      }),
    );
    renderWorkQueue(`/technician/requests?section=myWork&${parameter}=${id}`);
  };

  const futureTask = (overrides = {}) => ({
    ...baseTask,
    schedule: { date: "2099-10-11", visitPeriod: null },
    timing: { kind: "due", date: "2099-10-11", visitPeriod: null },
    location: "Poblacion, Oton",
    ...overrides,
  });

  const dueTodayKey = () =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

  it.each([
    ["AI", "requestId", ids.ai, { ...baseTask, id: ids.ai, workflowId: ids.ai, taskId: ids.aiTask, workflowType: "AI", type: "insemination", allowedAction: "RECORD_SERVICE", raw: { _id: ids.ai } }],
    ["Health", "requestId", ids.health, { ...baseTask, id: ids.health, workflowId: ids.health, taskId: ids.healthTask, workflowType: "Health", type: "health", allowedAction: "RECORD_SERVICE", raw: { _id: ids.health } }],
    ["Pregnancy", "taskId", ids.pregnancyTask, { ...baseTask, id: ids.pregnancyTask, taskId: ids.pregnancyTask, workflowType: "PD", type: "task", allowedAction: "RECORD_SERVICE", raw: { _id: ids.pregnancyTask, taskType: "PD" } }],
    ["Calving", "taskId", ids.calvingTask, { ...baseTask, id: ids.calvingTask, taskId: ids.calvingTask, workflowType: "Calving", type: "task", allowedAction: "RECORD_SERVICE", context: { pregnancyId: "507f1f77bcf86cd799439091" }, raw: { _id: ids.calvingTask, taskType: "CD" } }],
  ])("resolves an off-page %s target through the owner-scoped lookup", async (label, parameter, id, target) => {
    renderDeepLink({ parameter, id, target });
    expect(await screen.findByRole("dialog", { name: new RegExp(label) })).toBeTruthy();
    expect(mocks.get).toHaveBeenCalledWith("/technician/work-queue", {
      params: expect.objectContaining({ [parameter]: id, page: 1, limit: 1, workState: "active" }),
    });
  });

  it.each([
    [
      "AI",
      "requestId",
      ids.ai,
      {
        id: ids.ai,
        workflowId: ids.ai,
        taskId: ids.aiTask,
        workflowType: "AI",
        type: "insemination",
        serviceType: "Artificial Insemination",
        allowedAction: "RECORD_SERVICE",
        timing: { kind: "scheduled_visit", date: "2099-10-11", visitPeriod: "morning" },
        schedule: { date: "2099-10-11", visitPeriod: "morning" },
      },
    ],
    [
      "Health",
      "requestId",
      ids.health,
      {
        id: ids.health,
        workflowId: ids.health,
        taskId: ids.healthTask,
        workflowType: "Health",
        type: "health",
        serviceType: "Health Assistance",
        allowedAction: "START_SERVICE",
        timing: { kind: "scheduled_visit", date: "2099-10-11", visitPeriod: "afternoon" },
        schedule: { date: "2099-10-11", visitPeriod: "afternoon" },
      },
    ],
    [
      "Pregnancy",
      "taskId",
      ids.pregnancyTask,
      {
        id: ids.pregnancyTask,
        taskId: ids.pregnancyTask,
        workflowType: "PD",
        type: "task",
        serviceType: "Pregnancy Diagnosis",
        allowedAction: "RECORD_SERVICE",
      },
    ],
    [
      "Calving",
      "taskId",
      ids.calvingTask,
      {
        id: ids.calvingTask,
        taskId: ids.calvingTask,
        workflowType: "Calving",
        type: "task",
        serviceType: "Calving Assistance",
        allowedAction: "RECORD_SERVICE",
        context: { pregnancyId: "507f1f77bcf86cd799439091" },
      },
    ],
  ])("opens future %s work as read-only context instead of execution", async (label, parameter, id, details) => {
    const target = futureTask({
      ...details,
      title: details.serviceType,
      farmer: { name: "Test Farmer", location: "Poblacion, Oton" },
      animal: { name: "Test Animal", earTag: "TEST-1" },
    });
    renderDeepLink({ parameter, id, target });

    const dialog = await screen.findByRole("dialog", {
      name: details.serviceType,
    });
    expect(dialog).toHaveTextContent(/scheduled for a future date/i);
    expect(dialog).toHaveTextContent("Test Farmer");
    expect(dialog).toHaveTextContent("Test Animal");
    expect(dialog).toHaveTextContent("Poblacion, Oton");
    const actionDialogName =
      label === "Health"
        ? "Owned Health request"
        : new RegExp("^" + label + " " + id);
    expect(
      screen.queryByRole("dialog", { name: actionDialogName }),
    ).toBeNull();
  });

  it.each([
    ["AI", "requestId", ids.ai, { workflowType: "AI", type: "insemination", serviceType: "Artificial Insemination", workflowId: ids.ai, taskId: ids.aiTask, allowedAction: "RECORD_SERVICE" }],
    ["Health", "requestId", ids.health, { workflowType: "Health", type: "health", serviceType: "Health Assistance", workflowId: ids.health, taskId: ids.healthTask, allowedAction: "START_SERVICE" }],
    ["Pregnancy", "taskId", ids.pregnancyTask, { workflowType: "PD", type: "task", serviceType: "Pregnancy Diagnosis", taskId: ids.pregnancyTask, allowedAction: "RECORD_SERVICE" }],
    ["Calving", "taskId", ids.calvingTask, { workflowType: "Calving", type: "task", serviceType: "Calving Assistance", taskId: ids.calvingTask, allowedAction: "RECORD_SERVICE", context: { pregnancyId: "507f1f77bcf86cd799439091" } }],
  ])("opens due %s work through its canonical action", async (label, parameter, id, details) => {
    const today = dueTodayKey();
    const target = {
      ...baseTask,
      ...details,
      id,
      timing: {
        kind: details.type === "task" ? "due" : "scheduled_visit",
        date: today,
        visitPeriod: details.type === "task" ? null : "morning",
      },
      schedule: {
        date: today,
        visitPeriod: details.type === "task" ? null : "morning",
      },
      raw: { _id: id, taskType: details.workflowType === "Calving" ? "CD" : details.workflowType },
    };
    renderDeepLink({ parameter, id, target });
    expect(await screen.findByRole("dialog", { name: new RegExp(label) })).toBeTruthy();
  });

  it("keeps overdue Schedule work actionable", async () => {
    const target = {
      ...baseTask,
      id: ids.pregnancyTask,
      taskId: ids.pregnancyTask,
      workflowType: "PD",
      type: "task",
      allowedAction: "RECORD_SERVICE",
      timing: { kind: "due", date: "2000-01-01", visitPeriod: null },
      schedule: { date: "2000-01-01", visitPeriod: null },
      raw: { _id: ids.pregnancyTask, taskType: "PD" },
    };
    renderDeepLink({ parameter: "taskId", id: ids.pregnancyTask, target });
    expect(await screen.findByRole("dialog", { name: /Pregnancy/ })).toBeTruthy();
  });

  it("clears an upcoming preview deep link when its backdrop closes", async () => {
    const target = futureTask({
      id: ids.pregnancyTask,
      taskId: ids.pregnancyTask,
      workflowType: "PD",
      type: "task",
      title: "Pregnancy Diagnosis",
      serviceType: "Pregnancy Diagnosis",
      allowedAction: "RECORD_SERVICE",
    });
    renderDeepLink({ parameter: "taskId", id: ids.pregnancyTask, target });
    fireEvent.click(await screen.findByRole("button", { name: "Close dialog" }));
    await waitFor(() =>
      expect(screen.getByTestId("technician-location").textContent).not.toContain("taskId="),
    );
  });

  it("can reopen the same Schedule item after closing its upcoming preview", async () => {
    const target = futureTask({
      id: ids.pregnancyTask,
      taskId: ids.pregnancyTask,
      workflowType: "PD",
      type: "task",
      title: "Pregnancy Diagnosis",
      serviceType: "Pregnancy Diagnosis",
      allowedAction: "RECORD_SERVICE",
    });
    renderDeepLink({ parameter: "taskId", id: ids.pregnancyTask, target });
    fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(screen.getByTestId("technician-location").textContent).not.toContain("taskId="),
    );

    fireEvent.click(screen.getByRole("button", { name: "Open next deep link" }));
    expect(
      await screen.findByRole("dialog", { name: "Pregnancy Diagnosis" }),
    ).toHaveTextContent(/scheduled for a future date/i);
  });

  it("clears the identifier when the opened workflow closes", async () => {
    const target = { ...baseTask, id: ids.ai, workflowId: ids.ai, taskId: ids.aiTask, workflowType: "AI", type: "insemination", allowedAction: "RECORD_SERVICE", raw: { _id: ids.ai } };
    renderDeepLink({ parameter: "requestId", id: ids.ai, target });
    fireEvent.click(await screen.findByRole("button", { name: "Close AI" }));
    await waitFor(() => expect(screen.getByTestId("technician-location").textContent).not.toContain("requestId="));
  });

  it("clears the identifier after successful completion", async () => {
    const target = { ...baseTask, id: ids.ai, workflowId: ids.ai, taskId: ids.aiTask, workflowType: "AI", type: "insemination", allowedAction: "RECORD_SERVICE", raw: { _id: ids.ai } };
    renderDeepLink({ parameter: "requestId", id: ids.ai, target });
    fireEvent.click(await screen.findByRole("button", { name: "Complete AI" }));
    await waitFor(() => expect(screen.getByTestId("technician-location").textContent).not.toContain("requestId="));
  });

  it("fails closed and clears an unavailable or foreign identifier", async () => {
    renderDeepLink({ parameter: "taskId", id: ids.pregnancyTask, target: null });
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("This work item is unavailable or is not assigned to you."));
    expect(screen.getByTestId("technician-location").textContent).not.toContain("taskId=");
  });

  it("can open a different deep link immediately after closing the first", async () => {
    const aiTarget = { ...baseTask, id: ids.ai, workflowId: ids.ai, taskId: ids.aiTask, workflowType: "AI", type: "insemination", allowedAction: "RECORD_SERVICE", raw: { _id: ids.ai } };
    const pregnancyTarget = { ...baseTask, id: ids.pregnancyTask, taskId: ids.pregnancyTask, workflowType: "PD", type: "task", allowedAction: "RECORD_SERVICE", raw: { _id: ids.pregnancyTask, taskType: "PD" } };
    mocks.get.mockImplementation((_url, config) => {
      const target = config?.params?.requestId === ids.ai
        ? aiTarget
        : config?.params?.taskId === ids.pregnancyTask
          ? pregnancyTarget
          : null;
      return Promise.resolve({ data: { data: target ? [target] : [], pagination: { page: 1, limit: 1, total: target ? 1 : 0, totalPages: 1 }, counts: empty.counts } });
    });
    renderWorkQueue(`/technician/requests?section=myWork&requestId=${ids.ai}`);
    fireEvent.click(await screen.findByRole("button", { name: "Close AI" }));
    fireEvent.click(screen.getByRole("button", { name: "Open next deep link" }));
    expect(await screen.findByRole("dialog", { name: new RegExp("Pregnancy") })).toBeTruthy();
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

  it("uses backend pagination and totals for actionable My Work", async () => {
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

    expect(screen.queryByRole("button", { name: "Active" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Completed" })).toBeNull();
  });

  it("treats legacy completed URLs as active My Work without exposing old tabs", async () => {
    renderWorkQueue(
      "/technician/requests?section=myWork&workState=completed",
    );

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
    expect(screen.queryByRole("button", { name: "Completed" })).toBeNull();
  });

  it("does not render completed items as actionable My Work cards", async () => {
    mocks.get.mockResolvedValue({
      data: {
        data: [
          {
            ...baseTask,
            id: "active-task",
            title: "Actionable farm visit",
            workflowType: "Health",
            type: "health",
            status: "scheduled",
            displayStatus: "scheduled",
            allowedAction: "START_SERVICE",
            actionLabel: "Start Visit",
            raw: { _id: "active-task", status: "scheduled" },
          },
          {
            ...baseTask,
            id: "completed-task",
            title: "Completed farm visit",
            workflowType: "Health",
            type: "health",
            status: "resolved",
            displayStatus: "resolved",
            allowedAction: "VIEW_RECORD",
            actionLabel: "View Record",
            raw: { _id: "completed-task", status: "resolved" },
          },
        ],
        pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
        counts: { all: 1, ai: 0, health: 1, pregnancy: 0, calving: 0 },
      },
    });

    renderWorkQueue();

    expect(await screen.findByText("Actionable farm visit")).toBeTruthy();
    expect(screen.queryByText("Completed farm visit")).toBeNull();
  });

  it("groups the My Work search before its service filter", async () => {
    renderWorkQueue();
    await screen.findByText("Page 1 of 3");

    const search = screen.getByLabelText("Search My Work");
    const serviceType = screen.getByLabelText("Service type");
    expect(
      search.compareDocumentPosition(serviceType) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
