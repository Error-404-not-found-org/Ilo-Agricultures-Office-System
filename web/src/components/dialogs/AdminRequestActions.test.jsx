import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  reassign: vi.fn(),
  invalidateReassignment: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../../lib/axios", () => ({
  default: { get: mocks.get, post: mocks.post, patch: mocks.patch },
}));
vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error, promise: vi.fn() },
}));
vi.mock("framer-motion", async () => {
  const React = await import("react");
  return {
    AnimatePresence: ({ children }) => children,
    motion: {
      div: React.forwardRef((props, ref) => {
        const elementProps = { ...props };
        delete elementProps.initial;
        delete elementProps.animate;
        delete elementProps.exit;
        return <div ref={ref} {...elementProps} />;
      }),
    },
  };
});
vi.mock("../../services/adminRequestsService", () => ({
  reassignRequest: mocks.reassign,
  invalidateAdminReassignmentQueries: mocks.invalidateReassignment,
}));

import RequestActionModal from "./RequestActionModal";

const technician = { _id: "technician-2", name: "Technician Two" };

function renderDialog(dialog) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
  return render(
    <QueryClientProvider client={queryClient}>{dialog}</QueryClientProvider>,
  );
}

function chooseOption(select, value) {
  const selectedIndex = Array.from(select.options).findIndex(
    (option) => option.value === value,
  );
  expect(selectedIndex).toBeGreaterThan(-1);
  select.selectedIndex = selectedIndex;
}

describe("Admin request actions", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.get.mockResolvedValue({ data: [technician] });
    mocks.post.mockResolvedValue({ data: { request: { _id: "request-1" } } });
    mocks.reassign.mockResolvedValue({ data: { request: { _id: "request-1" } } });
    mocks.invalidateReassignment.mockResolvedValue();
  });

  it("reassigns AI from the Admin Requests dialog without exposing field actions", async () => {
    renderDialog(
      <RequestActionModal
        isOpen
        role="admin"
        onClose={vi.fn()}
        task={{
          id: "ai-1",
          type: "insemination",
          status: "scheduled",
          farmer: "Maria Farmer",
          raw: {
            _id: "ai-1",
            approvedBy: { _id: "technician-1", name: "Technician One" },
          },
        }}
      />,
    );

    const requestTechnician = await screen.findByLabelText("Reassign to");
    await screen.findByRole("option", { name: technician.name });
    chooseOption(requestTechnician, technician._id);
    await waitFor(() => expect(requestTechnician).toHaveValue(technician._id));
    expect(screen.queryByRole("button", { name: /claim/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reassign Technician" }));

    await waitFor(() =>
      expect(mocks.reassign).toHaveBeenCalledWith({
        type: "insemination",
        requestId: "ai-1",
        technicianId: technician._id,
      }),
    );
  });

  it("keeps backend-supported cancellation review available to Admin", async () => {
    renderDialog(
      <RequestActionModal
        isOpen
        role="admin"
        onClose={vi.fn()}
        task={{
          id: "health-2",
          type: "health",
          status: "scheduled",
          cancellationStatus: "requested",
          cancellationReason: "Farmer is unavailable",
          raw: { handledBy: { _id: "technician-1", name: "Technician One" } },
        }}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Approve cancellation" }));

    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith(
        "/health-request/health-2/cancel-respond",
        { approved: true, reason: undefined },
      ),
    );
  });

  it("preserves Technician execution actions in the shared request dialog", async () => {
    renderDialog(
      <RequestActionModal
        isOpen
        role="technician"
        onClose={vi.fn()}
        task={{
          id: "health-3",
          type: "health",
          status: "scheduled",
          farmer: "Maria Farmer",
          raw: {
            handledBy: { _id: "technician-2", name: "Technician Two" },
          },
        }}
      />,
    );

    expect(
      await screen.findByRole("button", { name: "Start visit" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Reassign Technician" }),
    ).not.toBeInTheDocument();
  });
});
