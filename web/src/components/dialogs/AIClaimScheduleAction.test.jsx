import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  patch: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../../lib/axios", () => ({
  default: { patch: mocks.patch },
}));

vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));

import AIRequestModal from "./AIClaimScheduleAction";

const requestQueryKey = ["technician", "requests", "pending"];

const request = {
  id: "legacy-visible-id",
  workflowId: "507f1f77bcf86cd799439001",
  taskId: "507f1f77bcf86cd799439099",
  workflowType: "AI",
  allowedAction: "CLAIM_AND_SCHEDULE",
  actionLabel: "Claim & Set Visit",
  serviceLabel: "AI Service",
  status: "pending",
  farmer: "Maria Santos",
  farmerPhone: "09171234567",
  animalName: "Bessie",
  animalTag: "EAR-17",
  location: "San Roque, Iloilo City",
  heatSigns: ["Standing heat", "Clear mucus"],
  requestSubmissionDate: "2026-08-04T01:00:00.000Z",
  attachments: { count: 1, urls: ["https://example.test/heat.jpg"] },
  schedule: { date: null, visitPeriod: null },
};

const secondRequest = {
  ...request,
  id: "second-visible-id",
  workflowId: "507f1f77bcf86cd799439002",
  farmer: "Elena Cruz",
  animalName: "Daisy",
  animalTag: "EAR-22",
};

const ModalHarness = ({ initialRequest = request, initialView = "details" }) => {
  const [modalState, setModalState] = useState({
    request: initialRequest,
    view: initialView,
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setModalState({ request, view: "schedule" })}
      >
        Reopen first schedule
      </button>
      <button
        type="button"
        onClick={() => setModalState({ request: secondRequest, view: "schedule" })}
      >
        Open second schedule
      </button>
      <AIRequestModal
        key={modalState.request?.workflowId || "closed-ai-request"}
        modalState={modalState}
        requestQueryKey={requestQueryKey}
        onClose={() =>
          setModalState({ request: null, view: "details" })
        }
        onViewChange={(view) =>
          setModalState((current) => ({ ...current, view }))
        }
      />
    </>
  );
};

const renderModal = (props = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi
    .spyOn(queryClient, "invalidateQueries")
    .mockResolvedValue();

  render(
    <QueryClientProvider client={queryClient}>
      <ModalHarness {...props} />
    </QueryClientProvider>,
  );

  return { invalidate };
};

const chooseTodayAndMorning = () => {
  fireEvent.click(screen.getByLabelText("Today"));
  fireEvent.click(screen.getByLabelText("Morning"));
};

describe("Unified AI Request modal", () => {
  beforeEach(() => {
    mocks.patch.mockReset();
    mocks.success.mockReset();
    mocks.error.mockReset();
  });

  it("shows complete details and changes the same modal to schedule", () => {
    renderModal();

    const detailsDialog = screen.getByRole("dialog", {
      name: "AI Request Details",
    });
    expect(detailsDialog).toHaveTextContent("Maria Santos");
    expect(detailsDialog).toHaveTextContent("09171234567");
    expect(detailsDialog).toHaveTextContent("Bessie · Tag EAR-17");
    expect(detailsDialog).toHaveTextContent("San Roque, Iloilo City");
    expect(detailsDialog).toHaveTextContent("Standing heat");
    expect(detailsDialog).toHaveTextContent("Clear mucus");
    expect(detailsDialog).toHaveTextContent("August 4, 2026");
    expect(detailsDialog).toHaveTextContent("1 attachment");
    expect(detailsDialog).toHaveTextContent("Pending");
    const attachment = within(detailsDialog).getByRole("img", {
      name: "AI request attachment 1",
    });
    expect(attachment).toHaveAttribute("src", "https://example.test/heat.jpg");
    expect(
      within(detailsDialog).getByRole("link", {
        name: "Open request image 1",
      }),
    ).toHaveAttribute("href", "https://example.test/heat.jpg");
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
  });

  it("returns to details in the same modal and cancels without mutation", () => {
    renderModal({ initialView: "schedule" });
    const scheduleDialog = screen.getByRole("dialog", {
      name: "Claim & Set Visit",
    });

    fireEvent.click(screen.getByRole("button", { name: "Back to Details" }));
    expect(
      screen.getByRole("dialog", { name: "AI Request Details" }),
    ).toBe(scheduleDialog);

    fireEvent.click(
      within(scheduleDialog).getByRole("button", {
        name: "Claim & Set Visit",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("confirms once through workflowId with only canonical payload fields", async () => {
    mocks.patch.mockResolvedValue({ data: { request: { status: "scheduled" } } });
    const { invalidate } = renderModal({ initialView: "schedule" });
    chooseTodayAndMorning();

    fireEvent.click(screen.getByRole("button", { name: "Confirm Schedule" }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledOnce());
    const [url, payload] = mocks.patch.mock.calls[0];
    expect(url).toBe(
      "/ai-request/507f1f77bcf86cd799439001/claim-and-schedule",
    );
    expect(Object.keys(payload).sort()).toEqual([
      "scheduledDate",
      "visitPeriod",
    ]);
    expect(payload.scheduledDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload.visitPeriod).toBe("morning");
    expect(url).not.toContain(request.taskId);
    expect(url).not.toContain(request.id);

    await waitFor(() => {
      expect(mocks.success).toHaveBeenCalledOnce();
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: requestQueryKey,
        exact: true,
      });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["technician", "work-queue", "mine"],
        exact: true,
      });
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("blocks duplicate confirmation while the first request is pending", async () => {
    let resolveRequest;
    mocks.patch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    renderModal({ initialView: "schedule" });
    chooseTodayAndMorning();

    const confirm = screen.getByRole("button", { name: "Confirm Schedule" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(mocks.patch).toHaveBeenCalledOnce();

    await act(async () => {
      resolveRequest({ data: { request: { status: "scheduled" } } });
    });
  });

  it("resets schedule form after close and when another request is selected", () => {
    renderModal({ initialView: "schedule" });
    fireEvent.click(screen.getByLabelText("Custom date"));
    fireEvent.change(screen.getByLabelText("Custom visit date"), {
      target: { value: "2026-08-08" },
    });
    fireEvent.click(screen.getByLabelText("Afternoon"));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Reopen first schedule" }),
    );
    expect(screen.getByLabelText("Custom date")).not.toBeChecked();
    expect(screen.getByLabelText("Afternoon")).not.toBeChecked();

    fireEvent.click(screen.getByLabelText("Tomorrow"));
    fireEvent.click(screen.getByLabelText("Morning"));
    fireEvent.click(
      screen.getByRole("button", { name: "Open second schedule" }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("Elena Cruz");
    expect(screen.getByLabelText("Tomorrow")).not.toBeChecked();
    expect(screen.getByLabelText("Morning")).not.toBeChecked();
    expect(mocks.patch).not.toHaveBeenCalled();
  });
});
