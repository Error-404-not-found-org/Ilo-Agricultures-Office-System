import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

import AIClaimScheduleAction from "./AIClaimScheduleAction";

const requestQueryKey = [
  "technician",
  "requests",
  "pending",
  "ai",
  "all",
  "unassigned",
  "newest",
  "",
  "",
  undefined,
  undefined,
  "",
  1,
  null,
];

const request = {
  id: "legacy-visible-id",
  workflowId: "507f1f77bcf86cd799439001",
  taskId: "507f1f77bcf86cd799439099",
  workflowType: "AI",
  allowedAction: "CLAIM_AND_SCHEDULE",
  actionLabel: "Claim & Set Visit",
  serviceLabel: "AI Service",
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

const renderAction = (overrides = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi
    .spyOn(queryClient, "invalidateQueries")
    .mockResolvedValue();

  render(
    <QueryClientProvider client={queryClient}>
      <AIClaimScheduleAction
        request={{ ...request, ...overrides }}
        requestQueryKey={requestQueryKey}
      />
    </QueryClientProvider>,
  );

  return { queryClient, invalidate };
};

const openModal = () => {
  fireEvent.click(screen.getByRole("button", { name: "Claim & Set Visit" }));
  return screen.getByRole("dialog", { name: "Claim & Set Visit" });
};

const chooseTodayAndMorning = () => {
  fireEvent.click(screen.getByLabelText("Today"));
  fireEvent.click(screen.getByLabelText("Morning"));
};

describe("AI Claim & Set Visit", () => {
  beforeEach(() => {
    mocks.patch.mockReset();
    mocks.success.mockReset();
    mocks.error.mockReset();
  });

  it("uses the backend action label and opens or closes without a mutation", () => {
    renderAction();

    expect(
      screen.getByRole("button", { name: "Claim & Set Visit" }),
    ).toBeInTheDocument();
    const dialog = openModal();
    expect(dialog).toHaveTextContent("Artificial Insemination");
    expect(dialog).toHaveTextContent("Maria Santos");
    expect(dialog).toHaveTextContent("09171234567");
    expect(dialog).toHaveTextContent("Bessie · Tag EAR-17");
    expect(dialog).toHaveTextContent("Standing heat, Clear mucus");
    expect(dialog).toHaveTextContent("1 attachment");
    expect(mocks.patch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: "Claim & Set Visit" }),
    ).not.toBeInTheDocument();
  });

  it("supports Today, Tomorrow, Custom date, Morning, and Afternoon", () => {
    renderAction();
    openModal();

    fireEvent.click(screen.getByLabelText("Today"));
    expect(screen.getByLabelText("Today")).toBeChecked();

    fireEvent.click(screen.getByLabelText("Tomorrow"));
    expect(screen.getByLabelText("Tomorrow")).toBeChecked();

    fireEvent.click(screen.getByLabelText("Custom date"));
    expect(screen.getByLabelText("Custom date")).toBeChecked();
    fireEvent.change(screen.getByLabelText("Custom visit date"), {
      target: { value: "2026-08-08" },
    });
    expect(screen.getByLabelText("Custom visit date")).toHaveValue(
      "2026-08-08",
    );

    fireEvent.click(screen.getByLabelText("Morning"));
    expect(screen.getByLabelText("Morning")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Afternoon"));
    expect(screen.getByLabelText("Afternoon")).toBeChecked();
  });

  it("confirms through workflowId with only scheduledDate and visitPeriod", async () => {
    mocks.patch.mockResolvedValue({ data: { request: { status: "scheduled" } } });
    const { invalidate } = renderAction();
    openModal();
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
  });

  it("blocks duplicate confirmation while the first request is pending", async () => {
    let resolveRequest;
    mocks.patch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    renderAction();
    openModal();
    chooseTodayAndMorning();

    const confirm = screen.getByRole("button", { name: "Confirm Schedule" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(mocks.patch).toHaveBeenCalledOnce();

    await act(async () => {
      resolveRequest({ data: { request: { status: "scheduled" } } });
    });
  });

  it("shows canonical conflict, visit-period, date, and authorization errors", async () => {
    const cases = [
      {
        response: {
          status: 409,
          data: { code: "REQUEST_ALREADY_CLAIMED" },
        },
        expected: "This request was already claimed by another technician.",
      },
      {
        response: {
          status: 400,
          data: { code: "INVALID_VISIT_PERIOD" },
        },
        expected: "Choose Morning or Afternoon.",
      },
      {
        response: {
          status: 400,
          data: {
            code: "SCHEDULE_DATE_IN_PAST",
            message: "Visit date cannot be in the past.",
          },
        },
        expected: "Visit date cannot be in the past.",
      },
      {
        response: { status: 403, data: {} },
        expected: "You are not authorized to claim and schedule this request.",
      },
    ];

    for (const testCase of cases) {
      mocks.patch.mockRejectedValueOnce(testCase);
      const { unmount } = render(
        <QueryClientProvider client={new QueryClient()}>
          <AIClaimScheduleAction
            request={request}
            requestQueryKey={requestQueryKey}
          />
        </QueryClientProvider>,
      );
      openModal();
      chooseTodayAndMorning();
      fireEvent.click(
        screen.getByRole("button", { name: "Confirm Schedule" }),
      );
      expect(await screen.findByText(testCase.expected)).toBeInTheDocument();
      unmount();
    }
  });

  it("does not replace the existing Health claim action", () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <AIClaimScheduleAction
          request={{
            ...request,
            workflowType: "Health",
            allowedAction: "CLAIM",
            actionLabel: "Claim",
          }}
          requestQueryKey={requestQueryKey}
        />
      </QueryClientProvider>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(mocks.patch).not.toHaveBeenCalled();
  });
});
