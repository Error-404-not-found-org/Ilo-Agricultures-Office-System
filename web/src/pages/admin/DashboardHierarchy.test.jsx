import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
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
  "/admin/monitoring": {
    moowieInsights: {
      technicianWorkloads: [
        { name: "Technician One", activeRequests: 3 },
      ],
    },
  },
  "/admin/barangays/insights": [
    {
      barangay: "Poblacion East",
      pendingHealthRequests: 2,
      pendingAIRequests: 1,
      incompleteRecordsCount: 1,
    },
  ],
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
      screen.getByRole("link", { name: "View Barangays" }),
    ).toHaveAttribute("href", "/admin/barangays");
    expect(
      screen.getByRole("link", { name: "View Audit Logs" }),
    ).toHaveAttribute("href", "/admin/audit-logs");

    expect(
      screen.queryByRole("button", { name: /assign|start|complete/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps all responsive dashboard sections rendered", async () => {
    renderDashboard();

    await screen.findByRole("heading", { name: "Needs Attention" });
    expect(
      screen.getByRole("heading", { name: "Pending Requests" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Technician Workload" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Barangays Needing Attention" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Recent Admin Activity" }),
    ).toBeInTheDocument();
  });

  it("renders calm empty states without technical copy", async () => {
    setResponses({
      "/admin/monitoring": { moowieInsights: { technicianWorkloads: [] } },
      "/admin/barangays/insights": [],
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
    expect(
      screen.getByText("No barangays need attention"),
    ).toBeInTheDocument();
    expect(screen.getByText("No recent activity")).toBeInTheDocument();

    document.querySelectorAll("[data-empty-state]").forEach((emptyState) => {
      expect(emptyState).toHaveClass("py-5");
      expect(emptyState.querySelector("svg")).toBeInTheDocument();
    });
  });

  it("keeps healthy sections usable when one source fails", async () => {
    axiosInstance.get.mockImplementation(async (url) => {
      if (url === "/admin/barangays/insights") {
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
      screen.getByText("Barangay information could not be loaded."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Recent Admin Activity" }),
    ).toBeInTheDocument();
  });
});
