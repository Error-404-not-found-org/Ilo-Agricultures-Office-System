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
  info: vi.fn(),
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
    info: mocks.info,
  },
}));

vi.mock("../../components/layout/Topbar", () => ({
  default: ({ title }) => <h1>{title}</h1>,
}));

vi.mock("../../components/dialogs/HealthRequestActionModal", () => ({
  default: ({ isOpen, task, onClose, startServiceOnOpen }) =>
    isOpen ? (
      <div
        role="dialog"
        aria-label="Owned Health request"
        data-request-id={task?.id}
        data-workflow-id={task?.workflowId}
        data-start-service={startServiceOnOpen ? "true" : "false"}
      >
        <span>{task?.allowedAction}</span>
        <button type="button" onClick={onClose}>
          Close Health
        </button>
      </div>
    ) : null,
}));

vi.mock("../../components/dialogs/AIServiceModal", () => ({
  default: ({ isOpen, workflowId, onClose, onSuccess }) =>
    isOpen ? (
      <div role="dialog" aria-label={`AI ${workflowId}`}>
        <button type="button" onClick={onClose}>
          Close AI
        </button>
        <button type="button" onClick={onSuccess}>
          Complete AI
        </button>
      </div>
    ) : null,
}));

vi.mock("../../components/dialogs/PregnancyDiagnosisModal", () => ({
  default: ({ isOpen, taskId, onClose }) =>
    isOpen ? (
      <div role="dialog" aria-label={`Pregnancy ${taskId}`}>
        <button type="button" onClick={onClose}>
          Close Pregnancy
        </button>
      </div>
    ) : null,
}));

vi.mock("../../components/dialogs/RecordCalvingModal", () => ({
  default: ({ isOpen, taskId, pregnancyData, onClose }) =>
    isOpen ? (
      <div
        role="dialog"
        aria-label={`Calving ${taskId}`}
        data-pregnancy-id={pregnancyData?._id}
      >
        <button type="button" onClick={onClose}>
          Close Calving
        </button>
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

const renderWorkQueue = (
  initialEntry = "/technician/requests?section=myWork",
) => {
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
  return (
    <>
      <output data-testid="technician-location">
        {location.pathname}
        {location.search}
      </output>
      <button
        type="button"
        onClick={() =>
          navigate(
            `/technician/requests?section=myWork&taskId=${ids.pregnancyTask}`,
          )
        }
      >
        Open next deep link
      </button>
    </>
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
    expect(dialog.getAttribute("data-start-service")).toBe("true");
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each(["morning", "afternoon"])(
    "opens today's %s Health visit without starting it or showing generic details",
    async (visitPeriod) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-09-29T01:00:00.000Z"));
      try {
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
            handlingMethod: "farm_visit",
            scheduledDate: "2026-09-29",
            schedule: { date: "2026-09-29", visitPeriod },
            timing: { kind: "scheduled_visit", date: "2026-09-29", visitPeriod },
            allowedAction: "START_SERVICE",
            actionLabel: "Start Visit",
            raw: { _id: ids.health, status: "scheduled", handlingMethod: "farm_visit" },
          },
        ]);

        fireEvent.click(
          await screen.findByRole("button", { name: "View Scheduled Visit" }),
        );

        const dialog = screen.getByRole("dialog", {
          name: "Owned Health request",
        });
        expect(dialog.getAttribute("data-request-id")).toBe(ids.health);
        expect(dialog.getAttribute("data-workflow-id")).toBe(ids.health);
        expect(dialog.getAttribute("data-start-service")).toBe("false");
        expect(screen.getAllByRole("dialog")).toHaveLength(1);
        expect(mocks.patch).not.toHaveBeenCalled();
        expect(mocks.post).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("opens a future scheduled Health visit as read-only details", async () => {
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
        scheduledDate: "2099-12-01T04:00:00.000Z",
        schedule: {
          date: "2099-12-01T04:00:00.000Z",
          visitPeriod: "afternoon",
        },
        allowedAction: "VIEW_DETAILS",
        actionLabel: "View Scheduled Visit",
        workTiming: "upcoming",
        raw: { _id: ids.health, status: "scheduled" },
      },
    ]);

    fireEvent.click(
      await screen.findByRole("button", { name: "View Scheduled Visit" }),
    );

    const dialog = screen.getByRole("dialog", { name: "Owned Health request" });
    expect(dialog.getAttribute("data-start-service")).toBe("false");
    expect(screen.getByText("VIEW_DETAILS")).toBeTruthy();
    expect(mocks.patch).not.toHaveBeenCalled();
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

    expect(await screen.findByText("Pregnancy Check")).toBeTruthy();
    expect(screen.getByText("Expected Calving")).toBeTruthy();
    expect(screen.queryByText("Pregnancy Diagnosis")).toBeNull();
    expect(screen.queryByText("Calving Assistance")).toBeNull();

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

  it("renders full farmer update with signs, photos, and formatted summary in breeding follow-up modal", async () => {
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
          context: { inseminationId: ids.ai, reportType: "return_to_heat" },
          summary:
            "Breeding observation: return_to_heat. Signs: mucus_discharge, mounting_behavior. Notes: None",
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
              inseminationDate: "2026-08-17T04:00:00.000Z",
              attemptNumber: 1,
              farmerOutcomeReport: "return_to_heat",
              farmerOutcomeReportedAt: "2026-09-07T04:40:00.000Z",
              farmerObservationSigns: ["mucus_discharge", "mounting_behavior"],
              farmerObservationNotes: "Cow was displaying heat signs",
              evidencePhotos: [
                "https://res.cloudinary.com/demo/photo1.jpg",
                "https://res.cloudinary.com/demo/photo2.jpg",
              ],
            },
          },
        },
      },
    );

    // Verify row displays Needs review badge and formatted summary without raw enums
    expect(await screen.findByText("Needs review")).toBeTruthy();
    expect(
      screen.getByText(
        "Breeding observation: Return to heat. Signs: Clear mucus discharge, Mounting other cattle. Notes: None",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/return_to_heat/)).toBeNull();
    expect(screen.queryByText(/mucus_discharge/)).toBeNull();

    // Open modal
    fireEvent.click(
      await screen.findByRole("button", { name: "Record Follow-up" }),
    );

    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith(`/tasks/${ids.followUpTask}`),
    );

    // Verify Farmer Update section
    expect(await screen.findByText("Farmer Update")).toBeTruthy();
    expect(await screen.findByText("Showing signs of heat")).toBeTruthy();
    expect(screen.getByText("Clear mucus discharge")).toBeTruthy();
    expect(screen.getByText("Mounting other cattle")).toBeTruthy();
    expect(screen.getByText("Cow was displaying heat signs")).toBeTruthy();
    expect(screen.queryByText("No farmer update received")).toBeNull();

    // Verify supporting photos are rendered as buttons
    const photoButtons = screen.getAllByRole("button", {
      name: /View supporting photo/,
    });
    expect(photoButtons).toHaveLength(2);
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
        data:
          config?.params?.[parameter] === id
            ? {
                ...empty,
                data: target ? [target] : [],
                pagination: { ...empty.pagination, total: target ? 1 : 0 },
              }
            : empty,
      }),
    );
    renderWorkQueue(`/technician/requests?section=myWork&${parameter}=${id}`);
  };

  it("reports an accessible cancelled Health request from an old notification", async () => {
    mocks.error.mockClear();
    mocks.info.mockClear();
    mocks.get.mockImplementation((url, config) => {
      if (url === `/health-request/${ids.health}`) {
        return Promise.resolve({ data: { data: { _id: ids.health, status: "cancelled", cancellationStatus: "approved", assignedTechnicianId: "technician-1" } } });
      }
      return Promise.resolve({ data: config?.params?.requestId === ids.health ? { ...empty, pagination: { ...empty.pagination, limit: 1 } } : empty });
    });
    renderWorkQueue(`/technician/requests?section=myWork&requestId=${ids.health}`);
    await waitFor(() => expect(mocks.info).toHaveBeenCalledWith("This Health request has already been cancelled."));
    expect(mocks.error).not.toHaveBeenCalledWith("This work item is unavailable or is not assigned to you.");
    expect(screen.queryByRole("dialog", { name: "Owned Health request" })).toBeNull();
    expect(screen.getByTestId("technician-location")).toHaveTextContent("section=myWork");
    await waitFor(() => expect(screen.getByTestId("technician-location").textContent).not.toContain("requestId="));
  });

  it("renders canonical lifecycle semantics through the actual My Work card path", async () => {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    renderQueue([
      {
        ...baseTask,
        id: "return-to-heat",
        taskId: "return-to-heat",
        workflowType: "BreedingFollowUp",
        taskType: "BreedingFollowUp",
        serviceType: "Breeding Follow-up",
        title: "Breeding Follow-up",
        status: "Pending",
        displayStatus: "Pending",
        dueDate: `${today}T02:00:00.000Z`,
        schedule: { date: `${today}T02:00:00.000Z`, visitPeriod: null },
        timing: { kind: "due", date: `${today}T02:00:00.000Z` },
        allowedAction: "RECORD_BREEDING_OBSERVATION",
        actionLabel: "Record Follow-up",
        summary: "Farmer reported a return to heat for this animal.",
        raw: {
          sourceType: "farmer_requested_verification",
          dueDate: `${today}T02:00:00.000Z`,
          metadata: { reportType: "return_to_heat" },
        },
      },
      {
        ...baseTask,
        id: "pregnancy-check",
        taskId: "pregnancy-check",
        workflowType: "PregnancyDiagnosis",
        taskType: "Other",
        serviceType: "Pregnancy Diagnosis",
        title: "Pregnancy Diagnosis",
        status: "Pending",
        displayStatus: "Pending",
        dueDate: today,
        schedule: { date: today, visitPeriod: null },
        timing: { kind: "due", date: today },
        allowedAction: "RECORD_SERVICE",
        actionLabel: "Record Pregnancy Check",
        raw: { taskType: "PD", dueDate: today },
      },
      {
        ...baseTask,
        id: "expected-calving",
        taskId: "expected-calving",
        workflowType: "CalvingAssistance",
        taskType: "Other",
        serviceType: "Calving Assistance",
        title: "Calving Assistance",
        status: "Pending",
        displayStatus: "Pending",
        dueDate: today,
        schedule: { date: today, visitPeriod: null },
        timing: { kind: "due", date: today },
        allowedAction: "RECORD_SERVICE",
        actionLabel: "Record Calving",
        raw: { taskType: "CD", dueDate: today },
      },
    ]);

    expect(await screen.findByText("Breeding Follow-up")).toBeTruthy();
    expect(await screen.findByText("Needs review")).toBeTruthy();
    expect(screen.getByText("Return to heat reported")).toBeTruthy();
    expect(screen.getByText("Reported today")).toBeTruthy();
    expect(screen.getByText("Pregnancy Check")).toBeTruthy();
    expect(screen.getAllByText("Ready for check").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Record Pregnancy Check" })).toBeTruthy();

    expect(screen.getByText("Expected Calving")).toBeTruthy();
    expect(screen.getByText("Expected today")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Record Calving" })).toBeTruthy();

    expect(screen.queryByText("Pregnancy Diagnosis")).toBeNull();
    expect(screen.queryByText("Calving Assistance")).toBeNull();
    expect(screen.queryByText("Due Today")).toBeNull();
    expect(screen.getAllByText("Timing")).toHaveLength(3);
  });

  it("suppresses automatic Pregnancy Check supporting text by source type only", async () => {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const generatedSummary =
      "Scheduled Pregnancy Diagnosis (PD) follow-up for Animal Tag #02AT.";
    const genuineInstruction =
      "Bring the portable ultrasound and review the animal history.";

    renderQueue([
      {
        ...baseTask,
        id: ids.pregnancyTask,
        taskId: ids.pregnancyTask,
        workflowType: "PD",
        taskType: "PD",
        serviceType: "Pregnancy Diagnosis",
        title: "Pregnancy Diagnosis",
        sourceType: "automatic_pd_followup",
        summary: generatedSummary,
        status: "Pending",
        displayStatus: "Pending",
        dueDate: today,
        schedule: { date: today, visitPeriod: null },
        timing: { kind: "due", date: today },
        allowedAction: "RECORD_SERVICE",
        actionLabel: "Record Pregnancy Check",
        raw: {
          taskType: "PD",
          sourceType: "automatic_pd_followup",
          dueDate: today,
          metadata: { workflowStage: "initial_confirmation" },
        },
      },
      {
        ...baseTask,
        id: "manual-instruction",
        taskId: "manual-instruction",
        workflowType: "Other",
        taskType: "Other",
        serviceType: "Other",
        sourceType: "manual_task",
        summary: genuineInstruction,
        allowedAction: "VIEW_DETAILS",
        actionLabel: "View Details",
        raw: { taskType: "Other", sourceType: "manual_task" },
      },
    ]);

    expect(await screen.findByText("Pregnancy Check")).toBeTruthy();
    expect(screen.getAllByText("Ready for check").length).toBeGreaterThan(0);
    expect(screen.queryByText(generatedSummary)).toBeNull();
    expect(screen.getByText(genuineInstruction)).toBeTruthy();
  });

  it("uses the same semantic suppression in the My Work detail drawer", async () => {
    const generatedSummary =
      "Scheduled Pregnancy Diagnosis (PD) follow-up for Animal Tag #02AT.";
    renderQueue([
      {
        ...baseTask,
        id: ids.pregnancyTask,
        taskId: ids.pregnancyTask,
        workflowType: "PD",
        taskType: "PD",
        serviceType: "Pregnancy Diagnosis",
        sourceType: "automatic_pd_followup",
        summary: generatedSummary,
        allowedAction: "VIEW_DETAILS",
        actionLabel: "View Details",
        raw: {
          taskType: "PD",
          sourceType: "automatic_pd_followup",
          dueDate: baseTask.displayDate,
        },
      },
    ]);

    fireEvent.click(await screen.findByRole("button", { name: "View Details" }));

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.queryByText(generatedSummary)).toBeNull();
    expect(screen.queryByText("Service information")).toBeNull();
  });

  it("retains the protected unavailable message for an unowned Health request", async () => {
    mocks.error.mockClear();
    mocks.get.mockImplementation((url) => url === `/health-request/${ids.health}`
      ? Promise.reject({ response: { status: 403 } })
      : Promise.resolve({ data: empty }));
    renderWorkQueue(`/technician/requests?section=myWork&requestId=${ids.health}`);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("This work item is unavailable or is not assigned to you."));
    expect(screen.queryByRole("dialog", { name: "Owned Health request" })).toBeNull();
  });

  it("opens an active Health request after its cancellation was rejected without review actions", async () => {
    mocks.get.mockClear();
    const target = {
      ...baseTask,
      id: ids.health,
      workflowId: ids.health,
      workflowType: "Health",
      type: "health",
      allowedAction: "VIEW_DETAILS",
      status: "scheduled",
      raw: { _id: ids.health, status: "scheduled", cancellationStatus: "rejected" },
    };
    renderDeepLink({ parameter: "requestId", id: ids.health, target });
    expect(await screen.findByRole("dialog", { name: "Owned Health request" })).toHaveAttribute("data-request-id", ids.health);
    expect(mocks.get).not.toHaveBeenCalledWith(`/health-request/${ids.health}`);
  });

  it("keeps a nonexistent Health request unavailable", async () => {
    mocks.error.mockClear();
    mocks.get.mockImplementation((url) => url === `/health-request/${ids.health}`
      ? Promise.reject({ response: { status: 404 } })
      : Promise.resolve({ data: empty }));
    renderWorkQueue(`/technician/requests?section=myWork&requestId=${ids.health}`);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("This work item is unavailable or is not assigned to you."));
  });

  it("does not identify an unassigned cancelled Health request as the Technician's handled work", async () => {
    mocks.error.mockClear();
    mocks.info.mockClear();
    mocks.get.mockImplementation((url) => url === `/health-request/${ids.health}`
      ? Promise.resolve({ data: { data: { _id: ids.health, status: "cancelled", cancellationStatus: "approved" } } })
      : Promise.resolve({ data: empty }));
    renderWorkQueue(`/technician/requests?section=myWork&requestId=${ids.health}`);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("This work item is unavailable or is not assigned to you."));
    expect(mocks.info).not.toHaveBeenCalledWith("This Health request has already been cancelled.");
  });

  const futureTask = (overrides = {}) => ({
    ...baseTask,
    status: "scheduled",
    displayStatus: "scheduled",
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
    [
      "AI",
      "requestId",
      ids.ai,
      {
        ...baseTask,
        id: ids.ai,
        workflowId: ids.ai,
        taskId: ids.aiTask,
        workflowType: "AI",
        type: "insemination",
        allowedAction: "RECORD_SERVICE",
        raw: { _id: ids.ai },
      },
    ],
    [
      "Health",
      "requestId",
      ids.health,
      {
        ...baseTask,
        id: ids.health,
        workflowId: ids.health,
        taskId: ids.healthTask,
        workflowType: "Health",
        type: "health",
        allowedAction: "RECORD_SERVICE",
        raw: { _id: ids.health },
      },
    ],
    [
      "Pregnancy",
      "taskId",
      ids.pregnancyTask,
      {
        ...baseTask,
        id: ids.pregnancyTask,
        taskId: ids.pregnancyTask,
        workflowType: "PD",
        type: "task",
        allowedAction: "RECORD_SERVICE",
        raw: { _id: ids.pregnancyTask, taskType: "PD" },
      },
    ],
    [
      "Calving",
      "taskId",
      ids.calvingTask,
      {
        ...baseTask,
        id: ids.calvingTask,
        taskId: ids.calvingTask,
        workflowType: "Calving",
        type: "task",
        allowedAction: "RECORD_SERVICE",
        context: { pregnancyId: "507f1f77bcf86cd799439091" },
        raw: { _id: ids.calvingTask, taskType: "CD" },
      },
    ],
  ])(
    "resolves an off-page %s target through the owner-scoped lookup",
    async (label, parameter, id, target) => {
      renderDeepLink({ parameter, id, target });
      expect(
        await screen.findByRole("dialog", { name: new RegExp(label) }),
      ).toBeTruthy();
      expect(mocks.get).toHaveBeenCalledWith("/technician/work-queue", {
        params: expect.objectContaining({
          [parameter]: id,
          limit: 1,
          workState: "active",
        }),
      });
    },
  );

  it.each([
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
        allowedAction: "VIEW_DETAILS",
        actionLabel: "View Scheduled Visit",
        workTiming: "upcoming",
        timing: {
          kind: "scheduled_visit",
          date: "2099-10-11",
          visitPeriod: "afternoon",
        },
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
  ])(
    "opens future %s work as read-only context instead of execution",
    async (label, parameter, id, details) => {
      const target = futureTask({
        ...details,
        title: details.serviceType,
        farmer: { name: "Test Farmer", location: "Poblacion, Oton" },
        animal: { name: "Test Animal", earTag: "TEST-1" },
      });
      renderDeepLink({ parameter, id, target });

      const dialog = await screen.findByRole("dialog", {
        name: label === "Health" ? "Owned Health request" : details.serviceType,
      });
      if (label !== "Health") {
        expect(dialog).toHaveTextContent(/Upcoming|Scheduled/i);
        expect(dialog).toHaveTextContent("Test Farmer");
        expect(dialog).toHaveTextContent("Test Animal");
        expect(dialog).toHaveTextContent("Poblacion, Oton");
      } else {
        expect(dialog.getAttribute("data-start-service")).toBe("false");
      }
      const actionDialogName =
        label === "Health"
          ? "Owned Health request"
          : new RegExp("^" + label + " " + id);
      if (label !== "Health") {
        expect(
          screen.queryByRole("dialog", { name: actionDialogName }),
        ).toBeNull();
      }
    },
  );

  it.each([
    [
      "AI",
      "requestId",
      ids.ai,
      {
        workflowType: "AI",
        type: "insemination",
        serviceType: "Artificial Insemination",
        workflowId: ids.ai,
        taskId: ids.aiTask,
        allowedAction: "RECORD_SERVICE",
      },
    ],
    [
      "Health",
      "requestId",
      ids.health,
      {
        workflowType: "Health",
        type: "health",
        serviceType: "Health Assistance",
        workflowId: ids.health,
        taskId: ids.healthTask,
        allowedAction: "START_SERVICE",
      },
    ],
    [
      "Pregnancy",
      "taskId",
      ids.pregnancyTask,
      {
        workflowType: "PD",
        type: "task",
        serviceType: "Pregnancy Diagnosis",
        taskId: ids.pregnancyTask,
        allowedAction: "RECORD_SERVICE",
      },
    ],
    [
      "Calving",
      "taskId",
      ids.calvingTask,
      {
        workflowType: "Calving",
        type: "task",
        serviceType: "Calving Assistance",
        taskId: ids.calvingTask,
        allowedAction: "RECORD_SERVICE",
        context: { pregnancyId: "507f1f77bcf86cd799439091" },
      },
    ],
  ])(
    "opens due %s work through its canonical action",
    async (label, parameter, id, details) => {
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
        raw: {
          _id: id,
          taskType:
            details.workflowType === "Calving" ? "CD" : details.workflowType,
        },
      };
      renderDeepLink({ parameter, id, target });
      expect(
        await screen.findByRole("dialog", { name: new RegExp(label) }),
      ).toBeTruthy();
    },
  );

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
    expect(
      await screen.findByRole("dialog", { name: /Pregnancy/ }),
    ).toBeTruthy();
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
    fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(
        screen.getByTestId("technician-location").textContent,
      ).not.toContain("taskId="),
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
      expect(
        screen.getByTestId("technician-location").textContent,
      ).not.toContain("taskId="),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open next deep link" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Pregnancy Diagnosis" }),
    ).toHaveTextContent(/Upcoming/i);
  });

  it("clears the identifier when the opened workflow closes", async () => {
    const target = {
      ...baseTask,
      id: ids.ai,
      workflowId: ids.ai,
      taskId: ids.aiTask,
      workflowType: "AI",
      type: "insemination",
      allowedAction: "RECORD_SERVICE",
      raw: { _id: ids.ai },
    };
    renderDeepLink({ parameter: "requestId", id: ids.ai, target });
    fireEvent.click(await screen.findByRole("button", { name: "Close AI" }));
    await waitFor(() =>
      expect(
        screen.getByTestId("technician-location").textContent,
      ).not.toContain("requestId="),
    );
  });

  it("clears the identifier after successful completion", async () => {
    const target = {
      ...baseTask,
      id: ids.ai,
      workflowId: ids.ai,
      taskId: ids.aiTask,
      workflowType: "AI",
      type: "insemination",
      allowedAction: "RECORD_SERVICE",
      raw: { _id: ids.ai },
    };
    renderDeepLink({ parameter: "requestId", id: ids.ai, target });
    fireEvent.click(await screen.findByRole("button", { name: "Complete AI" }));
    await waitFor(() =>
      expect(
        screen.getByTestId("technician-location").textContent,
      ).not.toContain("requestId="),
    );
  });

  it("fails closed and clears an unavailable or foreign identifier", async () => {
    renderDeepLink({
      parameter: "taskId",
      id: ids.pregnancyTask,
      target: null,
    });
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        "This work item is unavailable or is not assigned to you.",
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("technician-location").textContent,
      ).not.toContain("taskId="),
    );
  });

  it("can open a different deep link immediately after closing the first", async () => {
    const aiTarget = {
      ...baseTask,
      id: ids.ai,
      workflowId: ids.ai,
      taskId: ids.aiTask,
      workflowType: "AI",
      type: "insemination",
      allowedAction: "RECORD_SERVICE",
      raw: { _id: ids.ai },
    };
    const pregnancyTarget = {
      ...baseTask,
      id: ids.pregnancyTask,
      taskId: ids.pregnancyTask,
      workflowType: "PD",
      type: "task",
      allowedAction: "RECORD_SERVICE",
      raw: { _id: ids.pregnancyTask, taskType: "PD" },
    };
    mocks.get.mockImplementation((_url, config) => {
      const target =
        config?.params?.requestId === ids.ai
          ? aiTarget
          : config?.params?.taskId === ids.pregnancyTask
            ? pregnancyTarget
            : null;
      return Promise.resolve({
        data: {
          data: target ? [target] : [],
          pagination: {
            page: 1,
            limit: 1,
            total: target ? 1 : 0,
            totalPages: 1,
          },
          counts: empty.counts,
        },
      });
    });
    renderWorkQueue(`/technician/requests?section=myWork&requestId=${ids.ai}`);
    fireEvent.click(await screen.findByRole("button", { name: "Close AI" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Open next deep link" }),
    );
    expect(
      await screen.findByRole("dialog", { name: new RegExp("Pregnancy") }),
    ).toBeTruthy();
  });
});

describe("My Work canonical server data", () => {
  it.each(["scheduled", "in-progress"])(
    "renders the Health request type as Sick or Injured Animal for %s work",
    async (status) => {
      renderQueue([
        {
          ...baseTask,
          id: `${ids.health}-${status}`,
          workflowId: ids.health,
          workflowType: "Health",
          type: "health",
          title: "disease",
          serviceType: "disease",
          requestType: "disease",
          status,
          displayStatus: status,
          allowedAction:
            status === "scheduled" ? "VIEW_DETAILS" : "START_SERVICE",
        },
      ]);

      expect(await screen.findByText("Sick or Injured Animal")).toBeTruthy();
      expect(screen.queryByText(/^disease$/i)).toBeNull();
    },
  );

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

    expect(
      await screen.findByRole("heading", { name: "My Work" }),
    ).toBeTruthy();
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
    renderWorkQueue("/technician/requests?section=myWork&workState=completed");

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
      search.compareDocumentPosition(serviceType) &
        Node.DOCUMENT_POSITION_FOLLOWING,
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
