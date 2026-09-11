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
const taskId = "507f1f77bcf86cd799439053";

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
  taskId,
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

  it("does not throw for a closed modal without a task", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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
      await screen.findByText(/Farmer Request Photos \(2\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("img", { name: /Farmer Health request photo/ }),
    ).toHaveLength(2);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open Farmer Health request photo 1",
      }),
    );
    expect(
      screen.getByRole("dialog", { name: "Farmer Health request photo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Preview of Photo 1" }),
    ).toHaveAttribute("src", "https://example.test/health-1.jpg");
    fireEvent.click(screen.getByRole("button", { name: "View next image" }));
    expect(
      screen.getByRole("img", { name: "Preview of Photo 2" }),
    ).toHaveAttribute("src", "https://example.test/health-2.jpg");
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
    fireEvent.click(
      await screen.findByRole("button", { name: "Record Health Assistance" }),
    );
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith(
        `/health-request/${requestId}/status`,
        { status: "in-progress" },
      ),
    );
    expect(first.onClose).not.toHaveBeenCalled();

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
          taskId,
        },
      ),
    );
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("starts a scheduled visit immediately when opened from the My Work service CTA", async () => {
    const scheduled = ownedRequest({
      status: "scheduled",
      scheduledDate: "2026-08-31T04:00:00.000Z",
      visitPeriod: "afternoon",
    });
    mocks.get.mockResolvedValue({ data: { data: scheduled } });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <HealthRequestActionModal
          isOpen
          startServiceOnOpen
          onClose={vi.fn()}
          task={{ ...task, status: "scheduled", raw: scheduled }}
          onSuccess={vi.fn()}
        />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith(
        `/health-request/${requestId}/status`,
        { status: "in-progress" },
      ),
    );
  });

  it("preserves same-request input and resets it when the request identity changes", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const onClose = vi.fn();
    const firstTask = { ...task, raw: ownedRequest() };
    mocks.get.mockResolvedValue({ data: { data: ownedRequest() } });
    const view = render(
      <QueryClientProvider client={queryClient}>
        <HealthRequestActionModal
          isOpen
          onClose={onClose}
          task={firstTask}
          onSuccess={vi.fn()}
        />
      </QueryClientProvider>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /^Give Advice/ }),
    );
    fireEvent.change(screen.getByLabelText("Advice for Farmer"), {
      target: { value: "Keep this advice" },
    });

    view.rerender(
      <QueryClientProvider client={queryClient}>
        <HealthRequestActionModal
          isOpen
          onClose={onClose}
          task={{ ...firstTask, raw: { ...firstTask.raw } }}
          onSuccess={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByLabelText("Advice for Farmer")).toHaveValue(
      "Keep this advice",
    );

    const nextRequestId = "507f1f77bcf86cd799439054";
    const nextRequest = ownedRequest({
      _id: nextRequestId,
      id: nextRequestId,
    });
    mocks.get.mockResolvedValue({ data: { data: nextRequest } });
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <HealthRequestActionModal
          isOpen
          onClose={onClose}
          task={{
            ...firstTask,
            workflowId: nextRequestId,
            raw: nextRequest,
          }}
          onSuccess={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole("button", { name: /^Give Advice/ }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /^Give Advice/ }));
    expect(screen.getByLabelText("Advice for Farmer")).toHaveValue("");
  });

  it("renders canonical Sick or Injured Animal and Unusual behavior instead of clinical Disease / Infection or Abnormal Behavior", async () => {
    const diseaseRequest = ownedRequest({
      requestType: "disease",
      requestDetails: {
        version: 1,
        assistanceRequested: "health_concern",
        observedSigns: ["abnormal_behavior"],
        farmerDescription: "Noticeable change in behavior.",
      },
    });
    renderModal(diseaseRequest);

    // Header badge & Assistance requested in details
    const badges = await screen.findAllByText("Sick or Injured Animal");
    expect(badges.length).toBeGreaterThanOrEqual(1);

    // Clinical Request Details section has Assistance Requested label and canonical value
    expect(screen.getByText("Assistance Requested")).toBeInTheDocument();
    expect(screen.getByText("Unusual behavior")).toBeInTheDocument();
    expect(screen.getByText("Noticeable change in behavior.")).toBeInTheDocument();

    // Clinical/stale copy should NOT be shown
    expect(screen.queryByText("Disease / Infection")).not.toBeInTheDocument();
    expect(screen.queryByText("Abnormal Behavior")).not.toBeInTheDocument();
  });

  it("renders canonical Medicine or Dewormer with subtype when present", async () => {
    const medicineRequest = ownedRequest({
      requestType: "medicine",
      subtype: "dewormer",
      requestDetails: {
        version: 1,
        assistanceRequested: "medicine_request",
        observedSigns: [],
        farmerDescription: "Need dewormer.",
      },
    });
    renderModal(medicineRequest);

    const medicineLabels = await screen.findAllByText("Medicine or Dewormer");
    expect(medicineLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Subtype")).toBeInTheDocument();
    expect(screen.getByText("Dewormer")).toBeInTheDocument();
  });

  it("safely renders legacy health request without structured details", async () => {
    const legacyRequest = ownedRequest({
      requestType: "disease",
      requestDetails: null,
      symptoms: "Sick or Injured Animal\nUnusual behavior",
    });
    renderModal(legacyRequest);

    const diseaseLabels = await screen.findAllByText("Sick or Injured Animal");
    expect(diseaseLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Assistance Requested")).toBeInTheDocument();
  });
});
