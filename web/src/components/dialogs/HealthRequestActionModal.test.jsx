import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  success: vi.fn(),
}));

vi.mock("../../lib/axios", () => ({
  default: {
    get: mocks.get,
    patch: mocks.patch,
    post: mocks.post,
  },
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.success },
}));

vi.mock("../ui/Modal", () => ({
  default: ({ isOpen, title, children, actions }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <div>{children}</div>
        <footer>{actions}</footer>
      </div>
    ) : null,
}));

import HealthRequestActionModal from "./HealthRequestActionModal";

const requestId = "507f1f77bcf86cd799439051";
const technicianId = "507f1f77bcf86cd799439052";

const ownedRequest = (overrides = {}) => ({
  _id: requestId,
  id: requestId,
  type: "health",
  status: "approved",
  requestType: "medicine",
  handledBy: { _id: technicianId, name: "Tina Technician" },
  assignedTechnicianId: technicianId,
  farmerId: { _id: "farmer-1", name: "Faye Farmer" },
  animalId: { _id: "animal-1", earTag: "OTON-14" },
  ...overrides,
});

const task = {
  id: "visible-task-wrapper-id",
  workflowId: requestId,
  workflowType: "Health",
  type: "health",
  status: "approved",
  raw: ownedRequest(),
};

const renderModal = (
  detail = ownedRequest(),
  taskOverride = task,
  { preserveGetMock = false } = {},
) => {
  if (!preserveGetMock) {
    mocks.get.mockResolvedValue({ data: { data: detail } });
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onClose = vi.fn();
  const onSuccess = vi.fn().mockResolvedValue(undefined);
  render(
    <QueryClientProvider client={queryClient}>
      <HealthRequestActionModal
        isOpen
        onClose={onClose}
        task={taskOverride}
        onSuccess={onSuccess}
      />
    </QueryClientProvider>,
  );
  return { onClose, onSuccess };
};

describe("HealthRequestActionModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.patch.mockResolvedValue({ data: { data: ownedRequest() } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("can remain mounted closed while its task context is cleared", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    expect(() =>
      render(
        <QueryClientProvider client={queryClient}>
          <HealthRequestActionModal
            isOpen={false}
            onClose={vi.fn()}
            task={null}
            onSuccess={vi.fn()}
          />
        </QueryClientProvider>,
      ),
    ).not.toThrow();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("shows all unique Farmer request photos from the original Health request", async () => {
    renderModal(
      ownedRequest({
        photos: [
          "https://example.test/health-1.jpg",
          "https://example.test/health-2.jpg",
        ],
        imageUrl: "https://example.test/health-1.jpg",
      }),
    );

    expect(
      await screen.findByText("Farmer request photos (2)"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("img", { name: /Farmer Health request photo/ }),
    ).toHaveLength(2);
  });

  it("claims the original request before exposing response methods", async () => {
    const unclaimed = ownedRequest({
      status: "pending",
      handledBy: null,
      assignedTechnicianId: null,
    });
    mocks.get
      .mockResolvedValueOnce({ data: { data: unclaimed } })
      .mockResolvedValue({ data: { data: ownedRequest({ status: "pending" }) } });
    renderModal(
      unclaimed,
      { ...task, status: "pending", raw: unclaimed },
      { preserveGetMock: true },
    );

    fireEvent.click(await screen.findByRole("button", { name: "Claim Request" }));

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith(
        `/technician/requests/health/${requestId}/claim`,
      ),
    );
    expect(
      await screen.findByRole("button", { name: /^Give Advice/ }),
    ).toBeTruthy();
  });

  it("validates Advice and resolves the original request without scheduling or walk-in creation", async () => {
    renderModal();
    fireEvent.click(
      await screen.findByRole("button", { name: /^Give Advice/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Send Advice" }));
    expect(await screen.findByText("Advice for the farmer is required.")).toBeTruthy();
    expect(mocks.patch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Advice for Farmer"), {
      target: { value: "  Keep the animal hydrated.  " },
    });
    fireEvent.change(screen.getByLabelText("Internal Note"), {
      target: { value: "  Technician-only context.  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Advice" }));

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith(
        `/health-request/${requestId}/advice`,
        {
          advice: "Keep the animal hydrated.",
          technicianNote: "Technician-only context.",
        },
      ),
    );
    const payload = mocks.patch.mock.calls[0][1];
    expect(payload.scheduledDate).toBeUndefined();
    expect(payload.visitPeriod).toBeUndefined();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("requires Office Pickup fields and submits only the canonical payload", async () => {
    renderModal();
    fireEvent.click(
      await screen.findByRole("button", { name: /^Office Pickup/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Send Pickup Information" }),
    );
    expect(await screen.findByText("Item available for pickup is required.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Item available for pickup"), {
      target: { value: " Dewormer " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Send Pickup Information" }),
    );
    expect(
      await screen.findByText(
        "Confirm that the item is available for office pickup.",
      ),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByLabelText(
        "I confirm this item is available for office pickup",
      ),
    );
    fireEvent.change(screen.getByLabelText("Pickup instructions"), {
      target: { value: " Collect from the municipal office. " },
    });
    fireEvent.change(screen.getByLabelText("Message for Farmer"), {
      target: { value: " Please bring this request reference. " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Send Pickup Information" }),
    );

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith(
        `/health-request/${requestId}/office-pickup`,
        {
          item: "Dewormer",
          availabilityConfirmed: true,
          instructions: "Collect from the municipal office.",
          farmerMessage: "Please bring this request reference.",
        },
      ),
    );
    const payload = mocks.patch.mock.calls[0][1];
    expect(payload.scheduledDate).toBeUndefined();
    expect(payload.visitPeriod).toBeUndefined();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("schedules by date and period and confirms the late current period", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-31T07:00:00.000Z"));
    renderModal();
    fireEvent.click(
      await screen.findByRole("button", { name: /^Schedule Farm Visit/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Afternoon" }));
    fireEvent.click(screen.getByRole("button", { name: "Schedule Visit" }));

    expect(await screen.findByText("Schedule for the current period?")).toBeTruthy();
    expect(mocks.patch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Schedule Anyway" }));

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith(
        `/health-request/${requestId}/status`,
        {
          status: "scheduled",
          scheduledDate: "2026-08-31",
          visitPeriod: "afternoon",
          samePeriodConfirmed: true,
        },
      ),
    );
    const payload = mocks.patch.mock.calls[0][1];
    expect(payload.scheduledTime).toBeUndefined();
    expect(payload.preferredTime).toBeUndefined();
  });

  it("starts and completes clinical work against the same request ID", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-31T05:00:00.000Z"));
    const scheduled = ownedRequest({
      status: "scheduled",
      scheduledDate: "2026-08-31T04:00:00.000Z",
      visitPeriod: "afternoon",
    });
    const first = renderModal(scheduled, {
      ...task,
      status: "scheduled",
      raw: scheduled,
    });
    fireEvent.click(await screen.findByRole("button", { name: "Start Visit" }));
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith(
        `/health-request/${requestId}/status`,
        { status: "in-progress" },
      ),
    );
    first.onClose.mockClear();

    cleanup();
    mocks.patch.mockClear();
    const inProgress = ownedRequest({ status: "in-progress" });
    renderModal(inProgress, {
      ...task,
      status: "in-progress",
      raw: inProgress,
    });
    fireEvent.change(await screen.findByLabelText("Diagnosis"), {
      target: { value: "Digestive infection" },
    });
    fireEvent.change(screen.getByLabelText("Treatment"), {
      target: { value: "Supportive treatment" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Complete Service" }));
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith(
        `/health-request/${requestId}/status`,
        {
          status: "resolved",
          diagnosis: "Digestive infection",
          treatment: "Supportive treatment",
        },
      ),
    );
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
