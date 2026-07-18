import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkQueue from "./WorkQueue";
import axiosInstance from "../../lib/axios";

vi.mock("../../lib/axios", () => ({ default: { get: vi.fn(), put: vi.fn() } }));
vi.mock("../../components/ui/Topbar", () => ({ default: ({ title, subtitle }) => <header><h1>{title}</h1><p>{subtitle}</p></header> }));
vi.mock("../../components/modals/PregnancyDiagnosisModal", () => ({ default: ({ isOpen, taskData }) => isOpen ? <div>Pregnancy action for {taskData.raw.metadata.workflowStage}</div> : null }));

const renderQueue = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><WorkQueue /></MemoryRouter></QueryClientProvider>);
};

describe("Technician Work Queue", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a responsive table and card view with readable task vocabulary", async () => {
    axiosInstance.get.mockResolvedValue({ data: [{
      _id: "task-1", taskType: "PD", status: "Pending", dueDate: "2099-08-06T05:00:00.000Z",
      farmerId: { name: "Maria Farmer" }, animalIds: [{ _id: "animal-1", earTag: "ILO-101" }],
      technicianId: "tech-1", metadata: { workflowStage: "continuation_recheck", pregnancyId: "preg-1" },
      pregnancyReadiness: { isEligible: false, reason: "Initial lock must not apply" },
    }] });
    renderQueue();
    await waitFor(() => expect(screen.getAllByText("Continuation recheck").length).toBeGreaterThan(0));
    expect(screen.getByRole("table", { name: "Technician work queue" })).toBeInTheDocument();
    expect(screen.getAllByText("Maria Farmer").length).toBeGreaterThan(0);
    expect(screen.getAllByText("In progress").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: /Record continuation recheck/i })[0]);
    expect(screen.getByText("Pregnancy action for continuation_recheck")).toBeInTheDocument();
  });

  it("shows a filtered empty state and can clear filters", async () => {
    axiosInstance.get.mockResolvedValue({ data: [] });
    renderQueue();
    await waitFor(() => expect(screen.getByText("No tasks in this queue")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Filter by task type"), { target: { value: "PD" } });
    expect(screen.getByText("No tasks match these filters")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("No tasks in this queue")).toBeInTheDocument();
  });

  it("shows an error with retry", async () => {
    axiosInstance.get.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ data: [] });
    renderQueue();
    await waitFor(() => expect(screen.getByText("Couldn’t load the work queue")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
    await waitFor(() => expect(screen.getByText("No tasks in this queue")).toBeInTheDocument());
  });
});
