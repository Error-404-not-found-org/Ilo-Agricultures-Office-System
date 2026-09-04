import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

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
});
