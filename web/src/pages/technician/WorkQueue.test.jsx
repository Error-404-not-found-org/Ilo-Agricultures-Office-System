import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkQueue from "./WorkQueue";
import axiosInstance from "../../lib/axios";

vi.mock("../../lib/axios", () => ({ default: { get: vi.fn(), put: vi.fn() } }));
vi.mock("../../components/layout/Topbar", () => ({ default: ({ title, subtitle }) => <header><h1>{title}</h1><p>{subtitle}</p></header> }));
vi.mock("../../components/dialogs/PregnancyDiagnosisModal", () => ({ default: ({ isOpen, taskData }) => isOpen ? <div>Pregnancy action for {taskData.raw.metadata.workflowStage}</div> : null }));

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

  it("verifies Work Queue filters and search elements have id, name, and accessible label", async () => {
    axiosInstance.get.mockResolvedValue({ data: [] });
    renderQueue();
    await waitFor(() => expect(screen.getByText("No tasks in this queue")).toBeInTheDocument());

    // 1. Search input
    const searchInput = screen.getByPlaceholderText("Search farmer, animal, or task");
    expect(searchInput).toHaveAttribute("id", "work-queue-search");
    expect(searchInput).toHaveAttribute("name", "work-queue-search");
    expect(screen.getByText("Search tasks")).toHaveAttribute("for", "work-queue-search");

    // 2. Scope filter (tablist)
    const scopeContainer = screen.getByRole("tablist", { name: "Queue scope" });
    expect(scopeContainer).toHaveAttribute("id", "work-queue-scope");

    // 3. Task type select
    const typeSelect = screen.getByLabelText("Filter by task type");
    expect(typeSelect).toHaveAttribute("id", "work-queue-task-type");
    expect(typeSelect).toHaveAttribute("name", "work-queue-task-type");
    expect(screen.getByText("Filter by task type")).toHaveAttribute("for", "work-queue-task-type");

    // 4. Status select
    const statusSelect = screen.getByLabelText("Filter by task status");
    expect(statusSelect).toHaveAttribute("id", "work-queue-status");
    expect(statusSelect).toHaveAttribute("name", "work-queue-status");
    expect(screen.getByText("Filter by task status")).toHaveAttribute("for", "work-queue-status");
  });

  it("verifies repeated task cards do not produce duplicate IDs", async () => {
    axiosInstance.get.mockResolvedValue({ data: [
      {
        _id: "task-abc", taskType: "PD", status: "Pending", dueDate: "2099-08-06T05:00:00.000Z",
        farmerId: { name: "Farmer A" }, animalIds: [{ _id: "animal-1", earTag: "ILO-101" }],
        technicianId: "tech-1", pregnancyReadiness: { isEligible: false, reason: "Lock reason A" },
      },
      {
        _id: "task-xyz", taskType: "PD", status: "Pending", dueDate: "2099-08-06T05:00:00.000Z",
        farmerId: { name: "Farmer B" }, animalIds: [{ _id: "animal-2", earTag: "ILO-102" }],
        technicianId: "tech-1", pregnancyReadiness: { isEligible: false, reason: "Lock reason B" },
      }
    ] });
    renderQueue();
    await waitFor(() => expect(screen.getAllByText("Farmer A").length).toBeGreaterThan(0));

    // Verify unique IDs derived from task ID are rendered in cards
    const lockSpan1 = document.querySelector("#task-lock-task-abc");
    const lockSpan2 = document.querySelector("#task-lock-task-xyz");
    // Sibling elements in separate cards do not duplicate the same ID
    expect(lockSpan1).toBeInTheDocument();
    expect(lockSpan2).toBeInTheDocument();
    expect(lockSpan1).not.toBe(lockSpan2);
  });

  it("renders the desktop table inside a scroll container with horizontal overflow support", async () => {
    axiosInstance.get.mockResolvedValue({ data: [{
      _id: "task-1", taskType: "PD", status: "Pending", dueDate: "2099-08-06T05:00:00.000Z",
      farmerId: { name: "Maria Farmer" }, animalIds: [{ _id: "animal-1", earTag: "ILO-101" }],
      technicianId: "tech-1",
    }] });
    renderQueue();
    await waitFor(() => expect(screen.getByTestId("work-queue-table-scroll")).toBeInTheDocument());
    const scrollContainer = screen.getByTestId("work-queue-table-scroll");
    expect(scrollContainer.className).toContain("overflow-x-auto");
    const table = screen.getByRole("table", { name: "Technician work queue" });
    expect(scrollContainer).toContainElement(table);
  });

  it("renders backend priority and recorded identity fields without fabricated profile data", async () => {
    axiosInstance.get.mockResolvedValue({ data: [{
      _id: "task-priority", taskType: "Health", category: "Urgent", priority: 1,
      status: "Pending", dueDate: "2099-08-06T05:00:00.000Z",
      farmerId: { name: "Elena Ramos" },
      animalIds: [{ _id: "animal-priority", earTag: "ILO-204" }],
      technicianId: "tech-1",
    }] });

    renderQueue();

    await waitFor(() => expect(screen.getAllByText("Elena Ramos").length).toBeGreaterThan(0));
    expect(screen.getByRole("table", { name: "Technician work queue" })).toHaveTextContent("High");
    expect(screen.queryByText("Juan Dela Cruz")).not.toBeInTheDocument();
    expect(document.querySelector('img[src*="dicebear"]')).not.toBeInTheDocument();
  });

  it("uses the farmer profile image and a round user-icon fallback when it is missing", async () => {
    axiosInstance.get.mockResolvedValue({ data: [
      {
        _id: "task-with-image", taskType: "Health", priority: 2, status: "Pending",
        dueDate: "2099-08-06T05:00:00.000Z", technicianId: "tech-1",
        farmerId: { _id: "farmer-image", name: "Image Farmer", imageUrl: "https://example.com/farmer.jpg" },
        animalIds: [{ _id: "animal-image", earTag: "ILO-501" }],
      },
      {
        _id: "task-without-image", taskType: "Health", priority: 2, status: "Pending",
        dueDate: "2099-08-07T05:00:00.000Z", technicianId: "tech-1",
        farmerId: { _id: "farmer-fallback", name: "Fallback Farmer", imageUrl: "" },
        animalIds: [{ _id: "animal-fallback", earTag: "ILO-502" }],
      },
    ] });

    renderQueue();

    const image = await screen.findByAltText("Image Farmer profile");
    expect(image).toHaveAttribute("src", "https://example.com/farmer.jpg");
    expect(image).toHaveClass("rounded-full", "object-cover");

    const fallback = screen.getByLabelText("Fallback Farmer profile image unavailable");
    expect(fallback).toHaveClass("avatar-placeholder");
    expect(fallback.firstElementChild).toHaveClass("rounded-full", "overflow-hidden");
  });

  it("claims an available task only through the explicit accessible action", async () => {
    axiosInstance.get.mockResolvedValue({ data: [{
      _id: "task-available", taskType: "GeneralVisit", category: "Routine", priority: 2,
      status: "Pending", dueDate: "2099-08-06T05:00:00.000Z",
      farmerId: { name: "Available Farmer" },
      animalIds: [{ _id: "animal-available", earTag: "ILO-305" }],
      technicianId: null,
    }] });
    axiosInstance.put.mockResolvedValue({ data: { message: "claimed" } });

    renderQueue();

    const farmerName = await screen.findAllByText("Available Farmer");
    fireEvent.click(farmerName[0]);
    expect(axiosInstance.put).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: /Claim task/i })[0]);
    await waitFor(() =>
      expect(axiosInstance.put).toHaveBeenCalledWith("/tasks/task-available/claim"),
    );
  });

  it("provides a labelled kebab menu for primary and related-record actions", async () => {
    axiosInstance.get.mockResolvedValue({ data: [{
      _id: "task-actions", taskType: "Health", category: "Routine", priority: 2,
      status: "Pending", dueDate: "2099-08-06T05:00:00.000Z",
      farmerId: { _id: "farmer-actions", name: "Action Farmer" },
      animalIds: [{ _id: "animal-actions", earTag: "ILO-406" }],
      technicianId: "tech-1",
    }] });

    renderQueue();

    const trigger = await screen.findByRole("button", {
      name: "More actions for ILO-406",
    });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    const menu = document.querySelector("#task-actions-task-actions");
    expect(menu).toHaveAttribute("role", "menu");
    expect(menu).toHaveAttribute("aria-label", "Actions for ILO-406");
    expect(within(menu).getByText("Record health assistance")).toBeInTheDocument();
    expect(within(menu).getByText("Open animal")).toBeInTheDocument();
    expect(within(menu).getByText("Open farmer")).toBeInTheDocument();
  });

  it("keeps completed work out of the default queue while preserving the completed filter", async () => {
    axiosInstance.get.mockResolvedValue({ data: [
      {
        _id: "task-active", taskType: "GeneralVisit", status: "Pending",
        farmerId: { name: "Active Farmer" }, animalIds: [], technicianId: "tech-1",
      },
      {
        _id: "task-completed", taskType: "GeneralVisit", status: "Completed",
        completedAt: new Date().toISOString(), farmerId: { name: "Completed Farmer" },
        animalIds: [], technicianId: "tech-1",
      },
    ] });

    renderQueue();

    expect((await screen.findAllByText("Active Farmer")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Completed Farmer")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by task status"), {
      target: { value: "completed" },
    });
    expect((await screen.findAllByText("Completed Farmer")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Active Farmer")).not.toBeInTheDocument();
  });

  it("loads every backend page before calculating queue totals", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      _id: `task-${index}`,
      taskType: "GeneralVisit",
      status: "Pending",
      farmerId: { name: `Farmer ${index}` },
      animalIds: [],
      technicianId: "tech-1",
    }));
    const finalTask = {
      _id: "task-100",
      taskType: "GeneralVisit",
      status: "Pending",
      farmerId: { name: "Farmer 100" },
      animalIds: [],
      technicianId: "tech-1",
    };
    axiosInstance.get.mockImplementation((_url, config) =>
      Promise.resolve({ data: config.params.page === 1 ? firstPage : [finalTask] }),
    );

    renderQueue();

    await waitFor(() => expect(screen.getByRole("button", { name: "All Tasks (101)" })).toBeInTheDocument());
    expect(axiosInstance.get).toHaveBeenNthCalledWith(1, "/tasks", {
      params: { scope: "mine", status: "all", page: 1, limit: 100 },
    });
    expect(axiosInstance.get).toHaveBeenNthCalledWith(2, "/tasks", {
      params: { scope: "mine", status: "all", page: 2, limit: 100 },
    });
  });
});
