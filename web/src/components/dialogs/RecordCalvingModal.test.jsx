import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../../lib/axios", () => ({
  default: { get: mocks.get, post: mocks.post },
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

import RecordCalvingModal from "./RecordCalvingModal";

describe("RecordCalvingModal Manila date boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the Philippine calendar day for the default and maximum calving date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T16:01:00.000Z"));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const { container } = render(
      <QueryClientProvider client={client}>
        <RecordCalvingModal
          isOpen
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          pregnancyData={{
            _id: "507f1f77bcf86cd799439041",
            animalId: {
              _id: "507f1f77bcf86cd799439081",
              earTag: "TEST-1",
            },
          }}
          taskId="507f1f77bcf86cd799439042"
        />
      </QueryClientProvider>,
    );

    const dateInput = container.querySelector('input[type="date"]');
    expect(dateInput).not.toBeNull();
    expect(dateInput.value).toBe("2026-09-01");
    expect(dateInput.max).toBe("2026-09-01");
  });

  it("guards two synchronous submits and allows a retry after failure", async () => {
    mocks.post.mockRejectedValueOnce({
      response: { data: { message: "Temporary failure" } },
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <RecordCalvingModal
          isOpen
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          pregnancyData={{
            _id: "507f1f77bcf86cd799439041",
            animalId: {
              _id: "507f1f77bcf86cd799439081",
              earTag: "TEST-1",
            },
          }}
          taskId="507f1f77bcf86cd799439042"
        />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByPlaceholderText("e.g. 104"), {
      target: { value: "CALF-1" },
    });
    const save = screen.getByRole("button", { name: /save calving record/i });
    fireEvent.click(save);
    fireEvent.click(save);

    await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to record Calf Drop: Temporary failure",
    );
    expect(mocks.error).not.toHaveBeenCalled();

    mocks.post.mockResolvedValueOnce({ data: {} });
    fireEvent.click(save);
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
  });

  it("preserves same-pregnancy input and resets it for a different pregnancy", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const firstPregnancy = {
      _id: "507f1f77bcf86cd799439041",
      animalId: { _id: "507f1f77bcf86cd799439081", earTag: "TEST-1" },
    };
    const view = render(
      <QueryClientProvider client={client}>
        <RecordCalvingModal
          isOpen
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          pregnancyData={firstPregnancy}
        />
      </QueryClientProvider>,
    );
    const notes = screen.getByPlaceholderText(/Describe any complications/i);
    fireEvent.change(notes, { target: { value: "Keep this observation" } });

    view.rerender(
      <QueryClientProvider client={client}>
        <RecordCalvingModal
          isOpen
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          pregnancyData={{ ...firstPregnancy }}
        />
      </QueryClientProvider>,
    );
    expect(notes).toHaveValue("Keep this observation");

    view.rerender(
      <QueryClientProvider client={client}>
        <RecordCalvingModal
          isOpen
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          pregnancyData={{
            _id: "507f1f77bcf86cd799439043",
            animalId: { _id: "507f1f77bcf86cd799439082", earTag: "TEST-2" },
          }}
        />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(notes).toHaveValue(""));
  });

  it("resolves mother display label from preSelectedAnimal when pregnancyData.animalId is string ID", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={client}>
        <RecordCalvingModal
          isOpen
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          pregnancyData={{
            _id: "507f1f77bcf86cd799439041",
            animalId: "507f1f77bcf86cd799439081",
          }}
          preSelectedAnimal={{
            id: "507f1f77bcf86cd799439081",
            earTag: "RC26-SINGLE-09-CALVING-DUE",
          }}
          taskId="507f1f77bcf86cd799439042"
        />
      </QueryClientProvider>,
    );

    expect(
      screen.getByText("Link birth details and offspring to Mother #RC26-SINGLE-09-CALVING-DUE"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Mother #Selected Animal/)).toBeNull();
  });

  it("hides delivery method and omits calvingEase for abortion", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <RecordCalvingModal
          isOpen
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          pregnancyData={{
            _id: "507f1f77bcf86cd799439041",
            animalId: { _id: "507f1f77bcf86cd799439081", earTag: "TEST-1" },
          }}
          taskId="507f1f77bcf86cd799439042"
        />
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText("Outcome"), {
      target: { value: "abortion" },
    });
    expect(screen.queryByLabelText("Delivery Method / Ease")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /save calving record/i }));

    await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
    const payload = mocks.post.mock.calls[0][1];
    expect(payload.outcome).toBe("abortion");
    expect(payload).not.toHaveProperty("calvingEase");
  });

  it("blocks submission when outcome is mixed and all calves have the same vitality", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <RecordCalvingModal
          isOpen
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          pregnancyData={{
            _id: "507f1f77bcf86cd799439041",
            animalId: { _id: "507f1f77bcf86cd799439081", earTag: "TEST-1" },
          }}
          taskId="507f1f77bcf86cd799439042"
        />
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText("Outcome"), {
      target: { value: "mixed" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. 104"), {
      target: { value: "CALF-1" },
    });
    // With 1 calf default (Living), livingCalves = 1, nonLivingCalves = 0 -> invalid mixed
    fireEvent.click(screen.getByRole("button", { name: /save calving record/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Mixed delivery must include at least one living and one stillborn calf.",
    );
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("displays real-time inline warning and dims the submit button when outcome is mixed without both living and stillborn calves", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <RecordCalvingModal
          isOpen
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          pregnancyData={{
            _id: "507f1f77bcf86cd799439041",
            animalId: { _id: "507f1f77bcf86cd799439081", earTag: "TEST-1" },
          }}
          taskId="507f1f77bcf86cd799439042"
        />
      </QueryClientProvider>,
    );

    const saveButton = screen.getByRole("button", { name: /save calving record/i });
    expect(saveButton.className).not.toContain("opacity-60");
    expect(screen.queryByText("Mixed delivery must include at least one living and one stillborn calf.")).toBeNull();

    fireEvent.change(screen.getByLabelText("Outcome"), {
      target: { value: "mixed" },
    });

    expect(screen.getByText("Mixed delivery must include at least one living and one stillborn calf.")).toBeInTheDocument();
    expect(saveButton.className).toContain("opacity-60");
  });
});
