import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "../../lib/axios";
import AuditLogs from "./AuditLogs";
import {
  AUDIT_ENTITY_OPTIONS,
  formatAuditAction,
  formatAuditEntity,
  getAuditDetailSections,
  getMeaningfulAuditDetails,
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
  updatedAt: "2026-08-27T08:03:00.000Z",
  before: {
    status: "started",
    createdAt: "2026-08-27T08:00:00.000Z",
    requestId: "507f1f77bcf86cd799439012",
    note: "historical private note",
  },
  after: {
    status: "completed",
    role: "admin",
    outcome: "Export ready",
    updatedAt: "2026-08-27T08:03:00.000Z",
  },
  metadata: {
    targetName: "System data export",
    animalTag: "OTON-104",
    serviceType: "System export",
    reason: "Requested by Admin",
    result: "Completed",
    failureCategory: "none",
    requestId: "507f1f77bcf86cd799439012",
    createdAt: "2026-08-27T08:00:00.000Z",
    clerkId: "historical-clerk-id",
  },
};

const createLogs = (count, page = 1) =>
  Array.from({ length: count }, (_, index) => ({
    ...canonicalLog,
    _id: `audit-${page}-${index + 1}`,
  }));

const pagedResponse = ({
  data = [canonicalLog],
  page = 1,
  total = 24,
  totalPages = 3,
  limit = 10,
} = {}) => ({
  data: { data, page, limit, total, totalPages },
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

  it("maps historical actions, aliases, entities, and friendly search values", () => {
    expect(formatAuditAction("backup_completed")).toBe(
      "System Data Export Completed",
    );
    expect(formatAuditAction("RECORD_AI_SERVICE")).toBe("AI Service Recorded");
    expect(formatAuditAction("record_pregnancy_diagnosis")).toBe(
      "Pregnancy Diagnosis Recorded",
    );
    expect(formatAuditAction("system_data_export.completed")).toBe(
      "System Data Export Completed",
    );
    expect(formatAuditAction("future_workflow.ready_for_review")).toBe(
      "Future Workflow Ready For Review",
    );
    expect(formatAuditEntity("Insemination")).toBe("AI / Insemination");
    expect(formatAuditEntity("HealthRequest")).toBe("Health");
    expect(AUDIT_ENTITY_OPTIONS.map(({ value }) => value)).toEqual(
      expect.arrayContaining([
        "User",
        "Animal",
        "AIRequest",
        "Insemination",
        "HealthRequest",
        "Pregnancy",
        "Calving",
        "System",
        "Task",
      ]),
    );
    expect(resolveAuditActionSearch("System Data Export Completed")).toContain(
      "backup_completed",
    );
    expect(resolveAuditActionSearch("custom_raw_action")).toBe(
      "custom_raw_action",
    );
  });

  it("keeps only meaningful factual details and drops IDs, timestamps, and private metadata", () => {
    expect(getMeaningfulAuditDetails(canonicalLog.metadata)).toEqual([
      { label: "Affected user", value: "System data export" },
      { label: "Animal tag", value: "OTON-104" },
      { label: "Service type", value: "System export" },
      { label: "Reason", value: "Requested by Admin" },
      { label: "Result", value: "Completed" },
      { label: "Result category", value: "none" },
    ]);
    expect(getMeaningfulAuditDetails(canonicalLog.before)).toEqual([
      { label: "Status", value: "started" },
    ]);
    expect(
      getAuditDetailSections(canonicalLog).map(({ label }) => label),
    ).toEqual(["Before", "After", "Details"]);
  });

  it("renders friendly rows and curated details without technical identifiers or duplicate timestamps", async () => {
    axiosInstance.get.mockResolvedValue(
      pagedResponse({ data: [canonicalLog], total: 1, totalPages: 1 }),
    );
    const view = renderPage();

    expect(
      await screen.findByText("System Data Export Completed"),
    ).toBeInTheDocument();
    const row = screen.getByRole("article", {
      name: "System Data Export Completed",
    });
    expect(within(row).getByText("System")).toBeInTheDocument();
    expect(screen.getByText(/Admin One/)).toBeInTheDocument();
    expect(view.container.querySelector("time")).toHaveAttribute(
      "datetime",
      canonicalLog.createdAt,
    );
    expect(screen.queryByText("Before")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View details" }));

    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText("Affected user")).toBeInTheDocument();
    expect(screen.getByText("System data export")).toBeInTheDocument();
    expect(screen.getByText("Animal tag")).toBeInTheDocument();
    expect(screen.getByText("OTON-104")).toBeInTheDocument();
    expect(screen.getByText("Reason")).toBeInTheDocument();
    expect(screen.getByText("Requested by Admin")).toBeInTheDocument();
    expect(screen.getByText("Outcome")).toBeInTheDocument();
    expect(screen.getByText("Export ready")).toBeInTheDocument();

    expect(screen.queryByText("Entity ID")).not.toBeInTheDocument();
    expect(screen.queryByText(canonicalLog.entityId)).not.toBeInTheDocument();
    expect(screen.queryByText("Request ID")).not.toBeInTheDocument();
    expect(screen.queryByText("Created At")).not.toBeInTheDocument();
    expect(screen.queryByText("Updated At")).not.toBeInTheDocument();
    expect(screen.queryByText("Metadata")).not.toBeInTheDocument();
    expect(
      screen.queryByText("historical private note"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("historical-clerk-id")).not.toBeInTheDocument();
    expect(view.container.querySelector("pre")).not.toBeInTheDocument();
  });

  it("uses 10-row backend pages across all 24 records with working Next and Previous controls", async () => {
    axiosInstance.get.mockImplementation(async (_url, config) => {
      const requestedPage = config.params.page;
      const count = requestedPage === 3 ? 4 : 10;
      return pagedResponse({
        data: createLogs(count, requestedPage),
        page: requestedPage,
      });
    });
    renderPage();

    await screen.findByText("Page 1 of 3");
    expect(screen.getByText("Showing 1–10 of 24")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(10);
    expect(axiosInstance.get).toHaveBeenLastCalledWith("/audit-logs", {
      params: expect.objectContaining({ page: 1, limit: 10 }),
    });
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page 2 of 3");
    expect(screen.getByText("Showing 11–20 of 24")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(10);
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page 3 of 3");
    expect(screen.getByText("Showing 21–24 of 24")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await screen.findByText("Page 2 of 3");
    expect(axiosInstance.get).toHaveBeenLastCalledWith("/audit-logs", {
      params: expect.objectContaining({ page: 2, limit: 10 }),
    });
  });

  it("resets backend pagination when Category or Search changes", async () => {
    axiosInstance.get.mockImplementation(async (_url, config) =>
      pagedResponse({
        data: createLogs(10, config.params.page),
        page: config.params.page,
      }),
    );
    renderPage();

    await screen.findByText("Page 1 of 3");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page 2 of 3");

    fireEvent.change(
      screen.getByRole("combobox", {
        name: "Filter audit logs by category",
      }),
      { target: { value: "HealthRequest" } },
    );
    await waitFor(() =>
      expect(axiosInstance.get).toHaveBeenLastCalledWith("/audit-logs", {
        params: expect.objectContaining({
          entityType: "HealthRequest",
          page: 1,
          limit: 10,
        }),
      }),
    );
    await screen.findByText("Page 1 of 3");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page 2 of 3");
    fireEvent.change(screen.getByRole("textbox", { name: "Search activity" }), {
      target: { value: "System Data Export Completed" },
    });
    await waitFor(() => {
      const latestConfig = axiosInstance.get.mock.calls.at(-1)[1];
      expect(latestConfig.params.page).toBe(1);
      expect(latestConfig.params.limit).toBe(10);
      expect(latestConfig.params.action).toContain("backup_completed");
    });
  });

  it("uses natural page scrolling and preserves loading, error, retry, and empty states", async () => {
    axiosInstance.get.mockReturnValueOnce(new Promise(() => {}));
    const loadingView = renderPage();
    expect(screen.getByLabelText("Loading audit logs")).toBeInTheDocument();
    expect(loadingView.container.firstChild).toHaveClass("overflow-y-auto");
    expect(loadingView.container.querySelector("main")).not.toHaveClass(
      "overflow-hidden",
    );
    loadingView.unmount();

    axiosInstance.get.mockRejectedValueOnce(new Error("network unavailable"));
    axiosInstance.get.mockResolvedValueOnce(
      pagedResponse({ data: [], total: 0, totalPages: 0 }),
    );
    const errorView = renderPage();
    expect(
      await screen.findByText("Failed to load audit logs."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByText("No audit activity yet"),
    ).toBeInTheDocument();
    errorView.unmount();

    axiosInstance.get.mockResolvedValue(
      pagedResponse({ data: [], total: 0, totalPages: 0 }),
    );
    renderPage();
    expect(
      await screen.findByText("No audit activity yet"),
    ).toBeInTheDocument();
    expect(screen.getByText("Showing 0–0 of 0")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
  });
});
