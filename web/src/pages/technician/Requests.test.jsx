import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../../lib/axios", () => ({
  default: { get: mocks.get, patch: mocks.patch },
}));

vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));

vi.mock("../../components/layout/Topbar", () => ({
  default: ({ title }) => <div>{title}</div>,
}));

vi.mock("../../components/dialogs/RequestActionModal", () => ({
  default: ({ isOpen, task }) =>
    isOpen ? (
      <div data-testid="legacy-request-modal">{task?.workflowType}</div>
    ) : null,
}));

import Requests from "./Requests";

const aiWorkflowId = "507f1f77bcf86cd799439001";
const farmerId = "507f1f77bcf86cd799439010";
const animalId = "507f1f77bcf86cd799439020";

const aiRequest = {
  id: aiWorkflowId,
  workflowId: aiWorkflowId,
  taskId: null,
  workflowType: "AI",
  type: "ai",
  serviceType: "Artificial Insemination",
  status: "pending",
  allowedAction: "CLAIM_AND_SCHEDULE",
  actionLabel: "Claim & Set Visit",
  farmer: {
    id: farmerId,
    name: "Maria Santos",
    phone: "09171234567",
    location: "San Roque, Oton",
  },
  animal: { id: animalId, name: "Bessie", earTag: "EAR-17" },
  earTag: "EAR-17",
  breed: "Holstein",
  phone: "09171234567",
  location: "San Roque, Oton",
  locationLabel: "San Roque, Oton",
  heatSigns: ["Standing heat", "Clear mucus"],
  requestSubmissionDate: "2026-08-04T01:00:00.000Z",
  createdAt: "2026-08-04T01:00:00.000Z",
  attachments: { count: 1, urls: ["https://example.test/heat.jpg"] },
  schedule: { date: null, visitPeriod: null },
  raw: {
    _id: aiWorkflowId,
    farmerId: { _id: farmerId, name: "Maria Santos", phoneNumber: "09171234567" },
    animalId: { _id: animalId, name: "Bessie", earTag: "EAR-17" },
    heatSigns: ["Standing heat", "Clear mucus"],
  },
};

const healthRequest = {
  ...aiRequest,
  id: "507f1f77bcf86cd799439002",
  workflowId: "507f1f77bcf86cd799439002",
  workflowType: "Health",
  type: "health",
  serviceType: "Health Assistance",
  allowedAction: "CLAIM",
  actionLabel: "Claim",
  farmer: { ...aiRequest.farmer, name: "Elena Cruz" },
  raw: {
    ...aiRequest.raw,
    _id: "507f1f77bcf86cd799439002",
    requestType: "Treatment",
    symptoms: "Low appetite",
  },
};

const renderRequests = (items = [aiRequest, healthRequest]) => {
  mocks.get.mockImplementation((url) => {
    if (url === "/technician/profile") {
      return Promise.resolve({ data: { _id: "technician-1" } });
    }
    if (url === "/technician/requests") {
      return Promise.resolve({
        data: {
          requests: items,
          pagination: { total: items.length, totalPages: 1 },
        },
      });
    }
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <Requests />
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

describe("Technician Requests unified AI modal", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("opens row details and changes the same modal to schedule", async () => {
    renderRequests();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Open AI Service request for Maria Santos",
      }, { timeout: 5000 }),
    );

    const detailsDialog = screen.getByRole("dialog", {
      name: "AI Request Details",
    });
    expect(screen.queryByTestId("legacy-request-modal")).not.toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(mocks.patch).not.toHaveBeenCalled();

    fireEvent.click(
      within(detailsDialog).getByRole("button", {
        name: "Claim & Set Visit",
      }),
    );
    const scheduleDialog = screen.getByRole("dialog", {
      name: "Claim & Set Visit",
    });
    expect(scheduleDialog).toBe(detailsDialog);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(mocks.patch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Back to Details" }));
    expect(
      screen.getByRole("dialog", { name: "AI Request Details" }),
    ).toBe(detailsDialog);
  });

  it("opens the row action directly in schedule and stops row propagation", async () => {
    const stopPropagation = vi.spyOn(Event.prototype, "stopPropagation");
    renderRequests([aiRequest]);

    fireEvent.click(
      await screen.findByRole(
        "button",
        { name: "Claim & Scheduled" },
        { timeout: 5000 },
      ),
    );

    expect(stopPropagation).toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Claim & Set Visit" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "AI Request Details" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("legacy-request-modal")).not.toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(mocks.patch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(mocks.patch).not.toHaveBeenCalled();
    stopPropagation.mockRestore();
  });

  it("leaves the Health request details workflow unchanged", async () => {
    renderRequests([healthRequest]);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Open Health Assistance request for Elena Cruz",
      }, { timeout: 5000 }),
    );

    expect(screen.getByTestId("legacy-request-modal")).toHaveTextContent(
      "Health",
    );
    expect(
      screen.queryByRole("dialog", { name: "AI Request Details" }),
    ).not.toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();
  });
});
