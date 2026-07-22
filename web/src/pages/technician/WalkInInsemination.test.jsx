import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WalkInInsemination from "./WalkInInsemination";
import axiosInstance from "../../lib/axios";

vi.mock("../../lib/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));
vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("../../features/technician/TaskContextCard", () => ({
  default: ({ taskContext }) => (
    <div data-testid="task-context-card">
      Task ID: {taskContext?.taskId} | Type: {taskContext?.taskType}
    </div>
  ),
}));

vi.mock("../../features/technician/TaskContextErrorView", () => ({
  default: ({ title, message }) => (
    <div data-testid="task-context-error">
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  ),
}));

const renderWithProviders = (initialEntries = ["/technician/walk-in"]) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/technician/walk-in" element={<WalkInInsemination />} />
          <Route
            path="/technician/work-queue"
            element={<div>Work Queue Page</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("WalkInInsemination Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("locks the farmer and animal selectors when launched from an AI task context", async () => {
    // Mock response for farmer and animal details
    axiosInstance.get.mockImplementation((url) => {
      if (url.includes("/tasks/task-123")) {
        return Promise.resolve({
          data: {
            isValid: true,
            farmerId: "farmer-1",
            farmerName: "Juan Dela Cruz",
            animalId: "animal-1",
            animalName: "Cattle - ILO-100",
            taskType: "AI",
            taskId: "task-123",
          },
        });
      }
      if (url.includes("/user")) {
        return Promise.resolve({
          data: [{ _id: "farmer-1", name: "Juan Dela Cruz" }],
        });
      }
      if (url.includes("/animals")) {
        return Promise.resolve({
          data: [
            {
              _id: "animal-1",
              earTag: "ILO-100",
              reproductiveStatus: "Normal",
            },
          ],
        });
      }
      if (url.includes("/config")) {
        return Promise.resolve({ data: { isHoliday: false } });
      }
      return Promise.reject(new Error("not found"));
    });

    renderWithProviders(["/technician/walk-in?taskId=task-123"]);

    // Verify task context card is rendered
    await waitFor(() => {
      expect(screen.getByTestId("task-context-card")).toBeInTheDocument();
    });
    expect(screen.getByText(/Task ID: task-123/)).toBeInTheDocument();

    // Wait for animal select options to load
    await waitFor(() => {
      expect(screen.getByText(/Tag #ILO-100/i)).toBeInTheDocument();
    });

    // Verify farmer input is disabled
    const farmerInput = screen.getByPlaceholderText("Search farmer name...");
    expect(farmerInput).toBeDisabled();
    expect(farmerInput.value).toBe("Juan Dela Cruz");

    // Verify animal select is disabled
    const animalSelect = screen.getByLabelText(/Animal Asset/i);
    expect(animalSelect).toBeDisabled();
  });

  it("shows TaskContextErrorView if the task is a Health or Calving task (preview-only)", async () => {
    axiosInstance.get.mockImplementation((url) => {
      console.log("TEST REQUESTED URL (Test 2):", url);
      if (url.includes("/tasks/task-456")) {
        return Promise.resolve({
          data: {
            isValid: true,
            farmerId: "farmer-1",
            farmerName: "Juan Dela Cruz",
            animalId: "animal-1",
            animalName: "Cattle - ILO-100",
            taskType: "Health",
            taskId: "task-456",
          },
        });
      }
      if (url.includes("/user")) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes("/config")) {
        return Promise.resolve({ data: { isHoliday: false } });
      }
      return Promise.reject(new Error("not found"));
    });

    renderWithProviders(["/technician/walk-in?taskId=task-456"]);

    // Since Health tasks are preview-only in the AI page, it should block with context error
    await waitFor(() => {
      expect(screen.getByTestId("task-context-error")).toBeInTheDocument();
    });
    expect(screen.getByText("Task target unavailable")).toBeInTheDocument();
  });

  it("shows TaskContextErrorView when context validation fails", async () => {
    axiosInstance.get.mockImplementation((url) => {
      if (url.includes("/tasks/task-999")) {
        return Promise.resolve({
          data: {
            isValid: false,
            message: "This task has already been completed.",
          },
        });
      }
      if (url.includes("/user")) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes("/config")) {
        return Promise.resolve({ data: { isHoliday: false } });
      }
      return Promise.reject(new Error("not found"));
    });

    renderWithProviders(["/technician/walk-in?taskId=task-999"]);

    await waitFor(() => {
      expect(screen.getByTestId("task-context-error")).toBeInTheDocument();
    });
    expect(
      screen.getByText("This task has already been completed."),
    ).toBeInTheDocument();
  });

  it("submits AI record successfully and redirects to the Work Queue page", async () => {
    axiosInstance.get.mockImplementation((url) => {
      if (url.includes("/tasks/task-123")) {
        return Promise.resolve({
          data: {
            isValid: true,
            farmerId: "farmer-1",
            farmerName: "Juan Dela Cruz",
            animalId: "animal-1",
            animalName: "Cattle - ILO-100",
            taskType: "AI",
            taskId: "task-123",
          },
        });
      }
      if (url.includes("/user")) {
        return Promise.resolve({
          data: [{ _id: "farmer-1", name: "Juan Dela Cruz" }],
        });
      }
      if (url.includes("/animals")) {
        return Promise.resolve({
          data: [
            {
              _id: "animal-1",
              earTag: "ILO-100",
              reproductiveStatus: "Normal",
            },
          ],
        });
      }
      if (url.includes("/config")) {
        return Promise.resolve({ data: { isHoliday: false } });
      }
      return Promise.reject(new Error("not found"));
    });

    axiosInstance.post.mockResolvedValue({
      data: { success: true },
    });

    renderWithProviders(["/technician/walk-in?taskId=task-123"]);

    await waitFor(() => {
      expect(screen.getByTestId("task-context-card")).toBeInTheDocument();
    });

    // Wait for the animal list options to load
    await waitFor(() => {
      expect(screen.getByText(/Tag #ILO-100/i)).toBeInTheDocument();
    });

    // Populate sire breed
    const sireBreedInput = screen.getByLabelText(/Sire Breed/i);
    fireEvent.change(sireBreedInput, { target: { value: "Brahman" } });

    // Click submit button
    const submitBtn = screen.getByRole("button", { name: /Commit AI Record/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledWith(
        "/technician/walk-in-insemination",
        expect.objectContaining({
          farmerId: "farmer-1",
          animalId: "animal-1",
          inseminationDetails: expect.objectContaining({
            sireBreed: "Brahman",
            sireCode: expect.any(String),
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Work Queue Page")).toBeInTheDocument();
    });
  });
});
