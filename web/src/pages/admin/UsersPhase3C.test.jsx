import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
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
          Close invitation
        </button>
      </div>
    ) : null,
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
  status: "on-leave",
  address: { barangay: "Poblacion North", city: "Oton", province: "Iloilo" },
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
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

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

function installMatchMedia(matches) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderUsers(route = "/admin/users?role=farmer") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <Users />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

describe("Admin Users Table and Cards presentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installMatchMedia(false);
    axiosInstance.get.mockImplementation(async (_url, config) =>
      pagedResponse(config.params.role === "technician" ? [technician] : [farmer]),
    );
  });

  it.each([
    ["a missing view", "/admin/users?role=farmer"],
    ["an explicit table view", "/admin/users?role=farmer&view=table"],
  ])("renders the desktop table for %s", async (_case, route) => {
    renderUsers(route);

    expect(await screen.findByRole("table", { name: "Farmer directory" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Table" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByLabelText("Farmer cards")).not.toBeInTheDocument();
  });

  it("normalizes an invalid view to the safe table presentation", async () => {
    renderUsers("/admin/users?role=farmer&view=gallery&source=directory");

    expect(await screen.findByRole("table", { name: "Farmer directory" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/admin/users?role=farmer&view=table&source=directory",
      );
    });
  });

  it("renders concise Farmer cards without Technician-only content", async () => {
    renderUsers("/admin/users?role=farmer&view=cards");

    const cards = await screen.findByLabelText("Farmer cards");
    const card = within(cards).getByTestId("farmer-directory-card");
    expect(within(card).getByText("Maria Farmer")).toBeInTheDocument();
    expect(within(card).getByText("09171234567")).toBeInTheDocument();
    expect(within(card).getByText("maria@example.com")).toBeInTheDocument();
    expect(within(card).getByText("Poblacion South, Oton, Iloilo")).toBeInTheDocument();
    expect(within(card).queryByText(/Availability:/)).not.toBeInTheDocument();
    expect(
      within(card).getByRole("menuitem", {
        name: "View Details",
        hidden: true,
      }),
    ).toHaveAttribute("href", "/admin/users/farmer-1");
    expect(screen.getByRole("button", { name: "Add User" })).toBeInTheDocument();
  });

  it("renders Technician card metadata and the existing profile route", async () => {
    renderUsers("/admin/users?role=technician&view=cards");

    const cards = await screen.findByLabelText("Technician cards");
    const card = within(cards).getByTestId("technician-directory-card");
    expect(within(card).getByText("Tomas Technician")).toBeInTheDocument();
    expect(within(card).getByText("On Leave")).toBeInTheDocument();
    expect(within(card).getByText("Accepting requests")).toBeInTheDocument();
    expect(within(card).getByText("Availability: Available")).toBeInTheDocument();
    expect(within(card).getByText("Capabilities: AI, HEALTH +1")).toBeInTheDocument();
    expect(within(card).getByText("Service area: Oton, Tigbauan +1")).toBeInTheDocument();
    expect(
      within(card).getByRole("menuitem", {
        name: "View Details",
        hidden: true,
      }),
    ).toHaveAttribute("href", "/admin/users/technician-1");
    expect(within(card).queryByText("Maria Farmer")).not.toBeInTheDocument();
  });

  it.each(["table", "cards"])(
    "keeps Technician invitation available through Add User in %s mode",
    async (view) => {
      renderUsers(`/admin/users?role=technician&view=${view}`);

      await screen.findByText("Tomas Technician");
      fireEvent.click(screen.getByRole("button", { name: "Add User" }));
      fireEvent.click(screen.getByRole("button", { name: /^TechnicianSend/ }));
      expect(
        screen.getByRole("dialog", { name: "Invite Technician dialog" }),
      ).toBeInTheDocument();
    },
  );

  it("preserves search, filters, pagination, and query identity while switching views", async () => {
    axiosInstance.get.mockImplementation(async (_url, config) =>
      pagedResponse(
        [{ ...farmer, name: `Maria Page ${config.params.page}` }],
        { total: 21, page: config.params.page, totalPages: 3 },
      ),
    );
    const { queryClient } = renderUsers("/admin/users?role=farmer&view=table");

    await screen.findByText("Maria Page 1");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search users" }), {
      target: { value: "Maria" },
    });
    fireEvent.change(
      screen.getByRole("combobox", { name: "Filter farmers by municipality" }),
      { target: { value: "Oton" } },
    );
    fireEvent.change(
      await screen.findByRole("combobox", { name: "Filter farmers by barangay" }),
      { target: { value: "Poblacion South" } },
    );
    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenLastCalledWith(
        "/user",
        expect.objectContaining({
          params: expect.objectContaining({ barangay: "Poblacion South" }),
        }),
      );
    });
    expect(await screen.findByText("Maria Page 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next farmer page" }));
    expect(await screen.findByText("Maria Page 2")).toBeInTheDocument();

    const queryCountBeforeViewChange = queryClient.getQueryCache().getAll().length;
    const requestCountBeforeViewChange = axiosInstance.get.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Cards" }));

    expect(await screen.findByLabelText("Farmer cards")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search users" })).toHaveValue("Maria");
    expect(
      screen.getByRole("combobox", { name: "Filter farmers by municipality" }),
    ).toHaveValue("Oton");
    expect(
      screen.getByRole("combobox", { name: "Filter farmers by barangay" }),
    ).toHaveValue("Poblacion South");
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(
      queryCountBeforeViewChange,
    );
    expect(axiosInstance.get).toHaveBeenCalledTimes(requestCountBeforeViewChange);
  });

  it("preserves card view while switching roles and keeps role controls safe", async () => {
    renderUsers("/admin/users?role=technician&view=cards&source=management");

    await screen.findByLabelText("Technician cards");
    fireEvent.click(screen.getByRole("tab", { name: "Farmers" }));

    expect(await screen.findByLabelText("Farmer cards")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/admin/users?role=farmer&view=cards&source=management",
    );
    expect(screen.getByRole("button", { name: "Add User" })).toBeInTheDocument();
  });

  it("uses cards on narrow Web viewports instead of rendering the wide table", async () => {
    installMatchMedia(true);
    renderUsers("/admin/users?role=farmer&view=table");

    expect(await screen.findByLabelText("Farmer cards")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Farmer directory" })).not.toBeInTheDocument();
  });

  it("does not create card-only or per-Technician detail requests", async () => {
    const { queryClient } = renderUsers(
      "/admin/users?role=technician&view=cards",
    );

    await screen.findByLabelText("Technician cards");
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
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1);
  });

  it("keeps Admin accounts out of card mode", async () => {
    axiosInstance.get.mockResolvedValue(
      pagedResponse([{ _id: "admin-1", name: "Other Admin", role: "admin" }]),
    );
    renderUsers("/admin/users?role=farmer&view=cards");

    expect(await screen.findByText("No farmers found.")).toBeInTheDocument();
    expect(screen.queryByText("Other Admin")).not.toBeInTheDocument();
  });

  it("uses card-specific loading, empty, and retry states", async () => {
    axiosInstance.get.mockReturnValueOnce(new Promise(() => {}));
    const firstRender = renderUsers("/admin/users?role=farmer&view=cards");
    expect(screen.getAllByTestId("directory-card-skeleton")).toHaveLength(6);
    firstRender.unmount();

    axiosInstance.get
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(pagedResponse([]));
    renderUsers("/admin/users?role=farmer&view=cards");
    expect(
      await screen.findByText("Farmer records could not be loaded."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No farmers found.")).toBeInTheDocument();
  });
});
