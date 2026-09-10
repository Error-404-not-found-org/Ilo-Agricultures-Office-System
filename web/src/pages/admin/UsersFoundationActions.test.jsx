import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "../../lib/axios";
import Users from "./Users";

vi.mock("../../lib/axios", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));
vi.mock("../../components/layout/Topbar", () => ({
  default: ({ title, subtitle }) => (
    <header data-testid="admin-topbar">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  ),
}));
vi.mock("../../components/ui/UserAvatar", () => ({
  default: ({ name }) => <span aria-label={`${name || "User"} avatar`} />,
}));
vi.mock("../../components/dialogs/TechnicianInviteDialog", () => ({
  default: () => null,
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const users = [
  {
    _id: "tech-active",
    name: "Alex Technician",
    role: "technician",
    status: "active",
    isVerified: true,
    email: "alex@example.com",
  },
  {
    _id: "tech-unverified",
    name: "Una Technician",
    role: "technician",
    status: "active",
    isVerified: false,
    email: "una@example.com",
  },
  {
    _id: "tech-suspended",
    name: "Sam Suspended",
    role: "technician",
    status: "suspended",
    isVerified: true,
    email: "sam@example.com",
  },
  {
    _id: "admin-hidden",
    name: "Hidden Admin",
    role: "admin",
    status: "active",
    isVerified: true,
  },
];

const pagedResponse = (data) => ({
  data: {
    data,
    total: data.length,
    page: 1,
    limit: 10,
    totalPages: 1,
  },
});

function renderUsers(view = "table") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[`/admin/users?role=technician&view=${view}`]}
      >
        <Users />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Admin Users search, account status, and actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    axiosInstance.get.mockImplementation(async (url) => {
      if (url === "/admin/list-users") return { data: users };
      return pagedResponse(users);
    });
    axiosInstance.post.mockResolvedValue({ data: { message: "Updated" } });
  });

  it("places directory search below the Users header and preserves search", async () => {
    renderUsers();

    expect(await screen.findByText("Alex Technician")).toBeInTheDocument();
    expect(within(screen.getByTestId("admin-topbar")).queryByRole("searchbox"))
      .not.toBeInTheDocument();

    const search = screen.getByRole("searchbox", { name: "Search users" });
    fireEvent.change(search, { target: { value: "Alex" } });

    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenLastCalledWith(
        "/user",
        expect.objectContaining({
          params: expect.objectContaining({ search: "Alex" }),
        }),
      );
    });
  });

  it("supports All, Active, and Suspended while excluding Admin accounts", async () => {
    renderUsers();

    expect(await screen.findByText("Alex Technician")).toBeInTheDocument();
    expect(screen.getByText("Sam Suspended")).toBeInTheDocument();
    expect(screen.queryByText("Hidden Admin")).not.toBeInTheDocument();

    const status = screen.getByRole("combobox", {
      name: "Filter technicians by status",
    });
    fireEvent.change(status, { target: { value: "active" } });

    expect(await screen.findByText("Una Technician")).toBeInTheDocument();
    expect(screen.queryByText("Sam Suspended")).not.toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenLastCalledWith(
      "/admin/list-users",
      { params: { role: "technician" } },
    );

    fireEvent.change(status, { target: { value: "suspended" } });
    expect(await screen.findByText("Sam Suspended")).toBeInTheDocument();
    expect(screen.queryByText("Alex Technician")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search users" }), {
      target: { value: "Sam" },
    });
    expect(await screen.findByText("Sam Suspended")).toBeInTheDocument();
  });

  it.each(["table", "cards"])(
    "shows only state-valid actions in %s view",
    async (view) => {
      renderUsers(view);

      await screen.findByText("Alex Technician");
      const activeMenu = document.querySelector(
        '[role="menu"][aria-label="Actions for Alex Technician"]',
      );
      expect(activeMenu).not.toBeNull();
      expect(within(activeMenu).getByRole("menuitem", {
        name: "View Details",
        hidden: true,
      }))
        .toHaveAttribute("href", "/admin/users/tech-active");
      expect(within(activeMenu).getByRole("menuitem", {
        name: "Suspend",
        hidden: true,
      }))
        .toBeInTheDocument();
      expect(within(activeMenu).queryByRole("menuitem", {
        name: "Verify",
        hidden: true,
      }))
        .not.toBeInTheDocument();
      expect(within(activeMenu).queryByRole("menuitem", {
        name: "Reactivate",
        hidden: true,
      }))
        .not.toBeInTheDocument();

      const unverifiedMenu = document.querySelector(
        '[role="menu"][aria-label="Actions for Una Technician"]',
      );
      expect(within(unverifiedMenu).getByRole("menuitem", {
        name: "Verify",
        hidden: true,
      }))
        .toBeInTheDocument();
      expect(within(unverifiedMenu).getByRole("menuitem", {
        name: "Suspend",
        hidden: true,
      }))
        .toBeInTheDocument();

      const suspendedMenu = document.querySelector(
        '[role="menu"][aria-label="Actions for Sam Suspended"]',
      );
      expect(within(suspendedMenu).getByRole("menuitem", {
        name: "Reactivate",
        hidden: true,
      }))
        .toBeInTheDocument();
      expect(within(suspendedMenu).queryByRole("menuitem", {
        name: "Suspend",
        hidden: true,
      }))
        .not.toBeInTheDocument();
    },
  );

  it("uses the existing authorized action endpoints", async () => {
    renderUsers();

    await screen.findByText("Alex Technician");
    const menu = document.querySelector(
      '[role="menu"][aria-label="Actions for Alex Technician"]',
    );
    fireEvent.click(
      within(menu).getByRole("menuitem", {
        name: "Suspend",
        hidden: true,
      }),
    );

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledWith(
        "/admin/suspend-user",
        { id: "tech-active" },
      );
    });
  });
});
