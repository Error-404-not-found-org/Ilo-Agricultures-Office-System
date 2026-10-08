import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FarmersDirectory from "../FarmersDirectory";
import Animals from "../Animals";
import axiosInstance from "../../../lib/axios";

// Mock Topbar to avoid SidebarContext dependencies and notification queries
vi.mock("../../../components/layout/Topbar", () => ({
  default: ({ title, subtitle }) => (
    <div>
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  ),
}));

// Mock axiosInstance
vi.mock("../../../lib/axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

describe("FarmersDirectory & Animals Discovery Workflow", () => {
  let queryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const renderWithProviders = (ui) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    );
  };

  describe("FarmersDirectory Page", () => {
    it("renders loading, and then the farmers data grid", async () => {
      axiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [
            {
              _id: "farmer1",
              name: "Juan Dela Cruz",
              phoneNumber: "09123456789",
              address: { barangay: "Supa" },
              animalsCount: 3,
              createdAt: "2026-07-10T12:00:00Z",
              isVerified: true,
            },
          ],
          total: 1,
          totalPages: 1,
        },
      });

      renderWithProviders(
        <MemoryRouter initialEntries={["/technician/farmers?search=Juan"]}>
          <Routes>
            <Route path="/technician/farmers" element={<FarmersDirectory />} />
          </Routes>
        </MemoryRouter>
      );

      // Verify page Topbar renders
      expect(screen.getByText("Find a Farmer and open or update their profile")).toBeInTheDocument();

      // Wait for table to load
      await waitFor(() => {
        expect(screen.getAllByText("Juan Dela Cruz").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("09123456789").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("Supa").length).toBeGreaterThanOrEqual(1);
      });
    });

    it("displays retry button on error and refetches", async () => {
      axiosInstance.get.mockRejectedValueOnce(new Error("Network Failure"));

      renderWithProviders(
        <MemoryRouter initialEntries={["/technician/farmers"]}>
          <Routes>
            <Route path="/technician/farmers" element={<FarmersDirectory />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Farmers could not be loaded.")).toBeInTheDocument();
        expect(screen.getByText("Network Failure")).toBeInTheDocument();
      });

      const retryBtn = screen.getByRole("button", { name: "Retry" });
      expect(retryBtn).toBeInTheDocument();

      axiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [],
          total: 0,
          totalPages: 1,
        },
      });

      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByText("No farmers found")).toBeInTheDocument();
      });
    });
  });

  describe("Animals Directory Page", () => {
    it("renders animals list, shows 'Not recorded' for missing Last AI Date, and exposes Barangay and Sex filters", async () => {
      axiosInstance.get.mockResolvedValueOnce({
        data: {
          data: [
            {
              _id: "animal1",
              earTag: "CAT-999",
              breed: "Holstein",
              type: "Cattle",
              farmerId: { name: "Maria Clara", address: { barangay: "Nibaliw" } },
              color: "Black & White",
              reproductiveStatus: "Open",
              // lastInseminationDate is missing
            },
          ],
          total: 1,
          totalPages: 1,
        },
      });

      renderWithProviders(
        <MemoryRouter initialEntries={["/technician/animals"]}>
          <Routes>
            <Route path="/technician/animals" element={<Animals />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText("#CAT-999").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("Maria Clara").length).toBeGreaterThanOrEqual(1);
        // Check Last AI fallback is "Not recorded"
        expect(screen.getAllByText("Not recorded").length).toBeGreaterThanOrEqual(1);
      });

      expect(screen.getByRole("combobox", { name: "Filter animals by municipality" })).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Filter animals by barangay" })).toBeDisabled();
      expect(screen.getByRole("combobox", { name: "Filter animals by sex" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "All sexes" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Male" })).toBeInTheDocument();
    });
  });
});
