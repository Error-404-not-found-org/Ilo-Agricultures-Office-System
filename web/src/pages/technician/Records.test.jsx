import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
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

import TechnicianRecords from "./Records";

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
};

const ids = {
  animal: "507f1f77bcf86cd799439011",
  ai: "507f1f77bcf86cd799439012",
  health: "507f1f77bcf86cd799439013",
  pregnancy: "507f1f77bcf86cd799439014",
  calving: "507f1f77bcf86cd799439015",
};

const records = [
  {
    id: ids.ai,
    recordKind: "insemination",
    category: "AI",
    recordDate: "2024-08-25T03:30:00.000Z",
    title: "Insemination record",
    summary: "Artificial insemination completed",
    animalId: { _id: ids.animal, earTag: "02DP", species: "Cattle", breed: "Native" },
    farmerId: { name: "Dong Pongase" },
    technicianId: { name: "Technician One" },
    source: {
      inseminationDate: "2024-08-25T03:30:00.000Z",
      attemptNumber: 1,
      sireBreed: "Brahman",
      sireCode: "44-12",
      outcome: "Pregnant",
    }
  },
  {
    id: ids.health,
    recordKind: "medical_record",
    category: "Health",
    recordDate: "2024-08-25T05:30:00.000Z",
    title: "Health record",
    summary: "Treatment completed",
    animalId: { _id: ids.animal, earTag: "02DP" },
    farmerId: { name: "Dong Pongase" },
    technicianId: { name: "Technician One" },
    source: {
      type: "Farm Visit",
      date: "2025-02-12T03:30:00.000Z",
      details: { treatment: "Deworming" }
    }
  },
  {
    id: ids.pregnancy,
    recordKind: "pregnancy",
    category: "Pregnancy",
    recordDate: "2025-04-01T00:00:00.000Z",
    title: "Pregnancy Diagnosis",
    summary: "Pregnant",
    animalId: { _id: ids.animal, earTag: "02DP" },
    farmerId: { name: "Dong Pongase" },
    technicianId: { name: "Technician One" },
    source: {
      pregnancyDiagnosis: {
        date: "2025-04-01T00:00:00.000Z",
        result: "Pregnant",
        checkMethod: "palpation"
      }
    }
  },
  {
    id: ids.calving,
    recordKind: "calving",
    category: "Calving",
    recordDate: "2026-01-14T00:00:00.000Z",
    title: "Calving Record",
    summary: "One offspring recorded",
    animalId: { _id: ids.animal, earTag: "02DP" },
    farmerId: { name: "Dong Pongase" },
    technicianId: { name: "Technician One" },
    source: {
      date: "2026-01-14T00:00:00.000Z",
      numberOfCalves: 1,
      calvingEase: "Normal",
      calves: [{ earTag: "CALF-01", sex: "Female" }]
    }
  },
];

const detailById = {
  [ids.ai]: {
    sourceId: ids.ai,
    type: "ai",
    title: "Insemination record",
    date: "2024-08-25T03:30:00.000Z",
    datePrecision: "datetime",
    animalId: records[0].animalId,
    farmerId: records[0].farmerId,
    technician: { name: "Technician One" },
    details: {
      serviceDate: "2024-08-25T03:30:00.000Z",
      attemptNumber: 1,
      sireBreed: "Brahman",
      sireCode: "44-12",
      estrus: "Natural",
      semenDosesUsed: 1,
      outcome: "Pregnant",
      status: "done",
    },
  },
  [ids.health]: {
    sourceId: ids.health,
    type: "health",
    title: "Health record",
    date: "2024-08-25T05:30:00.000Z",
    animalId: records[1].animalId,
    farmerId: records[1].farmerId,
    technician: { name: "Technician One" },
    details: {
      serviceDate: "2025-02-12T03:30:00.000Z",
      requestType: "Farm Visit",
      treatment: "Deworming",
      diagnosis: "Parasites",
    },
  },
  [ids.pregnancy]: {
    sourceId: ids.pregnancy,
    type: "pregnancy",
    title: "Pregnancy Diagnosis",
    date: "2025-04-01T00:00:00.000Z",
    animalId: records[2].animalId,
    farmerId: records[2].farmerId,
    technician: { name: "Technician One" },
    details: {
      serviceDate: "2025-04-01T00:00:00.000Z",
      outcome: "Pregnant",
      diagnosticMethod: "palpation",
      relatedAttempt: 1,
    },
  },
  [ids.calving]: {
    sourceId: ids.calving,
    type: "calving",
    title: "Calving Record",
    date: "2026-01-14T00:00:00.000Z",
    animalId: records[3].animalId,
    farmerId: records[3].farmerId,
    technician: { name: "Technician One" },
    details: {
      serviceDate: "2026-01-14T00:00:00.000Z",
      calvingOutcome: "live_birth",
      calvingEase: "Normal",
      numberOfCalves: 1,
      calves: [{ earTag: "CALF-01", sex: "Female" }],
    },
  },
};

const renderRecords = (initialEntry = "/technician/records") => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <TechnicianRecords />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("Technician official records", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockImplementation((url) => {
      if (url === "/animals/records") {
        return Promise.resolve({
          data: { data: records, page: 1, limit: 10, total: 4, totalPages: 1 },
        });
      }
      const recordId = String(url).split("/").at(-1);
      return Promise.resolve({ data: { data: detailById[recordId] } });
    });
  });

  it("loads ALL filter columns correctly", async () => {
    renderRecords();

    await screen.findByRole("table", { name: "Technician official records" });

    // Verify ALL filter headers
    expect(screen.getByRole("columnheader", { name: "Type" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Animal" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Farmer" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Date" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Result / Status" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Technician" })).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
  });

  it("loads AI filter columns correctly", async () => {
    renderRecords("/technician/records?type=insemination");

    await screen.findByRole("table", { name: "Technician official records" });

    // Verify AI filter headers
    expect(screen.getByRole("columnheader", { name: "Animal" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Farmer" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "AI Date" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Sire" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Attempt" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Technician" })).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();

    // Verify cell content
    expect(await screen.findByText("Brahman")).toBeInTheDocument();
    expect(await screen.findByText("Attempt #1")).toBeInTheDocument();
  });

  it("loads HEALTH filter columns correctly", async () => {
    renderRecords("/technician/records?type=health");

    await screen.findByRole("table", { name: "Technician official records" });

    // Verify Health filter headers
    expect(screen.getByRole("columnheader", { name: "Animal" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Farmer" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Service Type" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Service Date" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Treatment / Result" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Technician" })).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();

    // Verify cell content
    expect(await screen.findByText("Farm Visit")).toBeInTheDocument();
    expect(await screen.findByText("Deworming")).toBeInTheDocument();
  });

  it("loads PREGNANCY filter columns correctly", async () => {
    renderRecords("/technician/records?type=pregnancy");

    await screen.findByRole("table", { name: "Technician official records" });

    // Verify Pregnancy filter headers
    expect(screen.getByRole("columnheader", { name: "Animal" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Farmer" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Diagnosis Date" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Result" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Method" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Technician" })).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();

    // Verify cell content
    expect(await screen.findByText("palpation")).toBeInTheDocument();
  });

  it("loads CALVING filter columns correctly", async () => {
    renderRecords("/technician/records?type=calving");

    await screen.findByRole("table", { name: "Technician official records" });

    // Verify Calving filter headers
    expect(screen.getByRole("columnheader", { name: "Dam / Animal" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Farmer" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Calving Date" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Outcome / Calf Info" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Technician" })).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();

    // Verify cell content
    expect(await screen.findByText("1 calf/calves")).toBeInTheDocument();
  });

  it.each([
    [ids.ai, "insemination", "Sire", "44-12"],
    [ids.health, "medical_record", "Treatment or service", "Deworming"],
    [ids.pregnancy, "pregnancy", "Diagnosis result", "Pregnant"],
    [ids.calving, "calving", "Calving ease", "CALF-01"],
  ])("opens %s through its canonical %s detail endpoint", async (recordId, recordKind, fieldLabel, fieldValue) => {
    renderRecords();

    await screen.findByRole("table", { name: "Technician official records" });
    const allCards = await screen.findAllByRole("button", { name: "View record" });
    const index = records.findIndex((item) => item.id === recordId);
    fireEvent.click(allCards[index]);

    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith(
        "/animals/" + ids.animal + "/records/" + recordKind + "/" + recordId,
      ),
    );
    expect(await screen.findByText(fieldLabel)).toBeInTheDocument();
    expect(screen.getAllByText((_, element) =>
      element?.textContent?.includes(fieldValue),
    )).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: /record service|complete task|start service/i })).toBeNull();
  });

  it("uses query parameters to open the same canonical detail from a direct record link", async () => {
    renderRecords(
      "/technician/records?animalId=" +
        ids.animal +
        "&recordKind=insemination&recordId=" +
        ids.ai,
    );

    expect(await screen.findByText("Sire")).toBeInTheDocument();
    expect(screen.getAllByText((_, element) =>
      element?.textContent?.includes("44-12"),
    )).not.toHaveLength(0);
    expect(mocks.get).toHaveBeenCalledWith(
      "/animals/" + ids.animal + "/records/insemination/" + ids.ai,
    );
  });

  it("clears record URL state when dismissed through the backdrop and can open another record", async () => {
    renderRecords();

    const viewButtons = await screen.findAllByRole("button", { name: "View record" });
    fireEvent.click(viewButtons[0]);

    expect(await screen.findByText("Sire")).toBeInTheDocument();
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "animalId=" + ids.animal,
    );
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "recordKind=insemination",
    );
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "recordId=" + ids.ai,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));

    await waitFor(() => {
      const search = screen.getByTestId("location-search").textContent || "";
      expect(search).not.toContain("animalId=");
      expect(search).not.toContain("recordKind=");
      expect(search).not.toContain("recordId=");
    });

    fireEvent.click(viewButtons[1]);

    expect(await screen.findByText("Treatment or service")).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledWith(
        "/animals/" + ids.animal + "/records/medical_record/" + ids.health,
      );
    });
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "recordId=" + ids.health,
    );
  });
});
