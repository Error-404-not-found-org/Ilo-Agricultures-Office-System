import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const clerkMocks = vi.hoisted(() => ({
  openUserProfile: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@clerk/clerk-react", () => ({
  UserButton: () => <div aria-label="Account avatar" />,
  useUser: () => ({
    user: {
      fullName: "Admin User",
      imageUrl: "https://example.test/admin-avatar.png",
      publicMetadata: { role: "admin" },
    },
  }),
  useClerk: () => clerkMocks,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: {} }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn() }),
}));

vi.mock("../../lib/axios", () => ({
  default: { get: vi.fn() },
  injectSignOut: vi.fn(),
}));

vi.mock("../../contexts/SidebarContext", () => ({
  useSidebar: () => ({
    isOpen: true,
    close: vi.fn(),
  }),
}));

import Sidebar from "./Sidebar";

function renderSidebar(path = "/admin/dashboard", { collapsed = false } = {}) {
  localStorage.setItem("sidebar-collapsed", String(collapsed));
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

describe("Admin Sidebar navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders the simplified hierarchy in operational order", () => {
    renderSidebar();

    const navigation = screen.getByRole("navigation", {
      name: "Admin navigation",
    });
    const primaryLinks = within(navigation).getAllByRole("link");
    expect(primaryLinks.map((link) => link.getAttribute("href"))).toEqual([
      "/admin/dashboard",
      "/admin/users",
      "/admin/livestock",
      "/admin/requests",
      "/admin/support-tickets",
      "/admin/work-queue",
      "/admin/barangays",
      "/admin/reports",
      "/admin/archived",
      "/admin/audit-logs",
      "/admin/settings",
    ]);

    expect(
      Array.from(navigation.children).map((item) =>
        item.textContent.replace(/\s+/g, " ").trim(),
      ),
    ).toEqual([
      "Dashboard",
      "People",
      "Users",
      "Livestock",
      "Livestock",
      "Operations",
      "Requests",
      "Support",
      "Service Records",
      "Insights",
      "Workload",
      "Barangays",
      "Reports",
      "System",
      "Archived Records",
      "Audit Logs",
      "Settings",
    ]);

    expect(screen.getByText("Admin Portal")).toBeInTheDocument();
    expect(primaryLinks[0]).toHaveTextContent("Dashboard");
    expect(navigation).toHaveTextContent("People");
    expect(navigation).toHaveTextContent("Users");
    expect(
      within(navigation).queryByRole("link", { name: "Technicians" }),
    ).not.toBeInTheDocument();
    expect(navigation).toHaveTextContent("Livestock");
    expect(navigation).toHaveTextContent("Archived Records");
    expect(navigation).toHaveTextContent("Operations");
    expect(navigation).toHaveTextContent("Requests");
    expect(navigation).toHaveTextContent("Workload");
    expect(navigation).toHaveTextContent("Barangays");
    expect(navigation).toHaveTextContent("Support");
    expect(navigation).toHaveTextContent("Insights");
    expect(navigation).toHaveTextContent("Reports");
    expect(navigation).toHaveTextContent("Audit Logs");
    expect(navigation).toHaveTextContent("System");
    expect(navigation).toHaveTextContent("Settings");
  });

  it("preserves regrouped Admin destination routes", () => {
    renderSidebar();

    expect(screen.getByRole("link", { name: "Archived Records" }))
      .toHaveAttribute("href", "/admin/archived");
    expect(screen.getByRole("link", { name: "Workload" }))
      .toHaveAttribute("href", "/admin/work-queue");
    expect(screen.getByRole("link", { name: "Barangays" }))
      .toHaveAttribute("href", "/admin/barangays");
    expect(screen.getByRole("link", { name: "Audit Logs" }))
      .toHaveAttribute("href", "/admin/audit-logs");
  });

  it("groups Inseminations, Pregnancy, and Calving under Service Records", () => {
    renderSidebar();

    const serviceRecords = screen.getByRole("button", {
      name: "Service Records",
    });
    expect(serviceRecords).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(serviceRecords);

    const recordGroup = screen.getByRole("group", {
      name: "Service Records",
    });
    expect(within(recordGroup).getByRole("link", { name: "Inseminations" }))
      .toHaveAttribute("href", "/admin/inseminations");
    expect(within(recordGroup).getByRole("link", { name: "Pregnancy" }))
      .toHaveAttribute("href", "/admin/pregnancy-tracker");
    expect(within(recordGroup).getByRole("link", { name: "Calving" }))
      .toHaveAttribute("href", "/admin/newborns");
    expect(recordGroup).not.toHaveTextContent(/^AI$/);
    expect(screen.queryByText("Pregnancy Tracker")).not.toBeInTheDocument();
    expect(screen.queryByText("Newborns Log")).not.toBeInTheDocument();
    expect(screen.queryByText("Inseminations Log")).not.toBeInTheDocument();
  });

  it.each([
    ["/admin/inseminations", "Inseminations"],
    ["/admin/pregnancy-tracker/pregnancy-1", "Pregnancy"],
    ["/admin/newborns", "Calving"],
  ])("keeps Service Records and %s active", (path, activeLabel) => {
    renderSidebar(path);

    expect(
      screen.getByRole("button", { name: /Service Records/ }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: activeLabel })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("maps the work queue route to the active Workload destination", () => {
    renderSidebar("/admin/work-queue");

    expect(screen.getByRole("link", { name: "Workload" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("opens Clerk account controls from the Admin identity block", () => {
    const expanded = renderSidebar();

    const profile = screen.getByRole("button", {
      name: "Open Admin profile",
    });
    expect(profile).not.toHaveAttribute("href");
    expect(profile).toHaveTextContent("Admin User");
    expect(profile).toHaveTextContent("admin");
    const expandedAvatar = profile.querySelector(
      'img[src="https://example.test/admin-avatar.png"]',
    );
    expect(expandedAvatar).toHaveClass("rounded-full", "object-cover");
    expect(expandedAvatar.parentElement).toHaveClass(
      "rounded-full",
      "overflow-hidden",
    );
    expect(screen.queryByText("Admin Profile")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Switch to dark mode" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign Out" })).toHaveClass(
      "justify-center",
    );
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/admin/settings",
    );

    fireEvent.click(profile);
    expect(clerkMocks.openUserProfile).toHaveBeenCalledTimes(1);

    expanded.unmount();
    renderSidebar("/admin/inseminations", { collapsed: true });

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeVisible();
    const collapsedProfile = screen.getByRole("button", {
      name: "Open Admin profile",
    });
    expect(collapsedProfile).toBeVisible();
    expect(collapsedProfile).not.toHaveAttribute("href");
    const collapsedAvatar = collapsedProfile.querySelector(
      'img[src="https://example.test/admin-avatar.png"]',
    );
    expect(collapsedAvatar).toHaveClass("rounded-full", "object-cover");
    expect(collapsedAvatar.parentElement).toHaveClass(
      "rounded-full",
      "overflow-hidden",
    );
    expect(collapsedProfile.parentElement).toHaveAttribute(
      "data-tip",
      "Admin User",
    );
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeVisible();

    const recordsButton = screen.getByRole("button", {
      name: /Service Records, current section/,
    });
    fireEvent.click(recordsButton);

    expect(screen.getByRole("link", { name: "Inseminations" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps the collapsed Admin profile and Sign Out controls accessible", () => {
    renderSidebar("/admin/dashboard", { collapsed: true });

    const profile = screen.getByRole("button", {
      name: "Open Admin profile",
    });
    expect(profile).toBeVisible();
    expect(profile).toHaveAccessibleName("Open Admin profile");
    expect(profile.parentElement).toHaveAttribute("data-tip", "Admin User");
    expect(
      screen.queryByRole("button", { name: /Switch to .* mode/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeVisible();
  });

  it("keeps the active destination visually distinct and keyboard focusable", () => {
    renderSidebar("/admin/dashboard");

    const dashboard = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboard).toHaveAttribute("aria-current", "page");
    expect(dashboard).toHaveClass("bg-primary", "text-primary-content");
    expect(dashboard).toHaveClass("focus-visible:outline-primary");
  });

  it("gives navigation icons hover and focus motion with a reduced-motion fallback", () => {
    renderSidebar("/admin/dashboard");

    const dashboard = screen.getByRole("link", { name: "Dashboard" });
    const dashboardIcon = dashboard.querySelector("[data-sidebar-icon]");

    expect(dashboard).toHaveClass("group");
    expect(dashboardIcon).toHaveClass(
      "transition-transform",
      "duration-200",
      "group-hover:translate-x-0.5",
      "group-focus-visible:translate-x-0.5",
      "motion-reduce:transform-none",
      "motion-reduce:transition-none",
    );

    const serviceRecords = screen.getByRole("button", {
      name: "Service Records",
    });
    expect(serviceRecords).toHaveClass("group");
    expect(
      serviceRecords.querySelector("[data-sidebar-icon]"),
    ).toHaveClass("group-hover:translate-x-0.5");
  });
});
