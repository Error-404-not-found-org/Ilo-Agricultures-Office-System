import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "../../lib/axios";
import LivestockProfile from "./LivestockProfile";

vi.mock("../../lib/axios", () => ({
  default: { get: vi.fn() },
}));

vi.mock("../../components/technician/OfficialRecordDetailModal", () => ({
  default: ({ recordIdentity }) =>
    recordIdentity ? (
      <output data-testid="official-record-identity">
        {`${recordIdentity.animalId}:${recordIdentity.recordKind}:${recordIdentity.recordId}`}
      </output>
    ) : null,
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
            path={
              role === "admin"
                ? "/admin/livestock/:id"
                : "/technician/animals/:id"
            }
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
    expect(
      screen.queryByRole("button", { name: "Health Record" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Pregnancy Check" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Record AI Service/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps the focused Technician clinical workflows available", async () => {
    renderProfile("technician", "/technician/animals/animal-1");

    await waitFor(() =>
      expect(screen.getByText("Animal #OTN-401")).toBeInTheDocument(),
    );

    expect(screen.getByRole("button", { name: "Edit Profile" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Health Record" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Pregnancy Check" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Calving" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Record AI Service/ }),
    ).toBeVisible();
  });

  it("shows the reproductive tracker without exposing an Admin mutation", async () => {
    renderProfile("admin", "/admin/livestock/animal-1");

    await waitFor(() =>
      expect(screen.getByText("Animal #OTN-401")).toBeInTheDocument(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Reproductive Timeline" }),
    );

    expect(
      screen.getByText("No active reproductive timeline"),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Pregnancy Check" }),
    ).not.toBeInTheDocument();
  });

  it("opens every completed record type in the shared read-only detail modal", async () => {
    const finishedAnimal = {
      ...animal,
      inseminations: [
        {
          _id: "ai-finished",
          status: "done",
          attemptNumber: 1,
          inseminationDate: "2026-08-01T00:00:00.000Z",
          pregnancy: {
            _id: "pregnancy-finished",
            pregnancyDiagnosis: {
              date: "2026-08-03T00:00:00.000Z",
              result: "Pregnant",
            },
          },
        },
      ],
      calvings: [
        {
          _id: "calving-finished",
          date: "2026-08-04T00:00:00.000Z",
          numberOfCalves: 1,
        },
      ],
    };
    axiosInstance.get.mockImplementation(async (url) => {
      if (url.startsWith("/animals/")) return { data: finishedAnimal };
      if (url.startsWith("/medical/")) {
        return {
          data: [
            {
              _id: "health-finished",
              date: "2026-08-02T00:00:00.000Z",
              type: "Treatment",
              technicianId: { name: "Technician Two" },
            },
          ],
        };
      }
      return { data: {} };
    });

    renderProfile("technician", "/technician/animals/animal-1");
    await waitFor(() =>
      expect(screen.getByText("Animal #OTN-401")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Records" }));

    const viewButtons = await screen.findAllByRole("button", {
      name: "View details",
    });
    expect(viewButtons).toHaveLength(4);

    fireEvent.click(viewButtons[0]);
    expect(screen.getByTestId("official-record-identity")).toHaveTextContent(
      "animal-1:calving:calving-finished",
    );
    fireEvent.click(viewButtons[1]);
    expect(screen.getByTestId("official-record-identity")).toHaveTextContent(
      "animal-1:pregnancy:pregnancy-finished",
    );
    fireEvent.click(viewButtons[2]);
    expect(screen.getByTestId("official-record-identity")).toHaveTextContent(
      "animal-1:medical_record:health-finished",
    );
    fireEvent.click(viewButtons[3]);
    expect(screen.getByTestId("official-record-identity")).toHaveTextContent(
      "animal-1:insemination:ai-finished",
    );
  });
});
