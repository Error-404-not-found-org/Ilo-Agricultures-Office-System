import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SidebarProvider } from "../../../contexts/SidebarContext";
import FarmerProfile from "../FarmerProfile";
import LivestockProfile from "../../admin/LivestockProfile";
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

describe("FarmerProfile & LivestockProfile Workspaces", () => {
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
        <SidebarProvider>{ui}</SidebarProvider>
      </QueryClientProvider>,
    );
  };

  describe("FarmerProfile Page", () => {
    it("renders profile summary and active shortcuts", async () => {
      axiosInstance.get.mockImplementation(async (url) => {
        if (url.startsWith("/user/")) {
          return {
            data: {
              _id: "farmer1",
              name: "Juan Dela Cruz",
              phoneNumber: "09123456789",
              address: { barangay: "Supa" },
              email: "juan@example.com",
              createdAt: "2026-07-10T12:00:00Z",
            },
          };
        }
        if (url.startsWith("/animals/farmer/")) {
          return {
            data: {
              data: [
                {
                  _id: "animal1",
                  earTag: "CAT-100",
                  species: "Cattle",
                  breed: "Simmental",
                  reproductiveStatus: "Pregnant",
                },
              ],
            },
          };
        }
        return { data: {} };
      });

      renderWithProviders(
        <MemoryRouter initialEntries={["/technician/farmers/farmer1"]}>
          <Routes>
            <Route path="/technician/farmers/:id" element={<FarmerProfile />} />
          </Routes>
        </MemoryRouter>,
      );

      // Wait for farmer name and phone to load
      await waitFor(() => {
        expect(screen.getAllByText("Juan Dela Cruz")[0]).toBeInTheDocument();
        expect(screen.getByText("09123456789")).toBeInTheDocument();
      });

      // Verify the current contact link and direct actions.
      expect(screen.getByRole("link", { name: "09123456789" })).toHaveAttribute("href", "tel:09123456789");
      expect(
        screen.getByRole("button", { name: "Register Animal" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Record AI Service/ }),
      ).toBeInTheDocument();

      // Click "Register Animal" button to open modal
      fireEvent.click(screen.getByRole("button", { name: "Register Animal" }));
      await waitFor(() => {
        expect(screen.getByRole("dialog", { name: "Register Animal" })).toBeInTheDocument();
      });
    });
  });

  describe("LivestockProfile Page", () => {
    it("renders timeline event cards with icons and filters", async () => {
      axiosInstance.get.mockImplementation(async (url) => {
        if (url.startsWith("/animals/")) {
          return {
            data: {
              _id: "animal1",
              earTag: "CAT-200",
              species: "Cattle",
              breed: "Holstein",
              birthDate: "2024-01-01T12:00:00Z",
              color: "Black & White",
              reproductiveStatus: "Calved",
              farmerId: {
                name: "Maria Clara",
                address: { barangay: "Nibaliw" },
              },
              inseminations: [
                {
                  _id: "ins1",
                  attemptNumber: 1,
                  inseminationDate: "2026-06-01T12:00:00Z",
                  sireBreed: "Simmental",
                  sireCode: "SIMM-99",
                  status: "Pregnant",
                  pregnancy: {
                    _id: "preg1",
                    diagnosisDate: "2026-07-01T12:00:00Z",
                    result: "Confirmed",
                    method: "Ultrasound",
                    diagnosedBy: "Doc Perez",
                  },
                },
              ],
              calvings: [
                {
                  _id: "calve1",
                  date: "2026-07-10T12:00:00Z",
                  status: "Normal",
                  outcome: "Healthy offspring",
                  calves: [{ animalId: "calf1" }],
                },
              ],
            },
          };
        }
        if (url.startsWith("/medical/")) {
          return {
            data: [
              {
                _id: "med1",
                date: "2026-05-15T12:00:00Z",
                type: "Deworming",
                details: {
                  diagnosis: "Internal Parasites",
                  medicineName: "Ivermectin",
                },
              },
            ],
          };
        }
        return { data: {} };
      });

      renderWithProviders(
        <MemoryRouter initialEntries={["/technician/animals/animal1"]}>
          <Routes>
            <Route
              path="/technician/animals/:id"
              element={<LivestockProfile />}
            />
          </Routes>
        </MemoryRouter>,
      );

      // Wait for livestock profile page to render and fetch records
      await waitFor(() => {
        expect(screen.getByText("Animal #CAT-200")).toBeInTheDocument();
        expect(screen.getAllByText("Maria Clara").length).toBeGreaterThan(0);
      });

      // Open the current Records section; its inner tab labels the record table.
      fireEvent.click(screen.getByRole("button", { name: "Records", exact: true }));
      expect(screen.getByRole("tab", { name: "Animal Records" })).toBeInTheDocument();

      // Verify that all consolidated history records render
      await waitFor(() => {
        // AI event card
        expect(screen.getByText("AI Attempt #1")).toBeInTheDocument();
        // Health event card
        expect(screen.getByText("Deworming")).toBeInTheDocument();
        // PD event card
        expect(screen.getByText("Pregnancy Diagnosis")).toBeInTheDocument();
        // Calving event card
        expect(screen.getByText("Calving Record")).toBeInTheDocument();
      });

      // Check existence of filter options in dropdown
      const typeSelect = screen.getByRole("combobox", {
        name: "Filter animal records by type",
      });
      expect(typeSelect).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "All record types" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "Pregnancy checks" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "Calving events" }),
      ).toBeInTheDocument();
    });

    it("keeps Animal Profile read-only for service history while preserving profile editing", async () => {
      axiosInstance.get.mockImplementation(async (url) => {
        if (url.startsWith("/animals/")) {
          return {
            data: {
              _id: "animal1",
              earTag: "CAT-200",
              species: "Cattle",
              breed: "Holstein",
              birthDate: "2024-01-01T12:00:00Z",
              color: "Black & White",
              reproductiveStatus: "Normal",
              farmerId: {
                name: "Maria Clara",
                address: { barangay: "Nibaliw" },
              },
              inseminations: [],
              calvings: [],
            },
          };
        }
        if (url.startsWith("/medical/")) return { data: [] };
        return { data: {} };
      });

      renderWithProviders(
        <MemoryRouter initialEntries={["/technician/animals/animal1"]}>
          <Routes>
            <Route
              path="/technician/animals/:id"
              element={<LivestockProfile />}
            />
          </Routes>
        </MemoryRouter>,
      );

      await screen.findByText("Animal #CAT-200");

      expect(
        screen.getByRole("button", { name: "Edit Profile" }),
      ).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "Add Record" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Activity Audit")).not.toBeInTheDocument();
    });
  });
});
