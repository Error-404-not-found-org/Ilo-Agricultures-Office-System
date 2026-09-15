import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), delete: vi.fn(), navigate: vi.fn() }));

vi.mock("../../lib/axios", () => ({ default: { get: mocks.get, delete: mocks.delete } }));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mocks.navigate };
});
vi.mock("../../components/layout/Topbar", () => ({
  default: ({ title, subtitle }) => <header><h1>{title}</h1><p>{subtitle}</p></header>,
}));
vi.mock("../../components/dialogs/RegisterLivestockModal", () => ({
  default: ({ isOpen, livestock, onClose }) => isOpen ? (
    <div data-testid="register-livestock-modal">
      <span>Editing: {livestock?._id || livestock?.id}</span>
      <button onClick={onClose}>Close</button>
    </div>
  ) : null,
}));

import Animals from "./Animals";

const mockAnimal = {
  _id: "animal-01", earTag: "100DP", species: "Cattle", breed: "Brahman",
  gender: "Female", reproductiveStatus: "Pregnant",
  lastInseminationDate: "2026-08-01T00:00:00.000Z",
  farmerId: {
    _id: "farmer-01", name: "Mario Cabanig",
    address: { barangay: "Bita Sur", municipality: "Oton" },
  },
};

const mockResponse = {
  animals: [mockAnimal], total: 42, pages: 5,
  summary: { total: 42, cattle: 30, pregnant: 7, available: 15 },
  metrics: {
    animalsFound: 42, inseminated: 12, pregnant: 7,
    expectedCalvingThisMonth: 3,
  },
};

describe("Technician Animals Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({ data: mockResponse });
  });

  const renderPage = (initialEntry = "/technician/animals") => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes><Route path="/technician/animals" element={<Animals />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it("preserves the approved table, Barangay, long ear tag, status, and Last AI", async () => {
    renderPage();
    expect(await screen.findAllByText("#100DP")).not.toHaveLength(0);
    const headers = screen.getAllByRole("columnheader").map((header) => header.textContent.trim());
    expect(headers).toEqual(["Animal", "Breed / Species", "Barangay", "Status", "Last AI", "Actions"]);
    expect(screen.queryByRole("columnheader", { name: "Location" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Livestock" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Bita Sur").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Brahman").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cattle").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pregnant").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Aug 1, 2026").length).toBeGreaterThan(0);
  });

  it("shows only Cattle and Carabao in the Technician species filter", async () => {
    renderPage();
    await screen.findAllByText("#100DP");
    const filter = screen.getByRole("combobox", { name: "Filter animals by species" });
    expect(within(filter).getByRole("option", { name: "Cattle" })).toBeInTheDocument();
    expect(within(filter).getByRole("option", { name: "Carabao" })).toBeInTheDocument();
    expect(within(filter).queryByRole("option", { name: "Goat" })).not.toBeInTheDocument();
    expect(within(filter).queryByRole("option", { name: "Swine" })).not.toBeInTheDocument();
  });

  it("renders aggregate metrics from response.metrics rather than the one-row page", async () => {
    renderPage();
    await screen.findAllByText("#100DP");
    const overview = screen.getByRole("region", { name: "Animal directory overview" });
    for (const text of ["Animals found", "42", "Inseminated", "12", "Pregnant", "7", "Expected Calving This Month", "3"]) {
      expect(within(overview).getByText(text)).toBeInTheDocument();
    }
  });

  it("sends every active filter with the paginated directory request", async () => {
    renderPage("/technician/animals?search=100DP&species=Cattle&repro=Pregnant&breed=Brahman&municipality=Oton&barangay=Bita+Sur&gender=Female&page=2");
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("/animals/all", {
      params: expect.objectContaining({
        page: 2, limit: 10, search: "100DP", species: "Cattle",
        reproductiveStatus: "Pregnant", breed: "Brahman", city: "Oton",
        barangay: "Bita Sur", gender: "Female",
      }),
    }));
  });

  it("uses a kebab menu for active workflows and has no permanent row buttons", async () => {
    renderPage();
    await screen.findAllByText("#100DP");
    const triggers = screen.getAllByRole("button", { name: "Actions for animal 100DP" });
    expect(triggers.length).toBeGreaterThan(0);
    expect(triggers[0]).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.queryByRole("button", { name: "View profile" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit animal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete Animal", hidden: true })).not.toBeInTheDocument();
    expect(screen.getAllByRole("menuitem", { name: "Archive Animal", hidden: true }).length).toBeGreaterThan(0);
  });

  it("navigates to the Animal and owner profiles from menu actions", async () => {
    renderPage();
    await screen.findAllByText("#100DP");
    fireEvent.click(screen.getAllByRole("menuitem", { name: "View Animal Profile", hidden: true })[0]);
    expect(mocks.navigate).toHaveBeenCalledWith("/technician/animals/animal-01");
    fireEvent.click(screen.getAllByRole("menuitem", { name: "View Owner", hidden: true })[0]);
    expect(mocks.navigate).toHaveBeenCalledWith("/technician/farmers/farmer-01");
  });

  it("opens editing and accurately confirms the established archive workflow", async () => {
    mocks.delete.mockResolvedValue({ data: { message: "Animal archived" } });
    renderPage();
    await screen.findAllByText("#100DP");
    fireEvent.click(screen.getAllByRole("menuitem", { name: "Edit Details", hidden: true })[0]);
    expect(screen.getByText("Editing: animal-01")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("menuitem", { name: "Archive Animal", hidden: true })[0]);
    expect(screen.getByText(/Archive animal #100DP\?/i)).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Archive Animal" })));
    await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith("/animals/animal-01"));
  });

  it("keeps a clear filtered empty state", async () => {
    mocks.get.mockResolvedValue({
      data: {
        animals: [], total: 0, pages: 0,
        metrics: { animalsFound: 0, inseminated: 0, pregnant: 0, expectedCalvingThisMonth: 0 },
      },
    });
    renderPage("/technician/animals?search=missing");
    expect(await screen.findByRole("heading", { name: "No animals found" })).toBeInTheDocument();
    expect(screen.getByText("Try changing or clearing the filters.")).toBeInTheDocument();
  });
});

