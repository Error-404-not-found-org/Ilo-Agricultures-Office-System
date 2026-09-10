import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "../../lib/axios";
import AdminWorkQueue from "./AdminWorkQueue";
import AdminPregnancyOversight from "./AdminPregnancyOversight";
import AdminCalvings from "./AdminCalvings";

vi.mock("../../lib/axios", () => ({ default: { get: vi.fn() } }));
vi.mock("../../components/layout/Topbar", () => ({
  default: ({ title, subtitle }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  ),
}));

function renderPage(page) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Admin Web role safety", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders canonical workload cards with stable Technician IDs", async () => {
    axiosInstance.get.mockResolvedValue({
      data: {
        technicians: [
          {
            technicianId: "technician-a",
            name: "Same Name",
            activeWorkloadTotal: 5,
            counts: { ai: 1, health: 1, pregnancy: 1, calving: 1, tasks: 1 },
          },
          {
            technicianId: "technician-b",
            name: "Same Name",
            activeWorkloadTotal: 2,
            counts: { ai: 0, health: 1, pregnancy: 0, calving: 1, tasks: 0 },
          },
        ],
      },
    });

    renderPage(<AdminWorkQueue />);

    expect(await screen.findByRole("heading", { name: "Active Work" }))
      .toBeInTheDocument();
    expect(await screen.findAllByText("Same Name")).toHaveLength(2);
    expect(screen.getAllByText("Active Work")).toHaveLength(3);
    expect(screen.getAllByText("AI")).toHaveLength(2);
    expect(screen.getAllByText("Health")).toHaveLength(2);
    expect(screen.getAllByText("Pregnancy")).toHaveLength(2);
    expect(screen.getAllByText("Calving")).toHaveLength(2);
    expect(screen.getAllByText("Other Tasks")).toHaveLength(2);

    const profileLinks = screen.getAllByRole("link", {
      name: /View Technician profile for Same Name/,
    });
    expect(profileLinks[0]).toHaveAttribute(
      "href",
      "/admin/users/technician-a",
    );
    expect(profileLinks[1]).toHaveAttribute(
      "href",
      "/admin/users/technician-b",
    );

    expect(screen.queryByText("Record Service")).not.toBeInTheDocument();
    expect(screen.queryByText("Complete Task")).not.toBeInTheDocument();
    expect(screen.queryByText("Claim")).not.toBeInTheDocument();
    expect(screen.queryByText(/High|Medium|Low workload/)).not.toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenCalledWith(
      "/admin/technician-workload-summary",
    );
  });

  it("renders pregnancy checks from the Admin read-only contract", async () => {
    axiosInstance.get.mockResolvedValue({
      data: {
        data: [
          {
            _id: "pregnancy-1",
            pregnancyDiagnosis: {
              date: "2026-08-20T00:00:00.000Z",
              result: "Pregnant",
            },
            animalId: {
              _id: "animal-1",
              earTag: "ILO-201",
              species: "Cattle",
            },
            farmerId: { name: "Elena Farmer" },
            cycleStatus: "confirmed",
          },
        ],
        pagination: { total: 1, totalPages: 1 },
      },
    });

    renderPage(<AdminPregnancyOversight />);
    await screen.findByText("ILO-201");

    const table = await screen.findByRole("table", {
      name: "Municipal pregnancy check oversight",
    });
    expect(table).toHaveTextContent("ILO-201");
    expect(table).toHaveTextContent("Pregnant");
    expect(screen.queryByText("Add Pregnancy Record")).not.toBeInTheDocument();
    expect(screen.queryByText("Save Record")).not.toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenCalledWith(
      "/admin/pregnancy-checks",
      expect.any(Object),
    );
  });

  it("renders calvings from the Admin read-only contract", async () => {
    axiosInstance.get.mockResolvedValue({
      data: {
        data: [
          {
            _id: "calving-1",
            date: "2026-08-21T00:00:00.000Z",
            outcome: "Live birth",
            numberOfCalves: 1,
            animalId: {
              _id: "animal-2",
              earTag: "ILO-301",
              species: "Cattle",
            },
            farmerId: { name: "Rosa Farmer" },
          },
        ],
        pagination: { total: 1, totalPages: 1 },
      },
    });

    renderPage(<AdminCalvings />);
    await screen.findByText("ILO-301");

    const table = await screen.findByRole("table", {
      name: "Municipal calving and newborn oversight",
    });
    expect(table).toHaveTextContent("ILO-301");
    expect(table).toHaveTextContent("Live birth");
    expect(screen.queryByText("Record Calving")).not.toBeInTheDocument();
    expect(screen.queryByText("Save Details")).not.toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenCalledWith(
      "/admin/calvings",
      expect.any(Object),
    );
  });

  it("keeps Admin and Technician route components separated", () => {
    const appSource = readFileSync("src/App.jsx", "utf8");
    const scheduleSource = readFileSync(
      "src/pages/technician/Schedule.jsx",
      "utf8",
    );
    const profileSource = readFileSync(
      "src/pages/admin/LivestockProfile.jsx",
      "utf8",
    );
    const requestsSource = readFileSync(
      "src/pages/technician/Requests.jsx",
      "utf8",
    );

    expect(appSource).toContain(
      '<Route path="work-queue" element={<AdminWorkQueue />} />',
    );
    expect(appSource).toContain(
      '<Route path="newborns" element={<AdminCalvings />} />',
    );
    expect(appSource).toContain('<LivestockProfile role="admin" />');
    expect(appSource).toContain('<TechnicianRequests role="admin" />');
    expect(appSource).toContain('<LivestockProfile role="technician" />');
    expect(appSource).toContain('<TechnicianRequests role="technician" />');
    expect(appSource).not.toContain('import("./pages/technician/RequestDetails")');
    expect(scheduleSource).toContain(
      "/technician/requests?requestId=${encodeURIComponent(reqId)}&status=all",
    );
    expect(scheduleSource).not.toContain("/technician/schedule/details?");
    expect(profileSource).toContain("{!isAdmin && (");
    expect(profileSource).not.toContain("window.location");
    expect(profileSource).not.toContain("Marites Dela Cruz");
    expect(profileSource).not.toContain("0917 123 4567");
    expect(requestsSource).not.toContain("window.location");
    expect(requestsSource).toContain("if (!actionPolicy.canClaim) return;");
    expect(requestsSource).toContain(
      "if (!actionPolicy.canCancelOwnRequest || isUpdating) return;",
    );
  });
});
