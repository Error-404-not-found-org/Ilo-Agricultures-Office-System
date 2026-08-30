import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "../../lib/axios";
import UserDetails from "./UserDetails";

vi.mock("../../lib/axios", () => ({
  default: { get: vi.fn(), patch: vi.fn() },
}));
vi.mock("../../components/layout/Topbar", () => ({
  default: ({ title, subtitle }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  ),
}));
vi.mock("../../components/ui/UserAvatar", () => ({
  default: ({ name }) => <span aria-label={`${name} avatar`} />,
}));

const farmer = {
  _id: "farmer-1",
  name: "Alex Same Name",
  role: "farmer",
  status: "active",
  isVerified: false,
  profileClaimStatus: "unclaimed",
  email: "farmer@example.com",
  phoneNumber: "09171234567",
  createdAt: "2026-07-10T00:00:00.000Z",
  address: {
    barangay: "Poblacion South",
    city: "Oton",
    province: "Iloilo",
  },
  farmLocation: { landmark: "Beside the covered court" },
  assignedAnimals: [
    {
      _id: "animal-1",
      earTag: "OTON-001",
      species: "Cattle",
    },
  ],
};

const technician = {
  _id: "technician-1",
  name: "Alex Same Name",
  role: "technician",
  status: "on-leave",
  isVerified: true,
  profileClaimStatus: "claimed",
  email: "technician@example.com",
  createdAt: "2026-06-01T00:00:00.000Z",
  dispatchProfile: {
    acceptsNewRequests: true,
    availabilityStatus: "available",
    serviceCapabilities: ["AI", "HEALTH"],
    serviceMunicipalities: [{ municipalityName: "Oton" }],
  },
  serviceHistory: [
    {
      _id: "service-1",
      type: "health",
      status: "resolved",
      createdAt: "2026-08-01T00:00:00.000Z",
      animalId: { earTag: "OTON-009" },
    },
  ],
};

function renderDetails(id, path = `/admin/users/${id}`) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/users/:id" element={<UserDetails />} />
          <Route path="/admin/technicians/:id" element={<UserDetails />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Admin generic User Details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosInstance.patch.mockResolvedValue({ data: { updated: true } });
  });

  it("shows Farmer contact, location, truthful claim state, and linked animals", async () => {
    axiosInstance.get.mockResolvedValue({ data: farmer });
    renderDetails("farmer-1");

    expect(await screen.findByText(/Farmer operational account/)).toBeInTheDocument();
    expect(screen.getByText("farmer@example.com")).toBeInTheDocument();
    expect(screen.getByText("Poblacion South, Oton, Iloilo")).toBeInTheDocument();
    expect(screen.getByText("Beside the covered court")).toBeInTheDocument();
    expect(screen.getAllByText("Not Claimed").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Farm summary" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Livestock summary" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Livestock" })).toHaveAttribute(
      "href",
      "/admin/livestock",
    );
    expect(screen.queryByRole("heading", { name: "Dispatch profile" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Technician service history" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Needs verification/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/App Installed/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /OTON-001/i })).toHaveAttribute(
      "href",
      "/admin/livestock/animal-1",
    );
  });

  it("resolves same-name users by stable ID and shows Technician field information", async () => {
    axiosInstance.get.mockImplementation(async (url) => ({
      data: url === "/user/technician-1" ? technician : farmer,
    }));
    renderDetails("technician-1");

    expect(await screen.findByText(/Technician operational account/)).toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenCalledWith("/user/technician-1");
    expect(screen.getByText("technician@example.com")).toBeInTheDocument();
    expect(screen.queryByText("farmer@example.com")).not.toBeInTheDocument();
    expect(screen.getAllByText("Profile Claimed").length).toBeGreaterThan(0);
    expect(screen.getByText("AI, HEALTH")).toBeInTheDocument();
    expect(screen.getByText("Oton")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dispatch profile" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Technician service history" })).toBeInTheDocument();
    expect(screen.getByText("OTON-009")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Farm summary" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View Livestock" })).not.toBeInTheDocument();
  });

  it("keeps the approved responsive profile shell for both operational roles", async () => {
    axiosInstance.get.mockResolvedValue({ data: farmer });
    renderDetails("farmer-1");

    const main = await screen.findByRole("main");
    const profileGrid = main.firstElementChild;
    expect(main).toHaveClass("p-4", "sm:p-6", "max-w-7xl");
    expect(profileGrid).toHaveClass(
      "grid-cols-1",
      "lg:grid-cols-[300px_1fr]",
    );
  });

  it("preserves Technician capability editing on the generalized page", async () => {
    axiosInstance.get.mockResolvedValue({ data: technician });
    renderDetails("technician-1", "/admin/technicians/technician-1");

    fireEvent.click(await screen.findByRole("button", { name: "Edit capabilities" }));
    const form = screen.getByRole("form", { name: "Edit Technician capabilities" });
    fireEvent.click(within(form).getByRole("checkbox", { name: "Calving" }));
    fireEvent.click(within(form).getByRole("button", { name: "Save capabilities" }));

    await waitFor(() => {
      expect(axiosInstance.patch).toHaveBeenCalledWith(
        "/admin/technician/technician-1/dispatch-profile",
        { serviceCapabilities: ["AI", "HEALTH", "CALVING"] },
      );
    });
  });

  it("rejects Admin targets from the operational Farmer and Technician view", async () => {
    axiosInstance.get.mockResolvedValue({
      data: { _id: "admin-1", name: "Other Admin", role: "admin" },
    });
    renderDetails("admin-1");

    expect(
      await screen.findByText("Admin accounts are not part of this directory"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Other Admin")).not.toBeInTheDocument();
  });
});
