import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("../../lib/axios", () => ({
  default: { get: mocks.get },
}));

vi.mock("../../components/layout/Topbar", () => ({
  default: ({ title, subtitle }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  ),
}));

vi.mock("../../components/ui/UserAvatar", () => ({
  default: ({ name }) => <span aria-label={`${name} avatar`} />,
}));

vi.mock("../../components/ui/TableNameLink", async () => {
  const { Link } = await import("react-router-dom");
  return {
    default: ({ to, ariaLabel, children }) => (
      <Link to={to} aria-label={ariaLabel}>
        {children}
      </Link>
    ),
  };
});

vi.mock("../../components/dialogs/RegisterFarmerModal", () => ({
  default: ({ isOpen, farmer }) =>
    isOpen ? (
      <div
        role="dialog"
        aria-label={farmer ? "Edit Farmer" : "Register Farmer"}
        data-farmer-id={farmer?._id || ""}
      />
    ) : null,
}));

import FarmersDirectory from "./FarmersDirectory";

const farmer = {
  _id: "farmer-507f1f77bcf86cd799439011",
  name: "Maria Santos",
  phoneNumber: "09171234567",
  email: "maria@example.test",
  address: {
    barangay: "Poblacion South",
    city: "Oton",
  },
  animalsCount: 3,
  isVerified: false,
  appAccountStatus: "no_app_account",
};

const page = ({ data = [farmer], total = data.length, currentPage = 1 } = {}) => ({
  data: {
    data,
    total,
    page: currentPage,
    limit: 10,
    totalPages: Math.max(1, Math.ceil(total / 10)),
  },
});

const renderDirectory = (initialEntry = "/technician/farmers") => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/technician/farmers" element={<FarmersDirectory />} />
          <Route
            path="/technician/farmers/:id"
            element={<div>Farmer Profile destination</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("Technician Farmers directory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue(page());
  });

  it("renders the canonical directory data without analytics or internal metadata", async () => {
    renderDirectory();

    expect(await screen.findByRole("heading", { name: "Farmers" })).toBeTruthy();
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith("/user", {
        params: {
          role: "farmer",
          page: 1,
          limit: 10,
          search: undefined,
          barangay: undefined,
        },
      }),
    );

    expect(screen.getAllByText("Maria Santos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Poblacion South, Oton").length).toBeGreaterThan(0);
    expect(screen.getAllByText("09171234567").length).toBeGreaterThan(0);
    expect(screen.getByText("3 registered animals")).toBeTruthy();
    expect(screen.queryByText(farmer._id)).toBeNull();
    expect(screen.queryByText("Verified profiles")).toBeNull();
    expect(screen.queryByText("App connected")).toBeNull();
    expect(screen.queryByText("Registered animals")).toBeNull();
    expect(screen.queryByRole("button", { name: /Export/i })).toBeNull();
    expect(screen.queryByLabelText("Filter farmers by municipality")).toBeNull();
    expect(screen.queryByLabelText("Filter farmers by verification")).toBeNull();
    expect(screen.queryByLabelText("Filter farmers by app access")).toBeNull();
  });

  it("sends practical search and Barangay discovery to the backend and resets page one", async () => {
    mocks.get.mockImplementation((_url, config) =>
      Promise.resolve(page({ currentPage: config.params.page })),
    );
    renderDirectory("/technician/farmers?page=2");

    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith("/user", {
        params: expect.objectContaining({ page: 2 }),
      }),
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "Search farmers" }), {
      target: { value: "Maria" },
    });
    fireEvent.change(
      screen.getByRole("combobox", { name: "Filter farmers by barangay" }),
      { target: { value: "Poblacion South" } },
    );

    await waitFor(() =>
      expect(mocks.get).toHaveBeenLastCalledWith("/user", {
        params: {
          role: "farmer",
          page: 1,
          limit: 10,
          search: "Maria",
          barangay: "Poblacion South",
        },
      }),
    );
  });

  it("opens the Farmer Profile and keeps canonical registration and edit entry points", async () => {
    renderDirectory();
    await screen.findAllByText("Maria Santos");

    fireEvent.click(screen.getAllByRole("button", { name: "View Profile" })[0]);
    expect(await screen.findByText("Farmer Profile destination")).toBeTruthy();

    mocks.get.mockClear();
    renderDirectory();
    await screen.findAllByText("Maria Santos");
    fireEvent.click(screen.getByRole("button", { name: "Register Farmer" }));
    expect(screen.getByRole("dialog", { name: "Register Farmer" })).toBeTruthy();

    renderDirectory();
    await screen.findAllByText("Maria Santos");
    fireEvent.click(screen.getByRole("button", { name: "Edit Maria Santos" }));
    expect(screen.getByRole("dialog", { name: "Edit Farmer" })).toHaveAttribute(
      "data-farmer-id",
      farmer._id,
    );
  });

  it("uses authoritative backend totals and pagination", async () => {
    mocks.get.mockImplementation((_url, config) =>
      Promise.resolve(page({ total: 21, currentPage: config.params.page })),
    );
    renderDirectory();

    expect(await screen.findByText("21 farmers")).toBeTruthy();
    expect(screen.getByText("Showing 1–10 of 21")).toBeTruthy();
    expect(screen.getByText("Page 1 of 3")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next farmers page" }));
    await waitFor(() =>
      expect(mocks.get).toHaveBeenLastCalledWith("/user", {
        params: expect.objectContaining({ page: 2 }),
      }),
    );
    expect(await screen.findByText("Page 2 of 3")).toBeTruthy();
    expect(screen.getByText("Showing 11–20 of 21")).toBeTruthy();
  });

  it("shows truthful loading, empty, and error states", async () => {
    mocks.get.mockImplementation(() => new Promise(() => {}));
    const loadingView = renderDirectory();
    expect(screen.getByLabelText("Loading farmer directory")).toBeTruthy();
    loadingView.unmount();

    mocks.get.mockResolvedValueOnce(page({ data: [], total: 0 }));
    const emptyView = renderDirectory();
    expect(await screen.findByText("No farmers found")).toBeTruthy();
    emptyView.unmount();

    mocks.get.mockRejectedValueOnce(new Error("Network unavailable"));
    renderDirectory();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Network unavailable",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("does not fabricate a zero animal count when the field is missing", async () => {
    mocks.get.mockResolvedValueOnce(
      page({ data: [{ ...farmer, animalsCount: null }] }),
    );
    renderDirectory();

    expect((await screen.findAllByText("Not available")).length).toBeGreaterThan(0);
    expect(screen.queryByText("0 registered animals")).toBeNull();
  });
});
