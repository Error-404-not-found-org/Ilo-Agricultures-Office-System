import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../../lib/axios", () => ({
  default: {
    get: mocks.get,
    post: mocks.post,
    patch: mocks.patch,
  },
}));

vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));

vi.mock("./RegisterFarmerModal", () => ({ default: () => null }));
vi.mock("./RegisterLivestockModal", () => ({ default: () => null }));

import AIServiceModal from "./AIServiceModal";

const workflowId = "507f1f77bcf86cd799439001";
const taskId = "507f1f77bcf86cd799439099";
const farmerId = "507f1f77bcf86cd799439010";
const animalId = "507f1f77bcf86cd799439020";

const requestContext = {
  workflowId,
  taskId,
  workflowType: "AI",
  farmer: {
    id: farmerId,
    name: "Maria Santos",
    phone: "09171234567",
    location: "San Roque, Oton",
  },
  animal: { id: animalId, name: "Bessie", earTag: "EAR-17" },
  location: "San Roque, Oton",
  requestedAt: "2026-08-04T01:00:00.000Z",
  schedule: {
    date: "2026-08-08T04:00:00.000Z",
    visitPeriod: "afternoon",
  },
};

const defaultProps = {
  isOpen: true,
  context: "task",
  workflowId,
  taskId,
  requestContext,
  taskData: {
    heatSigns: ["Standing heat", "Clear mucus"],
    imageUrl: "https://example.test/heat.jpg",
  },
  preSelectedFarmer: {
    _id: farmerId,
    name: "Maria Santos",
    phoneNumber: "09171234567",
  },
  preSelectedAnimal: {
    _id: animalId,
    name: "Bessie",
    earTag: "EAR-17",
    species: "Cattle",
  },
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

const renderModal = (overrides = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi
    .spyOn(queryClient, "invalidateQueries")
    .mockResolvedValue();
  const props = { ...defaultProps, ...overrides };

  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AIServiceModal {...props} />
      </QueryClientProvider>
    </MemoryRouter>,
  );

  return { invalidate, props };
};

const fillRequiredFields = () => {
  fireEvent.change(screen.getByLabelText("Sire breed"), {
    target: { value: "Holstein" },
  });
  fireEvent.change(screen.getByLabelText("Sire code"), {
    target: { value: "H-42" },
  });
};

const renderDirectModal = (serviceContext = { mode: "walk_in" }) => {
  const farmer = defaultProps.preSelectedFarmer;
  const animal = {
    ...defaultProps.preSelectedAnimal,
    gender: "Female",
    birthDate: "2020-01-01",
    reproductiveStatus: "Normal",
  };
  mocks.get.mockImplementation(async (url) => {
    if (url === "/config") return { data: {} };
    if (url === "/user?role=farmer") return { data: [farmer] };
    if (url === `/animals/farmer/${farmerId}`) return { data: [animal] };
    if (url === "/technician/ai-service-context") {
      return { data: serviceContext };
    }
    throw new Error(`Unexpected GET ${url}`);
  });

  return renderModal({
    context: "walk-in",
    existingOnly: true,
    workflowId: null,
    taskId: null,
    requestContext: null,
    taskData: null,
    preSelectedFarmer: farmer,
    preSelectedAnimal: animal,
  });
};

describe("request-linked AI recording modal", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.post.mockReset();
    mocks.patch.mockReset();
    mocks.success.mockReset();
    mocks.error.mockReset();
    defaultProps.onClose.mockReset();
    defaultProps.onSuccess.mockReset();
  });

  it("opens with canonical request context and sends no HTTP request", async () => {
    renderModal();

    expect(screen.getByText("Maria Santos")).toBeInTheDocument();
    expect(screen.getByText("Bessie · Tag EAR-17")).toBeInTheDocument();
    expect(screen.getByText("09171234567")).toBeInTheDocument();
    expect(screen.getByText("Standing heat, Clear mucus")).toBeInTheDocument();
    expect(screen.getByText("August 8, 2026 · Afternoon")).toBeInTheDocument();
    expect(screen.getByText("1 attachment submitted")).toBeInTheDocument();
    expect(screen.getByLabelText("Number of semen doses used")).toHaveValue(1);

    await waitFor(() => expect(mocks.get).not.toHaveBeenCalled());
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("records the selected workflow without creating a second walk-in record", async () => {
    mocks.post.mockResolvedValue({ data: { outcome: "request_completed" } });
    const { invalidate } = renderModal();
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("Technician notes"), {
      target: { value: "  Service completed normally.  " },
    });

    const save = screen.getByRole("button", { name: "Save AI service" });
    fireEvent.click(save);
    fireEvent.click(save);

    await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
    const [url, payload] = mocks.post.mock.calls[0];
    expect(url).toBe("/technician/walk-in-insemination");
    expect(payload.requestId).toBe(workflowId);
    expect(payload.taskId).toBe(taskId);
    expect(payload.farmerId).toBe(farmerId);
    expect(payload.animalId).toBe(animalId);
    expect(payload.inseminationDetails).toMatchObject({
      sireBreed: "Holstein",
      sireCode: "H-42",
      semenDosesUsed: 1,
      estrus: "Natural",
      technicianNote: "Service completed normally.",
    });
    expect(mocks.post.mock.calls).toHaveLength(1);

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["technician", "work-queue", "mine"],
      });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["technician", "inseminations-list"],
      });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["animal-history", animalId],
        exact: true,
      });
    });
  });

  it("records successfully when the linked taskId is absent", async () => {
    mocks.post.mockResolvedValue({ data: { outcome: "request_completed" } });
    renderModal({ taskId: null, requestContext: { ...requestContext, taskId: null } });
    fillRequiredFields();

    fireEvent.click(screen.getByRole("button", { name: "Save AI service" }));

    await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
    const payload = mocks.post.mock.calls[0][1];
    expect(payload.requestId).toBe(workflowId);
    expect(payload).not.toHaveProperty("taskId");
  });

  it("accepts a manually entered sire breed and requires a nonblank sire code", async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText("Sire breed"), {
      target: { value: "Locally recorded crossbreed" },
    });
    fireEvent.change(screen.getByLabelText("Sire code"), {
      target: { value: "   " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save AI service" }));

    expect(await screen.findByText("Enter the sire code.")).toBeInTheDocument();
    expect(screen.getByLabelText("Sire breed")).toHaveValue(
      "Locally recorded crossbreed",
    );
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each(["0", "1.5", "-2"])(
    "blocks invalid semen dose value %s",
    async (value) => {
      renderModal();
      fillRequiredFields();
      fireEvent.change(screen.getByLabelText("Number of semen doses used"), {
        target: { value },
      });

      fireEvent.click(screen.getByRole("button", { name: "Save AI service" }));

      expect(
        await screen.findByText(
          "Number of semen doses must be a whole number of at least 1.",
        ),
      ).toBeInTheDocument();
      expect(mocks.post).not.toHaveBeenCalled();
    },
  );

  it("blocks a malformed workflowId before submission", async () => {
    renderModal({ workflowId: "not-an-id" });
    fillRequiredFields();

    fireEvent.click(screen.getByRole("button", { name: "Save AI service" }));

    expect(
      await screen.findByText(
        "This AI work item has an invalid workflow identifier.",
      ),
    ).toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each([
    [
      { response: { status: 409, data: { code: "CONCURRENCY_CONFLICT" } } },
      "This workflow changed while you were recording it. Refresh My Work and try again.",
    ],
    [
      { response: { status: 403, data: {} } },
      "You are not authorized to record this AI workflow.",
    ],
  ])("shows canonical recording errors", async (error, message) => {
    mocks.post.mockRejectedValue(error);
    renderModal();
    fillRequiredFields();

    fireEvent.click(screen.getByRole("button", { name: "Save AI service" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("keeps the dashboard walk-in action limited to existing farmer and animal records", async () => {
    mocks.get.mockImplementation(async (url) => {
      if (url === "/config") return { data: {} };
      if (url === "/user?role=farmer") return { data: [] };
      throw new Error(`Unexpected GET ${url}`);
    });

    renderModal({
      context: "walk-in",
      existingOnly: true,
      workflowId: null,
      taskId: null,
      requestContext: null,
      taskData: null,
      preSelectedFarmer: null,
      preSelectedAnimal: null,
    });

    fireEvent.focus(screen.getByPlaceholderText("Name, phone, or barangay"));

    expect(await screen.findByText("No matching registered farmer is available for this service.")).toBeInTheDocument();
    expect(screen.getByLabelText("Sire breed")).toBeVisible();
    expect(screen.getByLabelText("Sire breed")).toBeDisabled();
    expect(screen.getByLabelText("Number of semen doses used")).toBeVisible();
    expect(screen.getByLabelText("Technician notes")).toBeVisible();
    expect(
      screen.getByText(
        "Select a registered farmer and animal to enable the AI service fields.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /register farmer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /register animal/i })).not.toBeInTheDocument();
  });

  it("records current direct AI through the canonical direct endpoint", async () => {
    mocks.post.mockResolvedValue({ data: { outcome: "direct_recorded" } });
    renderDirectModal();

    expect(screen.getByRole("tab", { name: "Record AI Now" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Add Past Record" })).toBeVisible();
    fillRequiredFields();

    const save = screen.getByRole("button", { name: "Save AI service" });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
    const [url, payload] = mocks.post.mock.calls[0];
    expect(url).toBe("/technician/walk-in-insemination");
    expect(payload).toMatchObject({ farmerId, animalId });
    expect(payload).not.toHaveProperty("entryMode");
    expect(screen.queryByText(/walk-in service available/i)).not.toBeInTheDocument();
  });

  it("adds a past AI record with its actual historical date and entry mode", async () => {
    mocks.post.mockResolvedValue({ data: { outcome: "history_added" } });
    renderDirectModal();

    fireEvent.click(screen.getByRole("tab", { name: "Add Past Record" }));
    fireEvent.click(screen.getByRole("radio", { name: /continue tracking/i }));
    fireEvent.change(screen.getByLabelText("Actual insemination date"), {
      target: { value: "2025-04-03" },
    });
    fireEvent.change(screen.getByLabelText("Actual insemination time"), {
      target: { value: "09:15" },
    });
    fillRequiredFields();

    const save = screen.getByRole("button", { name: "Add past record" });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
    const [url, payload] = mocks.post.mock.calls[0];
    expect(url).toBe("/technician/previous-insemination");
    expect(payload.entryMode).toBe("continue_tracking");
    expect(payload.inseminationDetails).toMatchObject({
      inseminationDate: "2025-04-03",
      time: "09:15",
    });
    expect(payload).not.toHaveProperty("requestId");
    expect(payload).not.toHaveProperty("taskId");
  });

  it("keeps an active AI request linked to Requests for Record AI Now", async () => {
    renderDirectModal({
      mode: "blocked",
      blockedReason: "Continue through the existing request.",
      activeRequest: {
        requestId: workflowId,
        status: "approved",
        assignment: "assigned_to_you",
      },
      allowedActions: ["open_request"],
    });

    expect(await screen.findByText("Active AI request found")).toBeVisible();
    expect(screen.getByRole("button", { name: "Schedule request" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Save AI service" })).toBeDisabled();
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
