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
  "/technician/requests": {
    requests: [
      {
        id: "request-1",
        type: "health",
        status: "pending",
        urgency: "urgent",
        farmer: "Maria Farmer",
        barangay: "Poblacion East",
        assignedTechnician: "",
        createdAt: "2026-08-26T08:00:00.000Z",
      },
    ],
  },
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

  it("puts attention first and limits the primary metrics to three", async () => {
    renderDashboard();

    const attention = await screen.findByRole("heading", {
      name: "Needs Attention",
    });
    const pending = screen.getByRole("heading", { name: "Pending Requests" });

    expect(
      attention.compareDocumentPosition(pending) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getAllByTestId("operational-metric")).toHaveLength(3);
    expect(screen.queryByText("Service Request Overview")).not.toBeInTheDocument();
    expect(screen.queryByText("Service Trends")).not.toBeInTheDocument();
  });

  it("uses distinct semantic tones for the three operational metrics", async () => {
    renderDashboard();

    await screen.findByRole("heading", { name: "Needs Attention" });
    expect(
      screen.getByText("Requests Waiting").closest("[data-tone]"),
    ).toHaveAttribute("data-tone", "warning");
    expect(
      screen.getByText("Active Technicians").closest("[data-tone]"),
    ).toHaveAttribute("data-tone", "success");
    expect(
      screen.getByText("Urgent Cases").closest("[data-tone]"),
    ).toHaveAttribute("data-tone", "error");
  });

  it("uses rounded Technician avatars and typed recent-activity icons", async () => {
    const { container } = renderDashboard();

    const avatar = await screen.findByRole("img", {
      name: "Technician One profile",
    });
    expect(avatar).toHaveClass("rounded-full", "object-cover");
    expect(avatar.parentElement).toHaveClass("rounded-full");

    expect(screen.getByText("Technician reassigned")).toBeInTheDocument();
    expect(screen.queryByText("Technician Reassigned")).not.toBeInTheDocument();

    const activityIcon = container.querySelector(".lucide-user-round-check");
    expect(activityIcon).toBeInTheDocument();
    expect(activityIcon.parentElement).toHaveClass(
      "rounded-full",
      "bg-info/10",
      "text-info",
    );
  });

  it("keeps request and oversight actions navigation-only", async () => {
    renderDashboard();

    const requestLinks = await screen.findAllByRole("link", {
      name: "Open Request",
    });
    expect(requestLinks).not.toHaveLength(0);
    requestLinks.forEach((link) => {
      expect(link).toHaveAttribute(
        "href",
        "/admin/requests?requestId=request-1&status=all",
      );
    });

    expect(
      screen.getByRole("link", { name: "View Workload" }),
    ).toHaveAttribute("href", "/admin/work-queue");
    expect(
      screen.getByRole("link", { name: "View Audit Logs" }),
    ).toHaveAttribute("href", "/admin/audit-logs");

    expect(
      screen.queryByRole("button", { name: /assign|start|complete/i }),
    ).not.toBeInTheDocument();
  });

  it("routes inactive Technician review to canonical Technician Users mode", async () => {
    setResponses({
      ...populatedResponses,
      "/user?role=technician": [
        {
          ...populatedResponses["/user?role=technician"][0],
          status: "inactive",
        },
      ],
    });
    renderDashboard();

    expect(
      await screen.findByRole("link", {
        name: "Review: Technician is inactive",
      }),
    ).toHaveAttribute("href", "/admin/users?role=technician");
  });

  it("keeps the approved compact sections in two responsive pairings", async () => {
    renderDashboard();

    const immediateWork = await screen.findByRole("region", {
      name: "Immediate Admin work",
    });
    const operationalOverview = screen.getByRole("region", {
      name: "Operational overview",
    });

    expect(
      within(immediateWork).getByRole("heading", { name: "Needs Attention" }),
    ).toBeInTheDocument();
    expect(
      within(immediateWork).getByRole("heading", { name: "Pending Requests" }),
    ).toBeInTheDocument();
    expect(
      within(operationalOverview).getByRole("heading", {
        name: "Recent Admin Activity",
      }),
    ).toBeInTheDocument();
    expect(
      within(operationalOverview).getByRole("heading", {
        name: "Technician Workload",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Barangays Needing Attention" }),
    ).not.toBeInTheDocument();
    expect(axiosInstance.get).not.toHaveBeenCalledWith(
      "/admin/barangays/insights",
    );
  });

  it("renders calm empty states without technical copy", async () => {
    setResponses({
      "/admin/technician-workload-summary": { technicians: [] },
      "/user?role=technician": [],
      "/technician/requests": { requests: [] },
      "/audit-logs": { logs: [] },
    });

    renderDashboard();

    await waitFor(() =>
      expect(screen.getByText("All caught up")).toBeInTheDocument(),
    );
    expect(screen.getByText("No pending requests")).toBeInTheDocument();
    expect(screen.getByText("No workload information")).toBeInTheDocument();
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
      screen.getByRole("heading", { name: "Pending Requests" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("We could not load recent Admin activity."),
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
    expect(axiosInstance.get).not.toHaveBeenCalledWith("/admin/monitoring");

    const source = readFileSync("src/pages/admin/Dashboard.jsx", "utf8");
    expect(source).toContain("refetchInterval: 1000 * 45");
    expect(source).not.toContain('axiosInstance.get("/admin/monitoring")');
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
