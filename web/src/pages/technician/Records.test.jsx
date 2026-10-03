import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
import { resolveRecordsDateFilter } from "../../utils/recordsDateFilter";

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
        result: "Pregnant"
      },
      confirmation: { methodCode: "clinical_examination" }
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
      diagnosticMethod: "clinical_examination",
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

describe("Technician records", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockImplementation((url) => {
      if (url === "/animals/records") {
        return Promise.resolve({
          data: {
            data: records,
            page: 1,
            limit: 10,
            total: 4,
            totalPages: 1,
            summary: {
              all: 4,
              insemination: 1,
              health: 1,
              pregnancy: 1,
              calving: 1,
            },
          },
        });
      }
      const recordId = String(url).split("/").at(-1);
      return Promise.resolve({ data: { data: detailById[recordId] } });
    });
  });

  it("loads ALL filter columns correctly", async () => {
    renderRecords();

    await screen.findByRole("table", { name: "Technician finished activity" });

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

    await screen.findByRole("table", { name: "Technician finished activity" });

    // Verify AI filter headers
    expect(screen.getByRole("columnheader", { name: "Animal" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Farmer" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Activity Date" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Sire / Details" })).toBeInTheDocument();
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

    await screen.findByRole("table", { name: "Technician finished activity" });

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

    await screen.findByRole("table", { name: "Technician finished activity" });

    // Verify Pregnancy filter headers
    expect(screen.getByRole("columnheader", { name: "Animal" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Farmer" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Diagnosis Date" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Result" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Method" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Technician" })).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();

    // Verify cell content
    expect(await screen.findByText("Visual Assessment")).toBeInTheDocument();
  });

  it("loads CALVING filter columns correctly", async () => {
    renderRecords("/technician/records?type=calving");

    await screen.findByRole("table", { name: "Technician finished activity" });

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
    [ids.ai, "insemination", "Sire code", "44-12"],
    [ids.health, "medical_record", "Treatment or service", "Deworming"],
    [ids.pregnancy, "pregnancy", "Diagnosis result", "Pregnant"],
    [ids.calving, "calving", "Calving ease", "CALF-01"],
  ])("opens %s through its canonical %s detail endpoint", async (recordId, recordKind, fieldLabel, fieldValue) => {
    renderRecords();

    await screen.findByRole("table", { name: "Technician finished activity" });
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

    expect(await screen.findByText("Sire code")).toBeInTheDocument();
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

    expect(await screen.findByText("Sire code")).toBeInTheDocument();
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

  it("renders semantically labeled health results, humanized enums, and suppresses raw dosage in the table", async () => {
    mocks.get.mockImplementation((url) => {
      if (url === "/animals/records") {
        return Promise.resolve({
          data: {
            data: [
              {
                id: "rec-haha",
                recordKind: "medical_record",
                category: "Health",
                recordDate: "2026-09-05T07:06:00.000Z",
                title: "Health record",
                summary: "Haha",
                status: "completed",
                animalId: { earTag: "01RD" },
                farmerId: { name: "Renelyn Dumalfin" },
                source: {
                  details: {
                    diagnosis: "Haha",
                    treatment: "Haah",
                    dosage: "1",
                  },
                },
              },
              {
                id: "rec-dosage-only",
                recordKind: "medical_record",
                category: "Health",
                recordDate: "2026-09-06T07:06:00.000Z",
                title: "Health record",
                summary: "1",
                status: "completed",
                animalId: { earTag: "02RD" },
                farmerId: { name: "Renelyn Dumalfin" },
                source: {
                  details: {
                    dosage: "1",
                  },
                },
              },
              {
                id: "rec-preg-enum",
                recordKind: "pregnancy",
                category: "Pregnancy",
                recordDate: "2026-09-06T08:00:00.000Z",
                title: "Pregnancy Diagnosis",
                summary: "needs_recheck",
                status: "completed",
                animalId: { earTag: "03DP" },
                farmerId: { name: "John Cabanig" },
                source: {
                  pregnancyDiagnosis: {
                    result: "needs_recheck",
                  },
                },
              },
            ],
            page: 1,
            limit: 10,
            total: 3,
            totalPages: 1,
          },
        });
      }
      return Promise.resolve({ data: { data: {} } });
    });

    renderRecords();

    await screen.findByRole("table", { name: "Technician finished activity" });

    // 01RD: Haha should have Diagnosis label, not raw unlabeled Haha
    expect(await screen.findByText(/Diagnosis:/i)).toBeInTheDocument();
    expect(await screen.findByText("Haha")).toBeInTheDocument();

    // 03DP: raw enum "needs_recheck" must NOT appear, humanized "Recheck required" should appear
    expect(await screen.findByText("Recheck required")).toBeInTheDocument();
    expect(screen.queryByText("needs_recheck")).toBeNull();

    // 02RD: dosage "1" must NOT appear as an unlabelled standalone result
    expect(screen.queryByText("1")).toBeNull();
  });

  it("renders one clear view action per record row", async () => {
    renderRecords();

    const primaryViewButtons = await screen.findAllByRole("button", { name: "View record" });
    expect(primaryViewButtons).toHaveLength(records.length);
    expect(screen.queryAllByRole("button", { name: /More actions for/i })).toHaveLength(0);

    fireEvent.click(primaryViewButtons[0]);
    expect(await screen.findByText("Sire code")).toBeInTheDocument();
  });

  it("defaults to All time without sending date restrictions", async () => {
    renderRecords();

    await screen.findByRole("table", { name: "Technician finished activity" });
    expect(screen.getByLabelText("Date")).toHaveValue("all");
    expect(screen.queryByLabelText("Month")).toBeNull();
    expect(screen.queryByLabelText("From")).toBeNull();
    expect(screen.queryByLabelText("To")).toBeNull();
    expect(screen.queryByText("Date mode")).toBeNull();
    expect(mocks.get).toHaveBeenCalledWith("/animals/records", {
      params: { page: 1, limit: 10 },
    });
  });

  it.each([
    ["this-month", { fromDate: "2026-09-01", toDate: "2026-09-30" }],
    ["last-month", { fromDate: "2026-08-01", toDate: "2026-08-31" }],
    ["last-30-days", { fromDate: "2026-08-23", toDate: "2026-09-21" }],
  ])("resolves %s with Manila calendar boundaries", (datePreset, expected) => {
    const params = new URLSearchParams(`datePreset=${datePreset}`);
    expect(
      resolveRecordsDateFilter(params, new Date("2026-09-21T04:00:00.000Z")),
    ).toMatchObject({ preset: datePreset, ...expected });
  });

  it("persists presets in the URL and resets pagination", async () => {
    renderRecords("/technician/records?page=4&type=health");
    await screen.findByRole("table", { name: "Technician finished activity" });

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "last-month" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "datePreset=last-month",
      );
      expect(screen.getByTestId("location-search")).toHaveTextContent("page=1");
    });
  });

  it("combines a preset with service type and search in the records request", async () => {
    const { fromDate, toDate } = resolveRecordsDateFilter(
      new URLSearchParams("datePreset=last-month"),
    );
    renderRecords(
      "/technician/records?datePreset=last-month&type=health&search=OT-009&page=2",
    );

    await screen.findByRole("table", { name: "Technician finished activity" });
    expect(mocks.get).toHaveBeenCalledWith("/animals/records", {
      params: {
        page: 2,
        limit: 10,
        type: "health",
        search: "OT-009",
        fromDate,
        toDate,
      },
    });
  });

  it("uses the active preset response for full-dataset metrics", async () => {
    mocks.get.mockImplementation((url, options) => {
      if (url === "/animals/records") {
        const filtered = Boolean(options?.params?.fromDate);
        return Promise.resolve({
          data: {
            data: filtered ? records.slice(0, 1) : records,
            page: 1,
            limit: 10,
            total: filtered ? 1 : 4,
            totalPages: 1,
            summary: filtered
              ? { all: 1, insemination: 1, health: 0, pregnancy: 0, calving: 0 }
              : { all: 4, insemination: 1, health: 1, pregnancy: 1, calving: 1 },
          },
        });
      }
      return Promise.resolve({ data: { data: {} } });
    });

    renderRecords("/technician/records?datePreset=this-month");

    const metrics = await screen.findByRole("region", {
      name: "Official record metrics",
    });
    await waitFor(() =>
      expect(within(metrics).getByText("All Records").closest(".card")).toHaveTextContent("1"),
    );
  });

  it("shows only the month picker for Select month", async () => {
    renderRecords();
    await screen.findByRole("table", { name: "Technician finished activity" });

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "select-month" },
    });

    expect(await screen.findByLabelText("Month")).toBeInTheDocument();
    expect(screen.queryByLabelText("From")).toBeNull();
    expect(screen.queryByLabelText("To")).toBeNull();
    expect(screen.getByTestId("location-search")).toHaveTextContent("month=");
  });

  it("shows only From and To fields for Custom range", async () => {
    renderRecords();
    await screen.findByRole("table", { name: "Technician finished activity" });

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "custom" },
    });

    expect(await screen.findByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
    expect(screen.queryByLabelText("Month")).toBeNull();
    expect(screen.getByTestId("location-search")).toHaveTextContent("fromDate=");
    expect(screen.getByTestId("location-search")).toHaveTextContent("toDate=");
  });

  it("persists a selected month and sends Manila calendar boundaries", async () => {
    renderRecords("/technician/records?month=2026-09");

    await screen.findByRole("table", { name: "Technician finished activity" });
    expect(screen.getByLabelText("Date")).toHaveValue("select-month");
    expect(screen.getByLabelText("Month")).toHaveValue("2026-09");
    expect(mocks.get).toHaveBeenCalledWith("/animals/records", {
      params: {
        page: 1,
        limit: 10,
        fromDate: "2026-09-01",
        toDate: "2026-09-30",
      },
    });
  });

  it("does not render the redundant period, service type, and record count summary", async () => {
    renderRecords("/technician/records?month=2026-09");

    await screen.findByRole("table", { name: "Technician finished activity" });
    const metrics = screen.getByRole("region", { name: "Official record metrics" });
    await waitFor(() =>
      expect(within(metrics).getByText("All Records").closest(".card")).toHaveTextContent("4"),
    );
    expect(
      screen.queryByText("September 2026 · All service types · 4 records"),
    ).toBeNull();
  });

  it("renders metric values as passive summary cards labeled All Records", async () => {
    renderRecords("/technician/records?month=2026-09");

    await screen.findByRole("table", { name: "Technician finished activity" });
    const metrics = screen.getByRole("region", { name: "Official record metrics" });

    expect(within(metrics).queryAllByRole("button")).toHaveLength(0);
    await waitFor(() => {
      expect(within(metrics).getByText("All Records").closest(".card")).toHaveTextContent("4");
      expect(within(metrics).getByText("Insemination").closest(".card")).toHaveTextContent("1");
      expect(within(metrics).getByText("Health").closest(".card")).toHaveTextContent("1");
      expect(within(metrics).getByText("Pregnancy").closest(".card")).toHaveTextContent("1");
      expect(within(metrics).getByText("Calving").closest(".card")).toHaveTextContent("1");
    });
    expect(within(metrics).getByText("All Records").closest(".card")).toHaveClass(
      "border-l-4",
      "border-l-primary",
    );
    expect(within(metrics).getByText("Insemination").closest(".card")).toHaveClass(
      "border-l-4",
      "border-l-secondary",
    );
    expect(within(metrics).getByText("Health").closest(".card")).toHaveClass(
      "border-l-4",
      "border-l-success",
    );
    expect(within(metrics).getByText("Pregnancy").closest(".card")).toHaveClass(
      "border-l-4",
      "border-l-warning",
    );
    expect(within(metrics).getByText("Calving").closest(".card")).toHaveClass(
      "border-l-4",
      "border-l-info",
    );
    expect(within(metrics).queryAllByText("September 2026")).toHaveLength(0);
    expect(within(metrics).queryByText("All Activity")).toBeNull();
  });

  it("keeps metric cards passive and uses only the service dropdown for filtering", async () => {
    renderRecords("/technician/records?month=2026-09&type=health&page=3");

    await screen.findByRole("table", { name: "Technician finished activity" });
    const metrics = screen.getByRole("region", { name: "Official record metrics" });
    const inseminationMetric = within(metrics).getByText("Insemination").closest(".card");
    const serviceFilter = screen.getByLabelText("Filter records by type");

    expect(inseminationMetric).toHaveClass("card");
    expect(inseminationMetric.tagName).toBe("DIV");
    expect(serviceFilter).toHaveValue("health");
    fireEvent.click(inseminationMetric);

    expect(serviceFilter).toHaveValue("health");
    expect(screen.getByTestId("location-search")).toHaveTextContent(
      "?month=2026-09&type=health&page=3",
    );

    expect(screen.queryByLabelText("Report service type")).toBeNull();
    fireEvent.change(serviceFilter, {
      target: { value: "pregnancy" },
    });

    await waitFor(() => {
      const location = screen.getByTestId("location-search");
      expect(location).toHaveTextContent("month=2026-09");
      expect(location).toHaveTextContent("type=pregnancy");
      expect(location).toHaveTextContent("page=1");
    });
  });

  it("shows a contextual empty state with a clear filters action", async () => {
    mocks.get.mockImplementation((url) => {
      if (url === "/animals/records") {
        return Promise.resolve({
          data: {
            data: [],
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 1,
            summary: { all: 0, insemination: 0, health: 0, pregnancy: 0, calving: 0 },
          },
        });
      }
      return Promise.resolve({ data: { data: {} } });
    });

    renderRecords("/technician/records?month=2026-09&type=health");

    expect(await screen.findByText("No Health records found for September 2026.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("uses a familiar empty state for This month", async () => {
    mocks.get.mockResolvedValue({
      data: {
        data: [],
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1,
        summary: { all: 0, insemination: 0, health: 0, pregnancy: 0, calving: 0 },
      },
    });

    renderRecords("/technician/records?datePreset=this-month");

    expect(await screen.findByText("No records found this month.")).toBeInTheDocument();
  });

  it("retries the current query without clearing its filters", async () => {
    let attempts = 0;
    mocks.get.mockImplementation((url) => {
      if (url === "/animals/records") {
        attempts += 1;
        if (attempts === 1) return Promise.reject(new Error("network"));
        return Promise.resolve({
          data: {
            data: records,
            page: 1,
            limit: 10,
            total: 4,
            totalPages: 1,
            summary: { all: 4, insemination: 1, health: 1, pregnancy: 1, calving: 1 },
          },
        });
      }
      return Promise.resolve({ data: { data: {} } });
    });

    renderRecords("/technician/records?month=2026-09&type=health");

    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("table", { name: "Technician finished activity" })).toBeInTheDocument();
    expect(attempts).toBe(2);
    expect(screen.getByTestId("location-search")).toHaveTextContent("month=2026-09&type=health");
  });

  it("downloads the full report using the current period and service filter", async () => {
    mocks.get.mockImplementation((url) => {
      if (url === "/animals/records/export") {
        return Promise.resolve({ data: new Blob(["csv"], { type: "text/csv" }) });
      }
      if (url === "/animals/records") {
        return Promise.resolve({
          data: {
            data: records,
            page: 1,
            limit: 10,
            total: 4,
            totalPages: 1,
            summary: { all: 4, insemination: 1, health: 1, pregnancy: 1, calving: 1 },
          },
        });
      }
      return Promise.resolve({ data: { data: {} } });
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    renderRecords("/technician/records?month=2026-09");
    await screen.findByRole("table", { name: "Technician finished activity" });
    fireEvent.change(screen.getByLabelText("Filter records by type"), {
      target: { value: "health" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Download report" }));

    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith("/animals/records/export", {
        params: {
          type: "health",
          fromDate: "2026-09-01",
          toDate: "2026-09-30",
        },
        responseType: "blob",
      }),
    );
  });

  it("exports all service types when the Records filter is All service types", async () => {
    mocks.get.mockImplementation((url) => {
      if (url === "/animals/records/export") {
        return Promise.resolve({ data: new Blob(["csv"], { type: "text/csv" }) });
      }
      if (url === "/animals/records") {
        return Promise.resolve({
          data: {
            data: records,
            page: 1,
            limit: 10,
            total: 4,
            totalPages: 1,
            summary: { all: 4, insemination: 1, health: 1, pregnancy: 1, calving: 1 },
          },
        });
      }
      return Promise.resolve({ data: { data: {} } });
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    renderRecords("/technician/records?month=2026-09");
    await screen.findByRole("table", { name: "Technician finished activity" });
    expect(screen.getByLabelText("Filter records by type")).toHaveDisplayValue(
      "All service types",
    );
    fireEvent.click(screen.getByRole("button", { name: "Download report" }));

    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith("/animals/records/export", {
        params: {
          fromDate: "2026-09-01",
          toDate: "2026-09-30",
        },
        responseType: "blob",
      }),
    );
  });

  it("exports all matching records using the active Last 30 days preset", async () => {
    const { fromDate, toDate } = resolveRecordsDateFilter(
      new URLSearchParams("datePreset=last-30-days"),
    );
    mocks.get.mockImplementation((url) => {
      if (url === "/animals/records/export") {
        return Promise.resolve({ data: new Blob(["csv"], { type: "text/csv" }) });
      }
      return Promise.resolve({
        data: {
          data: records,
          page: 1,
          limit: 10,
          total: 4,
          totalPages: 1,
          summary: { all: 4, insemination: 1, health: 1, pregnancy: 1, calving: 1 },
        },
      });
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-30-days");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    renderRecords("/technician/records?datePreset=last-30-days&type=pregnancy");
    await screen.findByRole("table", { name: "Technician finished activity" });
    fireEvent.click(screen.getByRole("button", { name: "Download report" }));

    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith("/animals/records/export", {
        params: {
          type: "pregnancy",
          fromDate,
          toDate,
        },
        responseType: "blob",
      }),
    );
  });
});

