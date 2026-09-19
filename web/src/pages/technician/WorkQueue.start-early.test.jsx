import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkQueue from "./WorkQueue";

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock("../../lib/axios", () => ({ default: { get: mocks.get, patch: mocks.patch, post: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("../../components/layout/Topbar", () => ({ default: ({ title }) => <h1>{title}</h1> }));
vi.mock("../../components/dialogs/AIServiceModal", () => ({ default: ({ isOpen }) => isOpen ? <div data-testid="ai-service-modal">AI service</div> : null }));
vi.mock("../../components/dialogs/HealthRequestActionModal", () => ({ default: () => null }));
vi.mock("../../components/dialogs/PregnancyDiagnosisModal", () => ({ default: () => null }));
vi.mock("../../components/dialogs/RecordCalvingModal", () => ({ default: () => null }));
vi.mock("../../components/dialogs/PregnancyLossReviewModal", () => ({ default: () => null }));

const id = "507f1f77bcf86cd799439011";
const task = (overrides = {}) => ({ id, workflowId: id, workflowType: "AI", type: "insemination", status: "scheduled", allowedAction: "VIEW_DETAILS", actionLabel: "View Scheduled Visit", workTiming: "upcoming", schedule: { date: "2099-12-01", visitPeriod: "afternoon" }, farmer: { id: "507f1f77bcf86cd799439012", name: "Mario Cabanig" }, animal: { id: "507f1f77bcf86cd799439013", name: "01MC", earTag: "01MC" }, raw: { _id: id, status: "scheduled", scheduledDate: "2099-12-01", visitPeriod: "afternoon", farmerPreparationNote: "Keep the cow secured." }, ...overrides });
const renderQueue = (items) => {
  mocks.get.mockResolvedValue({ data: { data: items, pagination: { page: 1, limit: 8, total: items.length, totalPages: 1 } } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><WorkQueue /></MemoryRouter></QueryClientProvider>);
};

describe("Technician Web AI calendar-date start policy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows future AI as details with Reschedule and no Start Early or recording action", async () => {
    renderQueue([task()]);
    fireEvent.click(await screen.findByRole("button", { name: "View Scheduled Visit" }));
    expect(screen.getByText("Scheduled AI Visit")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reschedule Visit" })).toBeInTheDocument();
    expect(screen.queryByText("Start service early?")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /record insemination/i })).not.toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("reschedules through the canonical endpoint and preserves the preparation note", async () => {
    mocks.patch.mockResolvedValue({ data: { request: { _id: id, status: "scheduled" } } });
    renderQueue([task()]);
    fireEvent.click(await screen.findByRole("button", { name: "View Scheduled Visit" }));
    fireEvent.click(screen.getByRole("button", { name: "Reschedule Visit" }));
    fireEvent.change(screen.getByLabelText("Visit date"), { target: { value: "2099-12-02" } });
    fireEvent.click(screen.getByRole("button", { name: "Save New Visit" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith(`/ai-request/${id}/status`, { status: "scheduled", scheduledDate: "2099-12-02", visitPeriod: "afternoon", farmerPreparationNote: "Keep the cow secured." }));
  });

  it("starts same-day Afternoon AI without early-start data, then opens recording", async () => {
    mocks.patch.mockResolvedValue({ data: { request: { _id: id, status: "in-progress", serviceStartedAt: "2026-09-18T00:00:00.000Z" } } });
    renderQueue([task({ allowedAction: "RECORD_SERVICE", actionLabel: "Record Insemination", workTiming: "actionable", schedule: { date: "2026-09-18", visitPeriod: "afternoon" } })]);
    fireEvent.click(await screen.findByRole("button", { name: "Record Insemination" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith(`/ai-request/${id}/status`, { status: "in-progress" }));
    expect(screen.queryByText("Start service early?")).not.toBeInTheDocument();
    expect(await screen.findByTestId("ai-service-modal")).toBeInTheDocument();
  });

  it("keeps overdue AI actionable", async () => {
    mocks.patch.mockResolvedValue({ data: { request: { _id: id, status: "in-progress" } } });
    renderQueue([task({ allowedAction: "RECORD_SERVICE", actionLabel: "Record Completed Service", workTiming: "overdue", schedule: { date: "2026-09-17", visitPeriod: "morning" } })]);
    fireEvent.click(await screen.findByRole("button", { name: "Record Completed Service" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith(`/ai-request/${id}/status`, { status: "in-progress" }));
  });
});
