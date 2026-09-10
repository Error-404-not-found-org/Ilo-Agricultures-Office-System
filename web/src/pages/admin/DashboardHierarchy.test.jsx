import { readFileSync } from "node:fs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "../../lib/axios";
import Dashboard from "./Dashboard";

const mocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../../lib/axios", () => ({
  default: { get: vi.fn() },
}));

vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));

vi.mock("../../components/layout/Topbar", () => ({
  default: ({ title, subtitle, children }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </header>
  ),
}));

const populatedResponses = {
  "/admin/stats": {
    totalUsers: 99,
    farmers: 12,
    technicians: 4,
    animals: 31,
  },
  "/admin/technician-workload-summary": {
    technicians: [
      {
        technicianId: "technician-1",
        name: "Technician One",
        activeWorkloadTotal: 3,
        counts: { ai: 1, health: 1, pregnancy: 1, calving: 0, tasks: 0 },
      },
    ],
  },
  "/user?role=technician": [
    {
      _id: "technician-1",
      name: "Technician One",
      imageUrl: "https://example.test/technician-one.png",
      status: "active",
      dispatchProfile: { acceptsNewRequests: true },
    },
  ],
  "/audit-logs": {
    logs: [
      {
        _id: "audit-1",
        action: "technician_reassigned",
        entityType: "Health request",
        actorId: { name: "Admin User" },
        createdAt: "2026-08-26T09:00:00.000Z",
      },
    ],
  },
};

function setResponses(responses) {
  axiosInstance.get.mockImplementation(async (url) => ({
    data: responses[url],
  }));
}

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Admin Dashboard hierarchy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setResponses(populatedResponses);
  });

  it("uses the canonical three-count Overview", async () => {
    renderDashboard();

    await screen.findByRole("heading", { name: "Overview" });
    expect(screen.getAllByTestId("operational-metric")).toHaveLength(3);
    expect(screen.getByText("Total Farmers")).toBeInTheDocument();
    expect(await screen.findByText("12")).toBeInTheDocument();
    expect(screen.getByText("Total Technicians")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Total Animals")).toBeInTheDocument();
    expect(screen.getByText("31")).toBeInTheDocument();

    expect(axiosInstance.get).toHaveBeenCalledWith("/admin/stats");
    expect(screen.queryByText("99")).not.toBeInTheDocument();
  });

  it("removes the capped request summaries and misleading metrics", async () => {
    renderDashboard();

    await screen.findByRole("heading", { name: "Overview" });
    expect(screen.queryByText("Requests Waiting")).not.toBeInTheDocument();
    expect(screen.queryByText("Active Technicians")).not.toBeInTheDocument();
    expect(screen.queryByText("Urgent Cases")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Needs Attention" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Pending Requests" }),
    ).not.toBeInTheDocument();

    const source = readFileSync("src/pages/admin/Dashboard.jsx", "utf8");
    expect(source).not.toContain('axiosInstance.get("/technician/requests"');
    expect(source).not.toContain('status !== "inactive"');
  });

  it("uses rounded Technician avatars and typed recent-activity icons", async () => {
    renderDashboard();

    const avatar = await screen.findByRole("img", {
      name: "Technician One profile",
    });
    expect(avatar).toHaveClass("rounded-full", "object-cover");
    expect(avatar.parentElement).toHaveClass("rounded-full");

    expect(screen.getByText("Technician reassigned")).toBeInTheDocument();
    expect(screen.queryByText("Technician Reassigned")).not.toBeInTheDocument();

    const auditActivity = screen.getByRole("region", {
      name: "Recent Audit Activity",
    });
    const activityIcon = auditActivity.querySelector(".lucide-user-round-check");
    expect(activityIcon).toBeInTheDocument();
    expect(activityIcon.parentElement).toHaveClass(
      "rounded-full",
      "bg-info/10",
      "text-info",
    );
  });

  it("keeps workload and Audit Log navigation available", async () => {
    renderDashboard();

    expect(
      await screen.findByRole("link", { name: "View Workload" }),
    ).toHaveAttribute("href", "/admin/work-queue");
    expect(
      screen.getByRole("link", { name: "View Audit Logs" }),
    ).toHaveAttribute("href", "/admin/audit-logs");

    const sidebarSource = readFileSync("src/components/layout/Sidebar.jsx", "utf8");
    expect(sidebarSource).toContain('path: "/admin/requests"');
    expect(sidebarSource).toContain('path: "/admin/work-queue"');
    expect(sidebarSource).toContain('path: "/admin/audit-logs"');

    expect(
      screen.queryByRole("button", { name: /assign|start|complete/i }),
    ).not.toBeInTheDocument();
  });

  it("renders only the approved Dashboard sections in the requested order", async () => {
    renderDashboard();

    const overview = await screen.findByRole("heading", { name: "Overview" });
    const details = screen.getByRole("region", {
      name: "Dashboard details",
    });
    const workload = within(details).getByRole("heading", {
      name: "Technician Workload",
    });
    const audit = within(details).getByRole("heading", {
      name: "Recent Audit Activity",
    });

    expect(
      overview.compareDocumentPosition(workload) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      workload.compareDocumentPosition(audit) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(3);
  });

  it("renders calm empty states without technical copy", async () => {
    setResponses({
      "/admin/stats": { totalUsers: 0, farmers: 0, technicians: 0, animals: 0 },
      "/admin/technician-workload-summary": { technicians: [] },
      "/user?role=technician": [],
      "/audit-logs": { logs: [] },
    });

    renderDashboard();

    await waitFor(() =>
      expect(screen.getByText("No workload information")).toBeInTheDocument(),
    );
    expect(screen.getByText("No recent activity")).toBeInTheDocument();

    document.querySelectorAll("[data-empty-state]").forEach((emptyState) => {
      expect(emptyState).toHaveClass("py-5");
      expect(emptyState.querySelector("svg")).toBeInTheDocument();
    });
  });

  it("keeps healthy sections usable when one source fails", async () => {
    axiosInstance.get.mockImplementation(async (url) => {
      if (url === "/audit-logs") {
        throw new Error("network unavailable");
      }
      return { data: populatedResponses[url] };
    });

    renderDashboard();

    await screen.findByText("Some dashboard sections are unavailable");
    expect(
      screen.getByRole("heading", { name: "Overview" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("We could not load recent audit activity."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Technician Workload" }),
    ).toBeInTheDocument();
  });

  it("uses the narrow workload endpoint and preserves the 45-second polling cadence", async () => {
    renderDashboard();

    await screen.findByRole("heading", { name: "Technician Workload" });
    expect(axiosInstance.get).toHaveBeenCalledWith(
      "/admin/technician-workload-summary",
    );
    expect(axiosInstance.get).toHaveBeenCalledWith("/admin/stats");
    expect(axiosInstance.get).not.toHaveBeenCalledWith("/admin/monitoring");

    const source = readFileSync("src/pages/admin/Dashboard.jsx", "utf8");
    expect(source).toContain("refetchInterval: 1000 * 45");
    expect(source).not.toContain('axiosInstance.get("/admin/monitoring")');
    expect(source).not.toContain('axiosInstance.get("/technician/requests")');
    await screen.findByText("Technician One");
    expect(screen.getByText("active work")).toBeInTheDocument();
  });

  it("maps duplicate Technician names by stable IDs", async () => {
    setResponses({
      ...populatedResponses,
      "/admin/technician-workload-summary": {
        technicians: [
          {
            technicianId: "technician-1",
            name: "Same Name",
            activeWorkloadTotal: 1,
          },
          {
            technicianId: "technician-2",
            name: "Same Name",
            activeWorkloadTotal: 4,
          },
        ],
      },
      "/user?role=technician": [
        {
          _id: "technician-1",
          name: "Same Name",
          status: "active",
          dispatchProfile: { acceptsNewRequests: true },
        },
        {
          _id: "technician-2",
          name: "Same Name",
          status: "active",
          dispatchProfile: { acceptsNewRequests: true },
        },
      ],
    });

    renderDashboard();

    const workload = await screen.findByRole("region", {
      name: "Technician Workload",
    });
    expect(await within(workload).findAllByText("Same Name")).toHaveLength(2);
    expect(within(workload).getByText("1")).toBeInTheDocument();
    expect(within(workload).getByText("4")).toBeInTheDocument();
  });
});
