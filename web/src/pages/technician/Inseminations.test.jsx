import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InseminationLog from "./Inseminations";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("../../lib/axios", () => ({
  default: {
    get: mocks.get,
  },
}));

vi.mock("../../components/layout/Topbar", () => ({
  default: ({ title }) => <div>{title}</div>,
}));

vi.mock("../../components/dialogs/AIServiceModal", () => ({
  default: ({ isOpen, preSelectedAnimal, preSelectedFarmer }) =>
    isOpen ? (
      <div
        data-testid="ai-service-modal"
        data-animal-tag={preSelectedAnimal?.earTag}
        data-farmer-name={preSelectedFarmer?.name}
      >
        AI Service Modal Mock
      </div>
    ) : null,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <InseminationLog />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("InseminationLog - Observation Info and Field Assignment Actions", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function () {
      this.open = true;
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function () {
      this.open = false;
      this.removeAttribute("open");
    });
    vi.clearAllMocks();
  });

  it("renders help icon for pending outcome and opens 18-21 day observation info modal", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        inseminations: [
          {
            _id: "ai-101",
            inseminationDate: "2026-08-01T00:00:00.000Z",
            animalId: { _id: "anim-1", earTag: "TAG-99" },
            farmerId: { _id: "farm-1", name: "Farmer Juan" },
            sireBreed: "Holstein",
            sireCode: "HOL-123",
            estrus: "Natural",
            outcome: "Pending",
            status: "done",
            attemptNumber: 1,
          },
        ],
        pagination: { total: 1, totalPages: 1 },
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("TAG-99")).toBeInTheDocument();
    });

    const helpButtons = screen.getAllByRole("button", {
      name: /Observation info for TAG-99/i,
    });
    expect(helpButtons.length).toBeGreaterThan(0);

    fireEvent.click(helpButtons[0]);

    await waitFor(() => {
      expect(
        screen.getByText(/18 to 21-day observation timeframe/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Wait for confirmation of animal inseminated/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Go to Field Assignments/i }),
      ).toBeInTheDocument();
    });
  });

  it("renders Field Assignments connected action in the actions menu", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        inseminations: [
          {
            _id: "ai-102",
            inseminationDate: "2026-08-01T00:00:00.000Z",
            animalId: { _id: "anim-2", earTag: "TAG-100" },
            farmerId: { _id: "farm-2", name: "Maria Clara" },
            sireBreed: "Angus",
            sireCode: "ANG-456",
            estrus: "Synchronized",
            outcome: "Pending",
            status: "done",
            attemptNumber: 1,
          },
        ],
        pagination: { total: 1, totalPages: 1 },
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("TAG-100")).toBeInTheDocument();
    });

    const fieldAssignmentButtons = screen.getAllByRole("button", {
      name: /Field Assignments/i,
    });
    expect(fieldAssignmentButtons.length).toBeGreaterThan(0);
  });

  it("renders Record Re-Insemination action and opens confirmation modal", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        inseminations: [
          {
            _id: "ai-103",
            inseminationDate: "2026-08-01T00:00:00.000Z",
            animalId: { _id: "anim-3", earTag: "TAG-101" },
            farmerId: { _id: "farm-3", name: "Pedro Penduko" },
            sireBreed: "Brahman",
            sireCode: "BRH-789",
            estrus: "Natural",
            outcome: "Failed",
            status: "done",
            attemptNumber: 1,
          },
        ],
        pagination: { total: 1, totalPages: 1 },
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("TAG-101")).toBeInTheDocument();
    });

    const cardBtn = screen.getByTestId("re-inseminate-btn");
    expect(cardBtn).toBeInTheDocument();
    expect(cardBtn).not.toBeDisabled();

    fireEvent.click(cardBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Record Attempt/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Cancel/i }),
      ).toBeInTheDocument();
    });
  });

  it("renders Confirm Outcome button when outcome is pending and opens confirmation modal", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        inseminations: [
          {
            _id: "ai-104",
            inseminationDate: "2026-08-01T00:00:00.000Z",
            animalId: { _id: "anim-4", earTag: "TAG-102" },
            farmerId: { _id: "farm-4", name: "Juana Change" },
            sireBreed: "Jersey",
            sireCode: "JER-102",
            estrus: "Natural",
            outcome: "Pending",
            status: "done",
            attemptNumber: 1,
          },
        ],
        pagination: { total: 1, totalPages: 1 },
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("TAG-102")).toBeInTheDocument();
    });

    const cardBtn = screen.getByTestId("confirm-outcome-btn");
    expect(cardBtn).toBeInTheDocument();

    fireEvent.click(cardBtn);

    await waitFor(() => {
      expect(screen.getByText("Confirmed Pregnant")).toBeInTheDocument();
    });
  });
});
