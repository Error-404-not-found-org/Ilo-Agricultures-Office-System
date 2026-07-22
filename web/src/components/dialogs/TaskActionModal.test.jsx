import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TaskActionModal from "./TaskActionModal";
import axiosInstance from "../../lib/axios";
import { toast } from "sonner";

vi.mock("../../lib/axios", () => ({
  default: { get: vi.fn(), patch: vi.fn() },
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), promise: vi.fn() },
}));

const renderModal = (task) => {
  axiosInstance.get.mockResolvedValue({ data: { _id: "tech-1" } });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TaskActionModal
        isOpen
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        task={task}
      />
    </QueryClientProvider>,
  );
};

describe("TaskActionModal available request details", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a health request as readable details instead of disabled workflow fields", () => {
    renderModal({
      id: "health-1",
      type: "health",
      queueType: "health",
      status: "pending",
      farmer: "Maria Santos",
      farmerPhone: "09171234567",
      location: "Jaro, Iloilo City",
      animalTag: "ILO-204",
      breed: "Holstein",
      urgency: "urgent",
      createdAt: "2026-07-22T01:00:00.000Z",
      raw: {
        requestType: "loss_of_appetite",
        symptoms: "Not eating since yesterday",
        farmerNotes: "Drinking less water",
        preferredDate: "2026-07-23T02:30:00.000Z",
        farmerId: { name: "Maria Santos", phoneNumber: "09171234567" },
        animalId: { earTag: "ILO-204", breed: "Holstein", species: "Cattle" },
        photos: ["https://example.test/health-request.jpg"],
      },
    });

    expect(screen.getByRole("dialog", { name: "Health Visit Request" })).toBeInTheDocument();
    expect(screen.getByText("Loss Of Appetite")).toBeInTheDocument();
    expect(screen.getByText("Not eating since yesterday")).toBeInTheDocument();
    expect(screen.getByText("Drinking less water")).toBeInTheDocument();
    expect(screen.getByText(/Jul 23, 2026/)).toBeInTheDocument();
    expect(screen.getByText("Claim request to view contact")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("09171234567")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Scheduled Date")).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Farmer-submitted request evidence 1" }),
    ).toHaveAttribute("src", "https://example.test/health-request.jpg");
    expect(screen.getByRole("button", { name: "Claim" })).toBeEnabled();
  });

  it("shows AI heat signs and deduplicates the submitted image", () => {
    renderModal({
      id: "ai-1",
      type: "insemination",
      queueType: "ai",
      serviceLabel: "Artificial Insemination",
      status: "pending",
      farmer: "Ana Reyes",
      location: "Oton, Iloilo",
      animalTag: "ILO-305",
      breed: "Jersey",
      raw: {
        heatSigns: ["standing_heat", "mucus_discharge"],
        comment: "Ready for technician assessment",
        imageUrl: "https://example.test/ai-request.jpg",
        animalId: { earTag: "ILO-305", breed: "Jersey", species: "Cattle" },
      },
    });

    expect(screen.getByText("Standing Heat, Mucus Discharge")).toBeInTheDocument();
    expect(screen.getByText("Ready for technician assessment")).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /Farmer-submitted request evidence/ })).toHaveLength(1);
    expect(screen.queryByText("Schedule & Findings")).not.toBeInTheDocument();
  });

  it("locks future service fields and names the scheduled date and time", () => {
    renderModal({
      id: "health-future",
      type: "health",
      queueType: "health",
      status: "in-progress",
      farmer: "Maria Santos",
      location: "Jaro, Iloilo City",
      animalTag: "ILO-204",
      scheduledDate: "2099-01-15T09:30:00",
      visitDate: "2099-01-15T09:30:00",
      raw: {
        requestType: "checkup",
        scheduledDate: "2099-01-15T09:30:00",
        handledBy: { _id: "tech-1", name: "Tech Santos" },
        animalId: { earTag: "ILO-204", breed: "Holstein", species: "Cattle" },
      },
    });

    expect(screen.getByText("Service record not available yet")).toBeInTheDocument();
    expect(screen.getByText(/Jan 15, 2099, 9:30 AM/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Enter diagnosis findings")).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/specific behavioral changes/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Clinical observations and service findings will unlock/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Submit health record" }));
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/Jan 15, 2099, 9:30 AM/),
    );
  });

  it("blocks an early scheduled visit and keeps its schedule read-only", () => {
    renderModal({
      id: "health-scheduled-future",
      type: "health",
      queueType: "health",
      status: "scheduled",
      farmer: "Maria Santos",
      location: "Jaro, Iloilo City",
      animalTag: "ILO-204",
      scheduledDate: "2099-02-10T13:45:00",
      visitDate: "2099-02-10T13:45:00",
      raw: {
        requestType: "checkup",
        scheduledDate: "2099-02-10T13:45:00",
        handledBy: { _id: "tech-1", name: "Tech Santos" },
        animalId: { earTag: "ILO-204", breed: "Holstein", species: "Cattle" },
      },
    });

    expect(screen.getByLabelText("Scheduled Date")).toBeDisabled();
    expect(screen.getByLabelText("Scheduled Time")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Start visit" }));

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/Feb 10, 2099, 1:45 PM/),
    );
    expect(axiosInstance.patch).not.toHaveBeenCalled();
  });
});
