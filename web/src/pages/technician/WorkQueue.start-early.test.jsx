import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkQueue from "./WorkQueue";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  aiServiceModalProps: null,
}));

vi.mock("../../lib/axios", () => ({
  default: {
    get: mocks.get,
    post: mocks.post,
    patch: mocks.patch,
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

vi.mock("../../components/dialogs/AIServiceModal", () => ({
  default: (props) => {
    mocks.aiServiceModalProps = props;
    return props.isOpen ? <div data-testid="mock-ai-service-modal">AIServiceModal Open</div> : null;
  },
}));

vi.mock("../../components/dialogs/HealthRequestActionModal", () => ({
  default: () => null,
}));

vi.mock("../../components/dialogs/PregnancyDiagnosisModal", () => ({
  default: () => null,
}));

vi.mock("../../components/dialogs/RecordCalvingModal", () => ({
  default: () => null,
}));

vi.mock("../../components/dialogs/PregnancyLossReviewModal", () => ({
  default: () => null,
}));

const renderWithClient = (ui) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/technician/work-queue"]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("Technician Web → future-scheduled AI → Record Insemination → Start Early", () => {
  const futureDate = "2099-12-01";
  const validMongoId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.aiServiceModalProps = null;
  });

  it("shows Start service early confirmation dialog when clicking Record Insemination on a future-scheduled AI task", async () => {
    const mockTasks = [
      {
        id: validMongoId,
        workflowId: validMongoId,
        workflowType: "AI",
        type: "insemination",
        status: "scheduled",
        allowedAction: "RECORD_SERVICE",
        actionLabel: "Record Insemination",
        timing: {
          kind: "scheduled_visit",
          date: futureDate,
          visitPeriod: "morning",
        },
        schedule: {
          date: futureDate,
          visitPeriod: "morning",
        },
        farmer: {
          id: "507f1f77bcf86cd799439012",
          name: "Mario Cabanig",
        },
        animal: {
          id: "507f1f77bcf86cd799439013",
          name: "01MC",
          earTag: "01MC",
        },
        raw: {
          _id: validMongoId,
          status: "scheduled",
          scheduledDate: futureDate,
          visitPeriod: "morning",
        },
      },
    ];

    mocks.get.mockImplementation((url) => {
      if (url.includes("/work-queue")) {
        return Promise.resolve({
          data: {
            data: mockTasks,
            pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    renderWithClient(<WorkQueue />);

    const recordBtn = await screen.findByRole("button", { name: /record insemination/i });
    expect(recordBtn).toBeInTheDocument();

    fireEvent.click(recordBtn);

    // Confirmation dialog appears
    expect(screen.getByText("Start service early?")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This AI service is scheduled for a future visit. Are you sure you want to start the service now?",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start early/i })).toBeInTheDocument();

    // AIServiceModal is not yet open
    expect(screen.queryByTestId("mock-ai-service-modal")).not.toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("closes confirmation and does not call API or open recording modal when technician clicks Cancel", async () => {
    const mockTasks = [
      {
        id: validMongoId,
        workflowId: validMongoId,
        workflowType: "AI",
        type: "insemination",
        status: "scheduled",
        allowedAction: "RECORD_SERVICE",
        actionLabel: "Record Insemination",
        timing: {
          kind: "scheduled_visit",
          date: futureDate,
          visitPeriod: "morning",
        },
        schedule: {
          date: futureDate,
          visitPeriod: "morning",
        },
        farmer: { id: "507f1f77bcf86cd799439012", name: "Mario Cabanig" },
        animal: { id: "507f1f77bcf86cd799439013", name: "01MC", earTag: "01MC" },
        raw: { _id: validMongoId, status: "scheduled", scheduledDate: futureDate, visitPeriod: "morning" },
      },
    ];

    mocks.get.mockImplementation((url) => {
      if (url.includes("/work-queue")) {
        return Promise.resolve({
          data: {
            data: mockTasks,
            pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    renderWithClient(<WorkQueue />);

    const recordBtn = await screen.findByRole("button", { name: /record insemination/i });
    fireEvent.click(recordBtn);

    expect(screen.getByText("Start service early?")).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);

    // Dialog closes, modal not open, no PATCH
    expect(screen.queryByText("Start service early?")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mock-ai-service-modal")).not.toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("calls PATCH /ai-request/:workflowId/status with earlyStartConfirmed: true and opens AIServiceModal when clicking Start Early", async () => {
    const mockTasks = [
      {
        id: validMongoId,
        workflowId: validMongoId,
        workflowType: "AI",
        type: "insemination",
        status: "scheduled",
        allowedAction: "RECORD_SERVICE",
        actionLabel: "Record Insemination",
        timing: {
          kind: "scheduled_visit",
          date: futureDate,
          visitPeriod: "morning",
        },
        schedule: {
          date: futureDate,
          visitPeriod: "morning",
        },
        farmer: { id: "507f1f77bcf86cd799439012", name: "Mario Cabanig" },
        animal: { id: "507f1f77bcf86cd799439013", name: "01MC", earTag: "01MC" },
        raw: { _id: validMongoId, status: "scheduled", scheduledDate: futureDate, visitPeriod: "morning" },
      },
    ];

    mocks.get.mockImplementation((url) => {
      if (url.includes("/work-queue")) {
        return Promise.resolve({
          data: {
            data: mockTasks,
            pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    mocks.patch.mockResolvedValue({
      data: {
        message: "Status updated successfully",
        request: {
          _id: validMongoId,
          status: "in-progress",
          scheduledDate: futureDate,
          visitPeriod: "morning",
          serviceStartedAt: "2026-09-11T14:00:00.000Z",
        },
      },
    });

    renderWithClient(<WorkQueue />);

    const recordBtn = await screen.findByRole("button", { name: /record insemination/i });
    fireEvent.click(recordBtn);

    const startEarlyBtn = screen.getByRole("button", { name: /start early/i });
    fireEvent.click(startEarlyBtn);

    await waitFor(() => {
      expect(mocks.patch).toHaveBeenCalledWith(
        `/ai-request/${validMongoId}/status`,
        {
          status: "in-progress",
          earlyStartConfirmed: true,
        },
      );
    });

    // Recording modal opens
    await waitFor(() => {
      expect(screen.getByTestId("mock-ai-service-modal")).toBeInTheDocument();
    });

    expect(mocks.aiServiceModalProps?.workflowId).toBe(validMongoId);
  });

  it("opens recording modal directly without Start Early confirmation for already In Progress AI tasks", async () => {
    const mockTasks = [
      {
        id: validMongoId,
        workflowId: validMongoId,
        workflowType: "AI",
        type: "insemination",
        status: "in-progress",
        serviceStartedAt: "2026-09-11T13:00:00.000Z",
        allowedAction: "RECORD_SERVICE",
        actionLabel: "Continue Service",
        timing: {
          kind: "scheduled_visit",
          date: futureDate,
          visitPeriod: "morning",
        },
        schedule: {
          date: futureDate,
          visitPeriod: "morning",
        },
        farmer: { id: "507f1f77bcf86cd799439012", name: "Mario Cabanig" },
        animal: { id: "507f1f77bcf86cd799439013", name: "01MC", earTag: "01MC" },
        raw: {
          _id: validMongoId,
          status: "in-progress",
          serviceStartedAt: "2026-09-11T13:00:00.000Z",
          scheduledDate: futureDate,
          visitPeriod: "morning",
        },
      },
    ];

    mocks.get.mockImplementation((url) => {
      if (url.includes("/work-queue")) {
        return Promise.resolve({
          data: {
            data: mockTasks,
            pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    renderWithClient(<WorkQueue />);

    const continueBtn = await screen.findByRole("button", { name: /continue service/i });
    expect(continueBtn).toBeInTheDocument();

    fireEvent.click(continueBtn);

    // No Start Early dialog appears
    expect(screen.queryByText("Start service early?")).not.toBeInTheDocument();

    // AIServiceModal opens directly
    expect(screen.getByTestId("mock-ai-service-modal")).toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();
  });
});
