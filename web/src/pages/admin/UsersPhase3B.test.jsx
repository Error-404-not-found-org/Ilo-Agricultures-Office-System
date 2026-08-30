import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "../../lib/axios";
import Users from "./Users";

vi.mock("../../lib/axios", () => ({ default: { get: vi.fn() } }));
vi.mock("../../components/layout/Topbar", () => ({
  default: () => null,
}));
vi.mock("../../components/ui/UserAvatar", () => ({
  default: ({ name }) => <span aria-label={(name || "User") + " avatar"} />,
}));
vi.mock("../../components/dialogs/TechnicianInviteDialog", () => ({
  default: ({ open, onClose }) =>
    open ? (
      <div role="dialog" aria-label="Invite Technician dialog">
        <button type="button" onClick={onClose}>
          Close invite
        </button>
      </div>
    ) : null,
}));

const technicians = [
  {
    _id: "tech-active",
    name: "Ana Active",
    role: "technician",
    phoneNumber: "09171234567",
    email: "ana@example.com",
    status: "active",
    address: { barangay: "Poblacion South", city: "Oton", province: "Iloilo" },
    dispatchProfile: {
      acceptsNewRequests: true,
      availabilityStatus: "available",
      serviceCapabilities: ["AI", "HEALTH", "CALVING"],
      serviceMunicipalities: [
        { municipalityCode: "0603034000", municipalityName: "Oton" },
        { municipalityCode: "0603043000", municipalityName: "Tigbauan" },
        { municipalityCode: "0603022000", municipalityName: "Miagao" },
      ],
    },
  },
  {
    _id: "tech-leave",
    name: "Leo Leave",
    role: "technician",
    status: "on-leave",
    dispatchProfile: { acceptsNewRequests: false },
  },
  {
    _id: "tech-suspended",
    name: "Sara Suspended",
    role: "technician",
    status: "suspended",
  },
];

const farmer = {
  _id: "farmer-1",
  name: "Maria Farmer",
  role: "farmer",
  phoneNumber: "09170000000",
  email: "maria@example.com",
  address: { barangay: "Poblacion North", city: "Oton", province: "Iloilo" },
};

const pagedResponse = (data, overrides = {}) => ({
  data: {
    data,
    total: data.length,
    page: 1,
    limit: 10,
    totalPages: 1,
    ...overrides,
  },
});

function renderUsers(route = "/admin/users?role=technician") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <Users />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

describe("Admin Users Technician roster capabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosInstance.get.mockImplementation(async (url, config) => {
      expect(url).toBe("/user");
      return pagedResponse(
        config.params.role === "technician" ? technicians : [farmer],
      );
    });
  });

  it("opens the shared Technician invitation from Add User", async () => {
    renderUsers();

    await screen.findByText("Ana Active");
    fireEvent.click(screen.getByRole("button", { name: "Add User" }));
    fireEvent.click(screen.getByRole("button", { name: /^TechnicianSend/ }));
    expect(
      screen.getByRole("dialog", { name: "Invite Technician dialog" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Farmers" }));
    expect(await screen.findByText("Maria Farmer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add User" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("links every Technician name to the existing detail route", async () => {
    renderUsers();

    expect(
      await screen.findByRole("link", {
        name: "Open Technician profile for Ana Active",
      }),
    ).toHaveAttribute("href", "/admin/users/tech-active");
    expect(
      screen.getByRole("link", {
        name: "Open Technician profile for Leo Leave",
      }),
    ).toHaveAttribute("href", "/admin/users/tech-leave");
  });

  it("renders canonical Technician statuses without collapsing them to Active", async () => {
    renderUsers();

    const activeRow = (await screen.findByText("Ana Active")).closest("tr");
    const leaveRow = screen.getByText("Leo Leave").closest("tr");
    const suspendedRow = screen.getByText("Sara Suspended").closest("tr");

    expect(within(activeRow).getByText("Active")).toBeInTheDocument();
    expect(within(leaveRow).getByText("On Leave")).toBeInTheDocument();
    expect(within(leaveRow).queryByText("Active")).not.toBeInTheDocument();
    expect(within(suspendedRow).getByText("Suspended")).toBeInTheDocument();
    expect(within(suspendedRow).queryByText("Active")).not.toBeInTheDocument();
  });

  it("shows compact list-level dispatch fields and no invented metric", async () => {
    renderUsers();

    const row = (await screen.findByText("Ana Active")).closest("tr");
    expect(within(row).getByText("Accepting requests")).toBeInTheDocument();
    expect(within(row).getByText("Availability: Available")).toBeInTheDocument();
    expect(within(row).getByText("Capabilities: AI, HEALTH +1")).toBeInTheDocument();
    expect(within(row).getByText("Service area: Oton, Tigbauan +1")).toBeInTheDocument();
    expect(screen.queryByText(/94% Dispatch Success/i)).not.toBeInTheDocument();
  });

  it("uses one paginated list request and sends no unsupported status filter", async () => {
    const { queryClient } = renderUsers();

    await screen.findByText("Ana Active");
    expect(axiosInstance.get).toHaveBeenCalledTimes(1);
    expect(axiosInstance.get).toHaveBeenCalledWith("/user", {
      params: {
        role: "technician",
        page: 1,
        limit: 10,
        search: undefined,
        city: undefined,
        barangay: undefined,
      },
    });
    expect(axiosInstance.get.mock.calls[0][1].params).not.toHaveProperty(
      "status",
    );
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.queryKey),
    ).toContainEqual([
      "admin",
      "users",
      "technician",
      1,
      "",
      "all",
      "",
      "",
    ]);
  });

  it("keeps Farmer columns and controls free of Technician-only content", async () => {
    renderUsers("/admin/users?role=farmer");

    expect(await screen.findByText("Maria Farmer")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Full name" })).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Contact number" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Dispatch coverage" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add User" })).toBeInTheDocument();
  });
});
