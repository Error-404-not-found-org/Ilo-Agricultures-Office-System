import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "../../lib/axios";
import Users from "./Users";

vi.mock("../../lib/axios", () => ({ default: { get: vi.fn() } }));
vi.mock("../../components/layout/Topbar", () => ({
  default: ({ title, subtitle, searchPlaceholder, searchValue, onSearchChange }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <input
        aria-label="Search users"
        placeholder={searchPlaceholder}
        value={searchValue}
        onChange={onSearchChange}
      />
    </header>
  ),
}));
vi.mock("../../components/ui/UserAvatar", () => ({
  default: ({ name }) => <span aria-label={`${name || "User"} avatar`} />,
}));

const farmer = {
  _id: "farmer-1",
  name: "Maria Farmer",
  role: "farmer",
  phoneNumber: "09171234567",
  email: "maria@example.com",
  address: { barangay: "Poblacion South", city: "Oton", province: "Iloilo" },
};

const technician = {
  _id: "technician-1",
  name: "Tomas Technician",
  role: "technician",
  phoneNumber: "09179876543",
  email: "tomas@example.com",
  address: { barangay: "Poblacion North", city: "Oton", province: "Iloilo" },
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function pagedResponse(data, overrides = {}) {
  return {
    data: {
      data,
      total: data.length,
      page: 1,
      limit: 10,
      totalPages: 1,
      ...overrides,
    },
  };
}

function renderUsers(route = "/admin/users?role=farmer") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Users />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { ...result, queryClient };
}

describe("Admin Users directory foundation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosInstance.get.mockImplementation(async (_url, config) => {
      const role = config?.params?.role;
      return pagedResponse(role === "technician" ? [technician] : [farmer]);
    });
  });

  it.each([
    ["missing", "/admin/users"],
    ["unsupported Admin", "/admin/users?role=admin"],
    ["unknown", "/admin/users?role=auditor"],
  ])("normalizes a %s role to Farmer without requesting Admin users", async (_case, route) => {
    renderUsers(route);

    expect(await screen.findByText("Maria Farmer")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/admin/users?role=farmer",
      );
    });
    expect(screen.getByRole("tab", { name: "Farmers" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByRole("tab", { name: /admin/i })).not.toBeInTheDocument();
    expect(axiosInstance.get).not.toHaveBeenCalledWith(
      "/user",
      expect.objectContaining({ params: expect.objectContaining({ role: "admin" }) }),
    );
  });

  it("loads Technician mode directly from the supported URL", async () => {
    renderUsers("/admin/users?role=technician");

    expect(await screen.findByText("Tomas Technician")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Technicians" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
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
  });

  it("isolates role/page query keys and resets pagination when roles change", async () => {
    axiosInstance.get.mockImplementation(async (_url, config) => {
      const { role, page } = config.params;
      if (role === "technician") {
        return pagedResponse([technician]);
      }
      return pagedResponse(
        [{ ...farmer, _id: `farmer-${page}`, name: `Farmer Page ${page}` }],
        { total: 21, page, totalPages: 3 },
      );
    });
    const { queryClient } = renderUsers();

    expect(await screen.findByText("Farmer Page 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next farmer page" }));
    expect(await screen.findByText("Farmer Page 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Technicians" }));
    expect(await screen.findByText("Tomas Technician")).toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenLastCalledWith(
      "/user",
      expect.objectContaining({
        params: expect.objectContaining({ role: "technician", page: 1 }),
      }),
    );

    const queryKeys = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey);
    expect(queryKeys).toContainEqual([
      "admin",
      "users",
      "farmer",
      2,
      "",
      "",
      "",
    ]);
    expect(queryKeys).toContainEqual([
      "admin",
      "users",
      "technician",
      1,
      "",
      "",
      "",
    ]);
  });

  it("sends supported search and location filters to page one", async () => {
    axiosInstance.get.mockImplementation(async (_url, config) =>
      pagedResponse([farmer], {
        total: 20,
        page: config.params.page,
        totalPages: 2,
      }),
    );
    renderUsers();

    await screen.findByText("Maria Farmer");
    fireEvent.click(screen.getByRole("button", { name: "Next farmer page" }));
    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenLastCalledWith(
        "/user",
        expect.objectContaining({ params: expect.objectContaining({ page: 2 }) }),
      );
    });

    fireEvent.change(screen.getByRole("textbox", { name: "Search users" }), {
      target: { value: "Maria" },
    });
    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenLastCalledWith(
        "/user",
        expect.objectContaining({
          params: expect.objectContaining({ page: 1, search: "Maria" }),
        }),
      );
    });

    fireEvent.change(
      screen.getByRole("combobox", { name: "Filter farmers by municipality" }),
      { target: { value: "Oton" } },
    );
    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenLastCalledWith(
        "/user",
        expect.objectContaining({
          params: expect.objectContaining({ page: 1, city: "Oton" }),
        }),
      );
    });

    const barangaySelect = screen.getByRole("combobox", {
      name: "Filter farmers by barangay",
    });
    const barangay = Array.from(barangaySelect.options).find(
      (option) => option.value,
    )?.value;
    expect(barangay).toBeTruthy();
    fireEvent.change(barangaySelect, { target: { value: barangay } });
    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenLastCalledWith(
        "/user",
        expect.objectContaining({
          params: expect.objectContaining({ page: 1, barangay }),
        }),
      );
    });
  });

  it("shows truthful missing data and has no inert action control", async () => {
    axiosInstance.get.mockResolvedValue(
      pagedResponse([
        {
          _id: "farmer-missing-data",
          name: "No Location Farmer",
          role: "farmer",
        },
      ]),
    );
    renderUsers();

    const name = await screen.findByText("No Location Farmer");
    const row = name.closest("tr");
    expect(row).not.toBeNull();
    expect(within(row).getAllByText("Not recorded")).toHaveLength(3);
    expect(within(row).queryByText(/Oton/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Actions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
  });

  it("filters unexpected Admin records out of the operational table", async () => {
    axiosInstance.get.mockResolvedValue(
      pagedResponse([{ _id: "admin-1", name: "Other Admin", role: "admin" }]),
    );
    renderUsers();

    expect(await screen.findByText("No farmers found.")).toBeInTheDocument();
    expect(screen.queryByText("Other Admin")).not.toBeInTheDocument();
  });

  it.each([
    ["farmer", "No farmers found."],
    ["technician", "No technicians found."],
  ])("shows a role-specific %s empty state", async (role, message) => {
    axiosInstance.get.mockResolvedValue(pagedResponse([]));
    renderUsers(`/admin/users?role=${role}`);

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("shows loading skeletons while the directory request is pending", () => {
    axiosInstance.get.mockReturnValue(new Promise(() => {}));
    const { container } = renderUsers();

    expect(screen.getByText("Loading farmers...")).toBeInTheDocument();
    expect(container.querySelectorAll("tbody tr.animate-pulse")).toHaveLength(6);
  });

  it("shows a concise error and retries the directory query", async () => {
    axiosInstance.get
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(pagedResponse([farmer]));
    renderUsers();

    expect(
      await screen.findByText("Farmer records could not be loaded."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Maria Farmer")).toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenCalledTimes(2);
  });
});
