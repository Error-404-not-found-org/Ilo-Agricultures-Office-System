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
  species: "Cattle",
  breed: "Holstein",
  location: "San Roque, Iloilo City",
  heatSigns: ["standingHeat", "clear_mucus"],
  taskDetails: "Observed standing heat this morning.",
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

const chooseTomorrowAndMorning = () => {
  fireEvent.click(screen.getByLabelText("Tomorrow"));
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
    expect(detailsDialog).toHaveTextContent("Cattle · Holstein");
    expect(detailsDialog).toHaveTextContent("San Roque, Iloilo City");
    expect(detailsDialog).toHaveTextContent("Standing Heat, Clear Mucus");
    expect(detailsDialog).toHaveTextContent(
      "Observed standing heat this morning.",
    );
    expect(detailsDialog).toHaveTextContent("August 4, 2026");
    expect(detailsDialog).toHaveTextContent("Farmer request photos (1)");
    expect(detailsDialog).toHaveTextContent("Pending");
    const attachment = within(detailsDialog).getByRole("img", {
      name: "Farmer-submitted AI request photo 1",
    });
    expect(attachment).toHaveAttribute("src", "https://example.test/heat.jpg");
    fireEvent.click(
      within(detailsDialog).getByRole("button", {
        name: "Enlarge request image 1",
      }),
    );
    expect(
      screen.getByRole("img", {
        name: "Enlarged Farmer-submitted AI request",
      }),
    ).toHaveAttribute("src", "https://example.test/heat.jpg");
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "Farmer request photo" }),
      ).getByRole("button", { name: "Close" }),
    );
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

  it("renders all unique request photos with historical imageUrl fallback", () => {
    const multiImageRequest = {
      ...request,
      photos: [
        "https://example.test/one.jpg",
        "https://example.test/two.jpg",
      ],
      imageUrl: "https://example.test/one.jpg",
      attachments: {
        count: 3,
        urls: [
          "https://example.test/one.jpg",
          "https://example.test/three.jpg",
        ],
      },
    };
    renderModal({ initialRequest: multiImageRequest });

    const detailsDialog = screen.getByRole("dialog", {
      name: "AI Request Details",
    });
    expect(
      within(detailsDialog).getAllByRole("img", {
        name: /Farmer-submitted AI request photo/,
      }),
    ).toHaveLength(3);
    expect(detailsDialog).toHaveTextContent("Farmer request photos (3)");
  });

  it("renders a historical imageUrl-only request once", () => {
    renderModal({
      initialRequest: {
        ...request,
        imageUrl: "https://example.test/historical.jpg",
        attachments: undefined,
      },
    });

    const detailsDialog = screen.getByRole("dialog", {
      name: "AI Request Details",
    });
    expect(
      within(detailsDialog).getAllByRole("img", {
        name: /Farmer-submitted AI request photo/,
      }),
    ).toHaveLength(1);
    expect(detailsDialog).toHaveTextContent("Farmer request photos (1)");
  });

  it("shows a safe empty state when no request photo exists", () => {
    renderModal({
      initialRequest: {
        ...request,
        imageUrl: undefined,
        photos: [],
        attachments: undefined,
      },
    });

    const detailsDialog = screen.getByRole("dialog", {
      name: "AI Request Details",
    });
    expect(detailsDialog).toHaveTextContent("Farmer request photos (0)");
    expect(detailsDialog).toHaveTextContent("No request photos submitted.");
    expect(
      within(detailsDialog).queryByRole("img", {
        name: /Farmer-submitted AI request photo/,
      }),
    ).not.toBeInTheDocument();
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
    chooseTomorrowAndMorning();

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
      });
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("requires current-period confirmation and sends the canonical acknowledgement", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-31T07:00:00.000Z"));
    mocks.patch.mockResolvedValue({ data: { request: { status: "scheduled" } } });

    try {
      renderModal({ initialView: "schedule" });
      fireEvent.click(screen.getByLabelText("Today"));
      expect(screen.getByLabelText("Morning")).toBeDisabled();
      fireEvent.click(screen.getByLabelText("Afternoon"));

      fireEvent.click(screen.getByRole("button", { name: "Confirm Schedule" }));
      expect(mocks.patch).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Confirm that you can still attend during this current service period.",
      );

      fireEvent.click(
        screen.getByLabelText(
          "I confirm I can still attend during this current service period.",
        ),
      );
      fireEvent.click(screen.getByRole("button", { name: "Confirm Schedule" }));

      await waitFor(() => expect(mocks.patch).toHaveBeenCalledOnce());
      expect(mocks.patch.mock.calls[0][1]).toEqual({
        scheduledDate: "2026-08-31",
        visitPeriod: "afternoon",
        samePeriodConfirmed: true,
      });
    } finally {
      vi.useRealTimers();
    }
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
    chooseTomorrowAndMorning();

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
