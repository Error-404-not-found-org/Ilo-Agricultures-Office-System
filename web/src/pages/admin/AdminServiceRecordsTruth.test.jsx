import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "../../lib/axios";
import Inseminations from "./Inseminations";
import AdminPregnancyOversight from "./AdminPregnancyOversight";
import AdminCalvings from "./AdminCalvings";

vi.mock("../../lib/axios", () => ({ default: { get: vi.fn() } }));
vi.mock("../../components/layout/Topbar", () => ({ default: ({ title }) => <h1>{title}</h1> }));

function renderPage(page) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter>{page}</MemoryRouter></QueryClientProvider>);
}

describe("Admin official-record presentation truth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not invent an AI service date, outcome, or attempt from request fields", async () => {
    axiosInstance.get.mockResolvedValue({ data: { inseminations: [{
      _id: "ai-123456", scheduledDate: "2026-10-01T00:00:00Z", createdAt: "2026-09-01T00:00:00Z",
      animalId: { earTag: "BEEF-1" }, farmerId: { name: "Farmer One" },
      technicianId: { name: "Tech One" },
    }], total: 1, summary: { pregnant: 0, pending: 0, failed: 0 } } });
    renderPage(<Inseminations />);
    await screen.findByText("BEEF-1");
    const table = screen.getByRole("table", { name: "Municipal insemination records" });
    expect(table).toHaveTextContent("Not recorded");
    expect(table).not.toHaveTextContent("Oct 1, 2026");
    expect(table).not.toHaveTextContent("Pending");
    expect(screen.getByText("AI Records")).toBeInTheDocument();
    expect(screen.getByText("Pregnant Outcomes")).toBeInTheDocument();
    expect(screen.getByText("Pending Outcomes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /View insemination record/ }));
    expect(screen.getByText("Tech One")).toBeInTheDocument();
    expect(screen.queryByText("Attempt #Not recorded")).not.toBeInTheDocument();
  });

  it("offers only canonical AI outcome filter values", async () => {
    axiosInstance.get.mockResolvedValue({ data: { inseminations: [], total: 0, summary: { pregnant: 0, pending: 0, failed: 0 } } });
    renderPage(<Inseminations />);
    const filter = await screen.findByRole("combobox", { name: "Filter inseminations by cycle outcome" });
    expect(within(filter).queryByRole("option", { name: "Failed Cycles" })).not.toBeInTheDocument();
    expect(within(filter).getByRole("option", { name: "Failed (Negative PD)" })).toHaveValue("Failed (Negative PD)");
  });

  it("opens the Admin AI record in the shared read-only dialog and closes it", async () => {
    axiosInstance.get.mockResolvedValue({ data: { inseminations: [{
      _id: "ai-123456", inseminationDate: "2026-10-05T00:00:00Z", outcome: "Pregnant",
      animalId: { earTag: "BEEF-4" }, farmerId: { name: "Farmer Four" },
      sireBreed: "Brahman", sireCode: "S-12", estrus: "Natural", attemptNumber: 2,
      technicianId: { name: "Tech Four" }, technicianNote: "Visit complete", comment: "Eating well",
    }], total: 1, summary: { pregnant: 1, pending: 0, failed: 0 } } });
    renderPage(<Inseminations />);
    await screen.findByText("BEEF-4");
    fireEvent.click(screen.getByRole("button", { name: /View insemination record/ }));
    const dialog = screen.getByRole("dialog", { name: "Insemination Record" });
    expect(dialog).toHaveTextContent("Read-only official service record");
    expect(dialog).toHaveTextContent("Animal Details");
    expect(dialog).toHaveTextContent("Farmer");
    expect(dialog).toHaveTextContent("Oct 5, 2026");
    expect(dialog).toHaveTextContent("Pregnant");
    expect(dialog).toHaveTextContent("Brahman");
    expect(dialog).toHaveTextContent("S-12");
    expect(dialog).toHaveTextContent("Natural");
    expect(dialog).toHaveTextContent("Attempt #2");
    expect(dialog).toHaveTextContent("Tech Four");
    expect(dialog).toHaveTextContent("Visit complete");
    expect(dialog).toHaveTextContent("Eating well");
    expect(axiosInstance.get).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Close", exact: true }));
    expect(screen.queryByRole("dialog", { name: "Insemination Record" })).not.toBeInTheDocument();
  });

  it("closes the Admin AI dialog on Escape and backdrop without fetching details", async () => {
    axiosInstance.get.mockResolvedValue({ data: { inseminations: [{
      _id: "ai-123456", animalId: { earTag: "BEEF-5" }, farmerId: { name: "Farmer Five" },
    }], total: 1, summary: { pregnant: 0, pending: 0, failed: 0 } } });
    renderPage(<Inseminations />);
    await screen.findByText("BEEF-5");
    const openRecord = () => fireEvent.click(screen.getByRole("button", { name: /View insemination record/ }));
    openRecord();
    fireEvent(screen.getByRole("dialog", { name: "Insemination Record" }), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog", { name: "Insemination Record" })).not.toBeInTheDocument();
    openRecord();
    const dialog = screen.getByRole("dialog", { name: "Insemination Record" });
    fireEvent.submit(within(dialog).getByRole("button", { name: "Close dialog" }).closest("form"));
    expect(screen.queryByRole("dialog", { name: "Insemination Record" })).not.toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenCalledTimes(1);
  });

  it("uses only canonical pregnancy diagnosis fields and labels expected calving", async () => {
    axiosInstance.get.mockResolvedValue({ data: { data: [{ _id: "p1", animalId: { earTag: "CAR-1" },
      diagnosisDate: "2026-10-01T00:00:00Z", createdAt: "2026-09-01T00:00:00Z", result: "Pregnant",
      targetCalvingDate: "2027-01-01T00:00:00Z", cycleStatus: "active" }] } });
    renderPage(<AdminPregnancyOversight />);
    await screen.findByText("CAR-1");
    const table = screen.getByRole("table", { name: "Municipal pregnancy check oversight" });
    expect(table).toHaveTextContent("Not recorded");
    expect(table).not.toHaveTextContent("Pregnant");
    expect(table).not.toHaveTextContent("Oct 1, 2026");
    expect(within(table).getByText("Expected calving date")).toBeInTheDocument();
  });

  it("uses official calving date and count fields, preserving zero", async () => {
    axiosInstance.get.mockResolvedValue({ data: { data: [
      { _id: "c1", animalId: { earTag: "BEEF-2" }, calvingDate: "2026-10-01T00:00:00Z", calves: ["a", "b"] },
      { _id: "c2", animalId: { earTag: "BEEF-3" }, numberOfCalves: 0, calves: ["a"] },
    ] } });
    renderPage(<AdminCalvings />);
    await screen.findByText("BEEF-2");
    const table = screen.getByRole("table", { name: "Municipal calving and newborn oversight" });
    const rows = within(table).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Not recorded");
    expect(rows[1]).not.toHaveTextContent("Oct 1, 2026");
    expect(rows[2]).toHaveTextContent("0");
    expect(rows[1]).not.toHaveClass("cursor-pointer");
  });
});
