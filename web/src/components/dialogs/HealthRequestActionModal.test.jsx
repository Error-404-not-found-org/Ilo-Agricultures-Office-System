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
  default: ({ isOpen, title, subtitle, children, actions }) =>
    (
      <div role={isOpen ? "dialog" : undefined} aria-label={title}>
        {subtitle ? <p>{subtitle}</p> : null}
        <div>{children}</div>
        <footer>{actions}</footer>
      </div>
    ),
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
  it("reviews a pending cancellation without replacing the scheduled lifecycle", async () => {
    renderModal(ownedRequest({ status: "scheduled", cancellationStatus: "requested", cancellationReason: "Farmer unavailable", cancellationRequestedAt: "2026-09-20T02:15:00.000Z" }));
    expect(await screen.findByText("Cancellation Requested")).toBeInTheDocument();
    expect(screen.getByText("Farmer unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Scheduled Farm Visit/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep Request" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve Cancellation" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record Health Assistance" })).toBeNull();
  });

  it.each([[false, "rejected", "scheduled", "Keep Request"], [true, "approved", "cancelled", "Approve Cancellation"]])("responds to cancellation with approved=%s", async (approved, cancellationStatus, status, action) => {
    let current = ownedRequest({ status: "scheduled", cancellationStatus: "requested", cancellationReason: "Unavailable" });
    mocks.get.mockImplementation(() => Promise.resolve({ data: { data: current } }));
    mocks.patch.mockImplementation(() => { current = { ...current, status, cancellationStatus }; return Promise.resolve({ data: { data: current } }); });
    const { onClose, onSuccess } = renderModal(current, task, { preserveGetMock: true });
    fireEvent.click(await screen.findByRole("button", { name: action }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith(`/health-request/${requestId}/cancel-respond`, { approved }));
    await waitFor(() => expect(screen.queryByRole("button", { name: action })).toBeNull());
    if (approved) {
      await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
      expect(onSuccess).toHaveBeenCalled();
      expect(mocks.get).toHaveBeenCalledWith(`/health-request/${requestId}`);
    } else {
      expect(onClose).not.toHaveBeenCalled();
      expect(await screen.findByText(/Scheduled Farm Visit/)).toBeInTheDocument();
    }
  });

  it("keeps a cancellation failure visible in the modal", async () => {
    renderModal(ownedRequest({ status: "scheduled", cancellationStatus: "requested" }));
    mocks.patch.mockRejectedValueOnce({ response: { status: 500, data: { message: "Could not respond" } } });
    fireEvent.click(await screen.findByRole("button", { name: "Keep Request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not respond");
    expect(screen.getByRole("button", { name: "Keep Request" })).toBeEnabled();
  });

  it("keeps the modal open when approval fails", async () => {
    const { onClose } = renderModal(ownedRequest({ status: "scheduled", cancellationStatus: "requested" }));
    mocks.patch.mockRejectedValueOnce({ response: { status: 500, data: { message: "Approval failed" } } });
    fireEvent.click(await screen.findByRole("button", { name: "Approve Cancellation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Approval failed");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Approve Cancellation" })).toBeEnabled();
  });

  it("refreshes the authoritative state after a concurrent response", async () => {
    let current = ownedRequest({ status: "scheduled", cancellationStatus: "requested" });
    mocks.get.mockImplementation(() => Promise.resolve({ data: { data: current } }));
    mocks.patch.mockImplementationOnce(() => {
      current = { ...current, cancellationStatus: "rejected" };
      return Promise.reject({ response: { status: 409, data: { message: "Already handled" } } });
    });
    renderModal(current, task, { preserveGetMock: true });
    fireEvent.click(await screen.findByRole("button", { name: "Keep Request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Already handled");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Keep Request" })).toBeNull());
  });
  it("retains the active Health request data when closing clears the parent selection", async () => {
    const request = ownedRequest({
      status: "scheduled",
      requestType: "disease",
      farmerId: { _id: "farmer-a", name: "Farmer A" },
      animalId: { _id: "animal-a", earTag: "HEALTH-A" },
    });
    mocks.get.mockResolvedValue({ data: { data: request } });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const props = {
      onClose: vi.fn(),
      onSuccess: vi.fn(),
      task: { ...task, raw: request },
    };
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <HealthRequestActionModal isOpen {...props} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Farmer A")).toBeInTheDocument();
    expect(screen.getByText(/HEALTH-A/)).toBeInTheDocument();

    rerender(
      <QueryClientProvider client={client}>
        <HealthRequestActionModal
          {...props}
          isOpen={false}
          task={null}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Farmer A")).toBeInTheDocument();
    expect(screen.getByText(/HEALTH-A/)).toBeInTheDocument();
    expect(screen.queryByText("Not recorded")).toBeNull();
  });

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
    expect(
      screen.getByText(
        "Request claimed successfully. Please select a response method below.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Office Pickup/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Schedule Farm Visit/ }),
    ).toBeInTheDocument();
    expect(mocks.success).not.toHaveBeenCalledWith("Health request claimed");
  });

  it("keeps claim failures visible inside the open modal", async () => {
    const unclaimed = ownedRequest({
      status: "pending",
      handledBy: null,
      assignedTechnicianId: null,
    });
    mocks.patch.mockRejectedValueOnce({
      response: { data: { message: "This request was claimed by another technician." } },
    });
    renderModal(unclaimed, { ...task, status: "pending", raw: unclaimed });

    fireEvent.click(await screen.findByRole("button", { name: "Claim Request" }));

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("This request was claimed by another technician.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
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
    expect(screen.getByLabelText("Follow-up date")).toBeInTheDocument();
    expect(screen.queryByLabelText("Internal Note")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Follow-up date"), {
      target: { value: "2099-09-03" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Advice" }));

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith(
        `/health-request/${requestId}/advice`,
        {
          advice: "Keep the animal hydrated.",
          followUpDate: "2099-09-03",
        },
      ),
    );
    const payload = mocks.patch.mock.calls[0][1];
    expect(payload.scheduledDate).toBeUndefined();
    expect(payload.visitPeriod).toBeUndefined();
    expect(mocks.post).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith("Advice sent to farmer"),
    );
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
    expect(screen.getByLabelText("Dosage / Use instructions")).toBeInTheDocument();
    expect(screen.getByLabelText("Withdrawal guidance")).toBeInTheDocument();
    expect(screen.getByLabelText("Pickup follow-up date")).toBeInTheDocument();
    expect(screen.queryByLabelText("Pickup Internal Note")).not.toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText("Medication Given"), {
      target: { value: "Oxytetracycline" },
    });
    fireEvent.change(screen.getByLabelText("Dosage"), {
      target: { value: "10 mL" },
    });
    fireEvent.change(screen.getByLabelText("Withdrawal Period (Days)"), {
      target: { value: "7" },
    });
    fireEvent.change(screen.getByLabelText("Clinical Advice for Farmer"), {
      target: { value: "Monitor appetite." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Complete Service" }));
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith(
        `/health-request/${requestId}/status`,
        {
          status: "resolved",
          diagnosis: "Digestive infection",
          treatment: "Supportive treatment",
          medicineGiven: "Oxytetracycline",
          dosage: "10 mL",
          withdrawalPeriodDays: 7,
          advice: "Monitor appetite.",
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
    const inProgress = ownedRequest({
      status: "in-progress",
      scheduledDate: scheduled.scheduledDate,
      visitPeriod: scheduled.visitPeriod,
    });
    mocks.get
      .mockResolvedValueOnce({ data: { data: scheduled } })
      .mockResolvedValue({ data: { data: inProgress } });
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
    expect(await screen.findByText("Record Health Service")).toBeInTheDocument();
    expect(screen.getByLabelText("Diagnosis")).toBeInTheDocument();
    expect(screen.getByLabelText("Treatment")).toBeInTheDocument();
    expect(screen.getByLabelText("Medication Given")).toBeInTheDocument();
    expect(screen.getByLabelText("Dosage")).toBeInTheDocument();
    expect(screen.getByLabelText("Withdrawal Period (Days)")).toBeInTheDocument();
    expect(screen.getByLabelText("Clinical Advice for Farmer")).toBeInTheDocument();
    expect(mocks.success).not.toHaveBeenCalledWith("Health service started");
  });

  it("keeps start-service failures visible inside the open modal", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-31T05:00:00.000Z"));
    const scheduled = ownedRequest({
      status: "scheduled",
      scheduledDate: "2026-08-31T04:00:00.000Z",
      visitPeriod: "afternoon",
    });
    mocks.patch.mockRejectedValueOnce({
      response: { data: { message: "The Health visit could not be started." } },
    });
    renderModal(scheduled, { ...task, status: "scheduled", raw: scheduled });

    fireEvent.click(
      await screen.findByRole("button", { name: "Record Health Assistance" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The Health visit could not be started.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
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

  it("does not expose an Internal Note field in Farm Visit clinical recording", async () => {
    const inProgress = ownedRequest({ status: "in-progress" });
    renderModal(inProgress, {
      ...task,
      status: "in-progress",
      raw: inProgress,
    });

    await screen.findByLabelText("Diagnosis");
    expect(screen.queryByLabelText("Clinical Internal Note")).toBeNull();
  });

  it("presents an upcoming farm visit as scheduled work with rescheduling but no start action", async () => {
    const scheduled = ownedRequest({
      status: "scheduled",
      requestType: "disease",
      handlingMethod: "farm_visit",
      scheduledDate: "2099-12-01T04:00:00.000Z",
      visitPeriod: "afternoon",
      requestDetails: {
        version: 1,
        assistanceRequested: "health_concern",
        observedSigns: ["diarrhea"],
        farmerDescription: "Loose stool since yesterday.",
      },
      animalId: {
        _id: "animal-1",
        earTag: "03MC",
        species: "Cattle",
        breed: "Braford",
      },
    });
    renderModal(scheduled, {
      ...task,
      status: "scheduled",
      allowedAction: "VIEW_DETAILS",
      workTiming: "upcoming",
      raw: scheduled,
    });

    expect(
      await screen.findByRole("dialog", { name: "Scheduled Health Visit" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Scheduled visit details")).toBeInTheDocument();
    expect(await screen.findByText("Diarrhea")).toBeInTheDocument();
    expect(screen.queryByText("Recorded workflow summary")).toBeNull();
    expect(screen.queryByText(/^disease$/i)).toBeNull();
    expect(screen.getAllByText("Sick or Injured Animal").length).toBeGreaterThan(0);
    expect(screen.getByText("December 1, 2099 · Afternoon")).toBeInTheDocument();
    expect(screen.getAllByText("Farm Visit")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Reschedule Visit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record Health Assistance" })).toBeNull();
  });

  it("reschedules upcoming work through the canonical scheduled status endpoint", async () => {
    const scheduled = ownedRequest({
      status: "scheduled",
      handlingMethod: "farm_visit",
      scheduledDate: "2099-12-01T04:00:00.000Z",
      visitPeriod: "afternoon",
    });
    renderModal(scheduled, {
      ...task,
      status: "scheduled",
      allowedAction: "VIEW_DETAILS",
      workTiming: "upcoming",
      raw: scheduled,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Reschedule Visit" }),
    );
    fireEvent.change(screen.getByLabelText("Visit date"), {
      target: { value: "2099-12-02" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Morning" }));
    fireEvent.click(screen.getByRole("button", { name: "Save New Visit" }));

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith(
        `/health-request/${requestId}/status`,
        {
          status: "scheduled",
          scheduledDate: "2099-12-02",
          visitPeriod: "morning",
        },
      ),
    );
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("allows completing treatment without medication or dosage", async () => {
    const inProgress = ownedRequest({ status: "in-progress" });
    renderModal(inProgress, {
      ...task,
      status: "in-progress",
      raw: inProgress,
    });

    fireEvent.change(await screen.findByLabelText("Diagnosis"), {
      target: { value: "Minor wound" },
    });
    fireEvent.change(screen.getByLabelText("Treatment"), {
      target: { value: "Wound cleaning" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Complete Service" }));

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith(
        `/health-request/${requestId}/status`,
        {
          status: "resolved",
          diagnosis: "Minor wound",
          treatment: "Wound cleaning",
          taskId,
        },
      ),
    );
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
