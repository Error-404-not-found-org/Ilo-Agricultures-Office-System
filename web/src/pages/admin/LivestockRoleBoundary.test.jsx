import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "../../lib/axios";
import LivestockProfile from "./LivestockProfile";

vi.mock("../../lib/axios", () => ({
  default: { get: vi.fn() },
}));

const animal = {
  _id: "animal-1",
  earTag: "OTN-401",
  species: "Cattle",
  breed: "Holstein",
  reproductiveStatus: "Open",
  farmerId: {
    name: "Maria Farmer",
    phoneNumber: "09123456789",
    address: { barangay: "Poblacion East", city: "Oton" },
  },
  inseminations: [],
  calvings: [],
};

function renderProfile(role, path) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path={role === "admin" ? "/admin/livestock/:id" : "/technician/animals/:id"}
            element={<LivestockProfile role={role} />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LivestockProfile role boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosInstance.get.mockImplementation(async (url) => {
      if (url.startsWith("/animals/")) return { data: animal };
      if (url.startsWith("/medical/")) return { data: [] };
      return { data: {} };
    });
  });

  it("keeps Admin livestock oversight free of clinical record actions", async () => {
    renderProfile("admin", "/admin/livestock/animal-1");

    await waitFor(() =>
      expect(screen.getByText("Animal #OTN-401")).toBeInTheDocument(),
    );
    expect(screen.getAllByText("Maria Farmer")).not.toHaveLength(0);
    expect(screen.getAllByText("Poblacion East, Oton")).not.toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: "Add Record" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Pregnancy Diagnosis/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Calving Record/ }),
    ).not.toBeInTheDocument();
  });

  it("preserves legitimate Technician livestock record actions", async () => {
    renderProfile("technician", "/technician/animals/animal-1");

    await waitFor(() =>
      expect(screen.getByText("Animal #OTN-401")).toBeInTheDocument(),
    );
    const addRecord = screen.getByRole("button", { name: "Add Record" });
    fireEvent.click(addRecord);

    expect(
      screen.getByRole("button", { name: "Artificial Insemination (AI)" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Health / Medical Log" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Pregnancy Diagnosis (PD)" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Calving Record" }),
    ).toBeVisible();
  });
});
