import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "../../lib/axios";
import AuditLogs from "./AuditLogs";
import {
  AUDIT_ENTITY_OPTIONS,
  compactAuditValue,
  formatAuditAction,
  formatAuditEntity,
  resolveAuditActionSearch,
} from "./auditLogPresentation";

vi.mock("../../lib/axios", () => ({
  default: { get: vi.fn() },
}));

vi.mock("../../components/layout/Topbar", () => ({
  default: ({ title, subtitle }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  ),
}));

const canonicalLog = {
  _id: "audit-1",
  action: "backup_completed",
  entityType: "System",
  entityId: "507f1f77bcf86cd799439011",
  actorId: { _id: "admin-1", name: "Admin One", role: "admin" },
  createdAt: "2026-08-27T08:02:00.000Z",
  before: {
    status: "started",
    emptyValue: null,
    note: "historical private note",
  },
  after: { status: "completed", emptyObject: {} },
  metadata: {
    failureCategory: "none",
    clerkId: "historical-clerk-id",
  },
};

const pagedResponse = ({ data = [canonicalLog], page = 1, total = 101, totalPages = 3 } = {}) => ({
  data: { data, page, limit: 50, total, totalPages },
});

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuditLogs />
    </QueryClientProvider>,
  );
};

describe("Audit Logs presentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps active historical actions, future aliases, entities, and unknown actions", () => {
    expect(formatAuditAction("backup_completed")).toBe("System Data Export Completed");
    expect(formatAuditAction("backup_started")).toBe("System Data Export Started");
    expect(formatAuditAction("create_technician")).toBe("Technician Account Created");
    expect(formatAuditAction("RECORD_AI_SERVICE")).toBe("AI Service Recorded");
    expect(formatAuditAction("record_pregnancy_diagnosis")).toBe("Pregnancy Diagnosis Recorded");
    expect(formatAuditAction("create_calving_record")).toBe("Calving Record Created");
    expect(formatAuditAction("system_data_export.completed")).toBe("System Data Export Completed");
    expect(formatAuditAction("ai.service_recorded")).toBe("AI Service Recorded");
    expect(formatAuditAction("future_workflow.ready_for_review")).toBe("Future Workflow Ready For Review");
    expect(formatAuditEntity("Insemination")).toBe("AI / Insemination");
    expect(formatAuditEntity("HealthRequest")).toBe("Health");
    expect(AUDIT_ENTITY_OPTIONS.map(({ value }) => value)).toEqual(
      expect.arrayContaining([
        "User", "Animal", "AIRequest", "Insemination", "HealthRequest",
        "Pregnancy", "Calving", "System", "Task",
      ]),
    );
  });

  it("translates friendly activity searches without losing raw-action compatibility", () => {
    expect(resolveAuditActionSearch("System Data Export Completed")).toContain("backup_completed");
    expect(resolveAuditActionSearch("System Data Export Completed")).toContain("system_data_export\\.completed");
    expect(resolveAuditActionSearch("custom_raw_action")).toBe("custom_raw_action");
  });

  it("removes empty and historical sensitive detail values", () => {
    expect(compactAuditValue(canonicalLog.before)).toEqual({ status: "started" });
    expect(compactAuditValue(canonicalLog.metadata)).toEqual({ failureCategory: "none" });
  });

  it("renders friendly rows, backend total, actor, timestamp, and collapsed details", async () => {
    axiosInstance.get.mockResolvedValue(pagedResponse({ total: 127, totalPages: 3 }));
    const view = renderPage();

    expect(await screen.findByText("System Data Export Completed")).toBeInTheDocument();
    const row = screen.getByRole("article", {
      name: "System Data Export Completed",
    });
    expect(within(row).getByText("System")).toBeInTheDocument();
    expect(screen.getByText(/Admin One/)).toBeInTheDocument();
    expect(screen.getByLabelText("127 total audit entries")).toHaveTextContent("127");
    expect(view.container.querySelector("time")).toHaveAttribute(
      "datetime",
      canonicalLog.createdAt,
    );
    expect(screen.queryByText("Before")).not.toBeInTheDocument();
    expect(screen.queryByText("historical private note")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();
    expect(screen.getByText("Metadata")).toBeInTheDocument();
    expect(screen.getByText("Entity ID")).toBeInTheDocument();
    expect(screen.queryByText("Empty Value")).not.toBeInTheDocument();
    expect(screen.queryByText("Empty Object")).not.toBeInTheDocument();
    expect(screen.queryByText("Clerk ID")).not.toBeInTheDocument();
    expect(screen.queryByText("historical private note")).not.toBeInTheDocument();
  });

  it("uses backend pagination and resets to page one when a filter changes", async () => {
    axiosInstance.get.mockImplementation(async (_url, config) =>
      pagedResponse({ page: config.params.page, total: 101, totalPages: 3 }),
    );
    renderPage();

    await screen.findByText("Page 1 of 3");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page 2 of 3");
    expect(axiosInstance.get).toHaveBeenLastCalledWith("/audit-logs", {
      params: expect.objectContaining({ page: 2, limit: 50 }),
    });

    fireEvent.change(
      screen.getByRole("combobox", { name: "Filter audit logs by category" }),
      { target: { value: "HealthRequest" } },
    );
    await waitFor(() =>
      expect(axiosInstance.get).toHaveBeenLastCalledWith("/audit-logs", {
        params: expect.objectContaining({ entityType: "HealthRequest", page: 1 }),
      }),
    );
    await screen.findByText("Page 1 of 3");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  it("maps friendly search text to the raw backend action filter", async () => {
    axiosInstance.get.mockResolvedValue(pagedResponse());
    renderPage();
    await screen.findByText("System Data Export Completed");

    fireEvent.change(screen.getByRole("textbox", { name: "Search activity" }), {
      target: { value: "System Data Export Completed" },
    });
    await waitFor(() => {
      const latestConfig = axiosInstance.get.mock.calls.at(-1)[1];
      expect(latestConfig.params.page).toBe(1);
      expect(latestConfig.params.action).toContain("backup_completed");
    });
  });

  it("preserves loading, error/retry, and empty states", async () => {
    axiosInstance.get.mockReturnValueOnce(new Promise(() => {}));
    const loadingView = renderPage();
    expect(screen.getByLabelText("Loading audit logs")).toBeInTheDocument();
    loadingView.unmount();

    axiosInstance.get.mockRejectedValueOnce(new Error("network unavailable"));
    axiosInstance.get.mockResolvedValueOnce(pagedResponse({ data: [], total: 0, totalPages: 0 }));
    const errorView = renderPage();
    expect(await screen.findByText("Failed to load audit logs.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No audit activity yet")).toBeInTheDocument();
    errorView.unmount();

    axiosInstance.get.mockResolvedValue(pagedResponse({ data: [], total: 0, totalPages: 0 }));
    renderPage();
    expect(await screen.findByText("No audit activity yet")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
  });
});
