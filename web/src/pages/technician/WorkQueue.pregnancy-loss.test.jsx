import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkQueue from "./WorkQueue";
import PregnancyLossReviewModal from "../../components/dialogs/PregnancyLossReviewModal";

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

vi.mock("sonner", () => ({
  toast: {
    success: mocks.success,
    error: mocks.error,
    info: vi.fn(),
  },
}));

vi.mock("../../components/layout/Topbar", () => ({
  default: ({ title }) => <h1>{title}</h1>,
}));

vi.mock("../../components/dialogs/HealthRequestActionModal", () => ({
  default: () => null,
}));

vi.mock("../../components/dialogs/AIServiceModal", () => ({
  default: () => null,
}));

vi.mock("../../components/dialogs/PregnancyDiagnosisModal", () => ({
  default: () => null,
}));

vi.mock("../../components/dialogs/RecordCalvingModal", () => ({
  default: () => null,
}));

vi.mock("../../components/dialogs/BreedingFollowUpModal", () => ({
  default: () => null,
}));

const renderWithClient = (ui) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/technician/work-queue"]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("Pregnancy Loss Review in Technician WorkQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens PregnancyLossReviewModal when clicking a task with sourceType === 'farmer_pregnancy_loss_report'", async () => {
    const mockTasks = [
      {
        id: "task-loss-123",
        taskType: "BreedingFollowUp",
        workflowType: "BreedingFollowUp",
        sourceType: "farmer_pregnancy_loss_report",
        allowedAction: "REVIEW_PREGNANCY_LOSS",
        title: "Suspected Pregnancy Loss: Cow 404",
        status: "Pending",
        context: {
          reportId: "rep-999",
          animalId: "animal-123",
          pregnancyId: "preg-456",
        },
        animal: {
          id: "animal-123",
          name: "Bessie",
          earTag: "TAG-404",
        },
        farmer: {
          name: "Mang Juan",
          phone: "09171234567",
        },
      },
    ];

    mocks.get.mockImplementation((url) => {
      if (url.includes("/work-queue") || url.includes("/tasks")) {
        return Promise.resolve({
          data: {
            data: mockTasks,
            pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
          },
        });
      }
      if (url.includes("/requests")) {
        return Promise.resolve({ data: { requests: [] } });
      }
      if (url.includes("/technician/pregnancy-loss-reports/rep-999")) {
        return Promise.resolve({
          data: {
            report: {
              _id: "rep-999",
              status: "pending_review",
              observationDate: "2026-09-08T00:00:00.000Z",
              notes: "Discharge observed early morning",
              evidencePhotos: ["https://example.com/photo1.jpg"],
              animal: {
                id: "animal-123",
                name: "Bessie",
                earTag: "TAG-404",
                breed: "Brahman",
              },
              farmer: {
                name: "Mang Juan",
                contactNumber: "09171234567",
                barangay: "Balabag",
              },
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    renderWithClient(<WorkQueue />);

    await waitFor(() => {
      expect(screen.getByText(/Suspected Pregnancy Loss: Cow 404/i)).toBeInTheDocument();
    });

    // Should display Needs review badge
    expect(screen.getByText("Needs review")).toBeInTheDocument();

    // Click the review button on the task card to open review modal
    const reviewBtn = screen.getByRole("button", { name: /Review Pregnancy Loss/i });
    fireEvent.click(reviewBtn);

    // Modal should now appear
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Pregnancy Loss Review" }),
      ).toBeInTheDocument();
    });
  });

  it("PregnancyLossReviewModal displays report details, requires notes for confirmation, and posts review", async () => {
    const mockReport = {
      _id: "rep-999",
      status: "pending_review",
      observationDate: "2026-09-08T00:00:00.000Z",
      notes: "Severe vaginal bleeding noticed",
      evidencePhotos: ["https://example.com/photo1.jpg"],
      animal: {
        id: "animal-123",
        name: "Bessie",
        earTag: "TAG-404",
        breed: "Brahman",
      },
      farmer: {
        name: "Mang Juan",
        contactNumber: "09171234567",
        barangay: "Balabag",
      },
    };

    mocks.get.mockImplementation((url) => {
      if (url.includes("/technician/pregnancy-loss-reports/rep-999")) {
        return Promise.resolve({
          data: { report: mockReport },
        });
      }
      return Promise.resolve({ data: {} });
    });

    mocks.post.mockResolvedValue({
      data: { success: true, message: "Loss confirmed" },
    });

    const mockTask = {
      id: "task-loss-123",
      sourceType: "farmer_pregnancy_loss_report",
      context: { reportId: "rep-999" },
    };

    const onClose = vi.fn();
    const onSuccess = vi.fn();

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PregnancyLossReviewModal
          isOpen={true}
          task={mockTask}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Bessie (TAG-404)")).toBeInTheDocument();
      expect(screen.getByText("Mang Juan")).toBeInTheDocument();
      expect(screen.getByText("Severe vaginal bleeding noticed")).toBeInTheDocument();
    });

    // Verify 3 distinct review action buttons exist
    expect(screen.getByRole("button", { name: /Confirm Loss/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Not Confirmed/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Needs Follow-up/i })).toBeInTheDocument();

    // Verify "Needs Follow-up" does not show fake visit/farm visit scheduling
    expect(screen.queryByText(/Schedule Farm Visit/i)).not.toBeInTheDocument();

    // Fill review notes
    const textarea = screen.getByPlaceholderText(/Enter your observations/i);
    fireEvent.change(textarea, { target: { value: "Examined dam, confirmed pregnancy loss via ultrasound" } });

    // Click Confirm Loss -> opens confirmation guard
    const confirmBtn = screen.getByRole("button", { name: /Confirm Loss/i });
    fireEvent.click(confirmBtn);

    // Guard dialog is shown
    await waitFor(() => {
      expect(screen.getByText(/Confirm pregnancy loss\?/i)).toBeInTheDocument();
    });

    // Confirm authoritative action
    const proceedBtn = screen.getByRole("button", { name: /Confirm Pregnancy Loss/i });
    fireEvent.click(proceedBtn);

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith(
        "/technician/pregnancy-loss-reports/rep-999/review",
        {
          outcome: "confirm_loss",
          reviewNotes: "Examined dam, confirmed pregnancy loss via ultrasound",
        },
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("PregnancyLossReviewModal safely renders structured farmer location object without React child error", async () => {
    const mockReport = {
      _id: "rep-structured-addr",
      status: "pending_review",
      observationDate: "2026-09-08T00:00:00.000Z",
      notes: "Suspected loss",
      evidencePhotos: [],
      animal: {
        id: "animal-123",
        name: "Bella",
        earTag: "COW-001",
      },
      farmer: {
        name: "Juan Dela Cruz",
        contactNumber: "09171234567",
        address: {
          _id: "addr-001",
          street: "Zone 2",
          barangay: "Bita Norte",
          city: "Oton",
          province: "Iloilo",
          isDefault: true,
          administrativeArea: {
            barangayName: "Bita Norte",
            municipalityName: "Oton",
            provinceName: "Iloilo",
          },
        },
      },
    };

    mocks.get.mockImplementation((url) => {
      if (url.includes("/technician/pregnancy-loss-reports/rep-structured-addr")) {
        return Promise.resolve({
          data: { report: mockReport },
        });
      }
      return Promise.resolve({ data: {} });
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PregnancyLossReviewModal
          isOpen={true}
          task={{
            id: "task-loss-structured",
            sourceType: "farmer_pregnancy_loss_report",
            context: { reportId: "rep-structured-addr" },
          }}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      </QueryClientProvider>,
    );

    // Should render formatted string without React child error
    await waitFor(() => {
      expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
      expect(screen.getByText("Zone 2, Bita Norte, Oton, Iloilo")).toBeInTheDocument();
    });
  });

  it("PregnancyLossReviewModal displays clean non-technical guidance and avoids clinical determination jargon", async () => {
    const mockReport = {
      _id: "rep-guidance",
      status: "pending_review",
      observationDate: "2026-09-08T00:00:00.000Z",
      notes: "Possible loss",
      evidencePhotos: [],
      animal: { id: "animal-1", name: "Bessie", earTag: "COW-01" },
      farmer: { name: "Juan" },
    };

    mocks.get.mockImplementation((url) => {
      if (url.includes("/technician/pregnancy-loss-reports/rep-guidance")) {
        return Promise.resolve({ data: { report: mockReport } });
      }
      return Promise.resolve({ data: {} });
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <PregnancyLossReviewModal
          isOpen={true}
          task={{
            id: "task-guidance",
            sourceType: "farmer_pregnancy_loss_report",
            context: { reportId: "rep-guidance" },
          }}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Pregnancy remains active until the loss is confirmed/i)).toBeInTheDocument();
      expect(screen.getByText(/If the report is not confirmed or needs follow-up, pregnancy monitoring will continue/i)).toBeInTheDocument();
    });

    // Ensure authoritative / clinical determination jargon is absent
    expect(screen.queryByText(/Authoritative Clinical Determination Required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/authoritative clinical outcome/i)).not.toBeInTheDocument();
  });

  it("PregnancyLossReviewModal displays clear FOLLOW-UP NEEDED state banner when report status is needs_visit", async () => {
    const mockReport = {
      _id: "rep-followup",
      status: "needs_visit",
      observationDate: "2026-09-08T00:00:00.000Z",
      notes: "Possible loss reported",
      evidencePhotos: [],
      animal: { id: "animal-2", name: "Carabao 1", earTag: "CARA-01" },
      farmer: { name: "Pedro" },
    };

    mocks.get.mockImplementation((url) => {
      if (url.includes("/technician/pregnancy-loss-reports/rep-followup")) {
        return Promise.resolve({ data: { report: mockReport } });
      }
      return Promise.resolve({ data: {} });
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <PregnancyLossReviewModal
          isOpen={true}
          task={{
            id: "task-followup",
            sourceType: "farmer_pregnancy_loss_report",
            context: { reportId: "rep-followup" },
          }}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Follow-up Needed")).toBeInTheDocument();
      expect(screen.getByText(/More information is needed before confirming this report. Pregnancy monitoring will continue./i)).toBeInTheDocument();
      expect(screen.getByText("No visit has been scheduled.")).toBeInTheDocument();
    });

    // Final decision buttons remain available
    expect(screen.getByRole("button", { name: /Confirm Loss/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Not Confirmed/i })).toBeInTheDocument();
  });
});
