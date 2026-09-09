import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ids = {
  task: "507f1f77bcf86cd799439031",
  insemination: "507f1f77bcf86cd799439021",
  animal: "507f1f77bcf86cd799439081",
  farmer: "507f1f77bcf86cd799439071",
};

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../../lib/axios", () => ({
  default: { get: mocks.get, post: mocks.post },
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

import PregnancyDiagnosisModal from "./PregnancyDiagnosisModal";
import { getPregnancyReadinessFallback } from "../../utils/pregnancyReadinessFallback";

const taskDetail = {
  _id: ids.task,
  taskType: "PD",
  status: "Pending",
  metadata: { workflowStage: "initial_confirmation", inseminationId: ids.insemination },
  farmerId: { _id: ids.farmer, name: "Dong Pongase" },
  animalIds: [{ _id: ids.animal, name: "Daisy", earTag: "DP-02", species: "Cattle", breed: "Brahman" }],
  pregnancyReadiness: {
    isEligible: true,
    daysPostAI: 736,
    policyMode: "method_based",
    policyVersion: "2026-01",
    methods: [
      { methodCode: "palpation", label: "Palpation", enabled: true, isEligible: true },
      { methodCode: "ultrasound", label: "Ultrasound", enabled: true, isEligible: true },
      { methodCode: "visual_observation", label: "Visual Observation", enabled: true, isEligible: true },
      { methodCode: "farmer_interview", label: "Farmer Interview", enabled: true, isEligible: true },
      { methodCode: "other", label: "Other", enabled: true, isEligible: true },
    ],
  },
  insemination: {
    _id: ids.insemination,
    inseminationDate: "2024-08-26T04:00:00.000Z",
    attemptNumber: 1,
    sireCode: "44-12",
    sireBreed: "Brahman",
    farmerOutcomeReport: "possible_pregnancy",
    farmerObservationNotes: "No heat signs noticed.",
    animalId: { _id: ids.animal, name: "Daisy", earTag: "DP-02", species: "Cattle", breed: "Brahman" },
  },
};

const renderModal = (detail = taskDetail) => {
  mocks.get.mockResolvedValue({ data: detail });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <PregnancyDiagnosisModal
        isOpen
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        taskData={{ taskType: "PD" }}
        taskId={ids.task}
      />
    </QueryClientProvider>,
  );
  return {
    rerenderModal: (nextTaskId, nextTaskData = { taskType: "PD" }) =>
      view.rerender(
        <QueryClientProvider client={client}>
          <PregnancyDiagnosisModal
            isOpen
            onClose={vi.fn()}
            onSuccess={vi.fn()}
            taskData={nextTaskData}
            taskId={nextTaskId}
          />
        </QueryClientProvider>,
      ),
  };
};

const chooseMethodAndDate = async () => {
  fireEvent.click(await screen.findByRole("button", { name: /Palpation/ }));
  fireEvent.change(screen.getByLabelText("Examination Date"), {
    target: { value: "2026-09-01" },
  });
};

describe("PregnancyDiagnosisModal Work Queue parity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({ data: taskDetail });
    mocks.post.mockResolvedValue({ data: {} });
  });

  it("loads canonical task details instead of deriving pregnancy context from the Work Queue item", async () => {
    renderModal();

    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith(`/tasks/${ids.task}`),
    );
    expect(await screen.findByText("Aug 26, 2024")).toBeTruthy();
    expect(screen.getByText("#1")).toBeTruthy();
    expect(screen.getByText("44-12 · Brahman")).toBeTruthy();
    expect(screen.getByText(/736 days since Inseminated/i)).toBeTruthy();
    expect(screen.getByText("possible pregnancy")).toBeTruthy();
    expect(screen.getByText("No heat signs noticed.")).toBeTruthy();
    expect(screen.getByText(/Tag DP-02.*Cattle.*Brahman/)).toBeTruthy();
  });

  it("shows the Mobile-equivalent outcomes and diagnostic methods", async () => {
    renderModal();

    await screen.findByText("Aug 26, 2024");
    for (const label of ["Confirmed Pregnant", "Not Pregnant", "Returned to Heat", "Additional Check Needed"]) {
      expect(screen.getByRole("button", { name: new RegExp(`^${label}`) })).toBeTruthy();
    }
    for (const label of ["Manual Palpation", "Visual Assessment", "Farmer Interview", "Other"]) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: /Ultrasound/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Blood PAG/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Milk PAG/i })).toBeNull();
  });

  it("blocks a new diagnosis until a method is selected", async () => {
    renderModal();

    fireEvent.click(await screen.findByRole("button", { name: /^Confirmed Pregnant/ }));
    fireEvent.change(screen.getByLabelText("Examination Date"), {
      target: { value: "2026-09-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit Diagnosis" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please select an examination method.",
    );
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each([
    ["Confirmed Pregnant", "pregnant"],
    ["Not Pregnant", "not_pregnant"],
    ["Returned to Heat", "return_to_heat"],
  ])("submits %s using the canonical Mobile verification payload", async (label, verificationResult) => {
    renderModal();

    fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${label}`) }));
    await chooseMethodAndDate();
    fireEvent.change(screen.getByLabelText("Clinical Notes"), {
      target: { value: "Field finding." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit Diagnosis" }));

    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        `/ai-request/${ids.insemination}/verify-breeding-observation`,
        expect.objectContaining({
          verificationResult,
          checkMethod: "palpation",
          checkedAt: "2026-09-01T12:00:00.000Z",
          technicianNotes: "Field finding.",
          policyVersion: "2026-01",
          taskId: ids.task,
        }),
      ),
    );
  });

  it("submits Additional Check Needed with the canonical next-check date", async () => {
    renderModal();

    fireEvent.click(await screen.findByRole("button", { name: /^Additional Check Needed/ }));
    await chooseMethodAndDate();
    fireEvent.change(screen.getByLabelText("Next Check Date"), {
      target: { value: "2026-09-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit Diagnosis" }));

    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        `/ai-request/${ids.insemination}/verify-breeding-observation`,
        expect.objectContaining({
          verificationResult: "needs_recheck",
          nextCheckDate: "2026-09-10T12:00:00.000Z",
          taskId: ids.task,
        }),
      ),
    );
  });

  it("renders dedicated Farmer Pregnancy Report contract and clean readiness presentation", async () => {
    const detailWithReport = {
      ...taskDetail,
      insemination: {
        ...taskDetail.insemination,
        farmerPregnancyReport: true,
        farmerPregnancyReportedAt: "2026-08-30T04:00:00.000Z",
        farmerPregnancyNotes: "Abdominal swelling and no heat signs.",
        farmerPregnancyPhotos: ["https://res.cloudinary.com/test/image.jpg"],
        pregnancyReportVerificationStatus: "pending",
      },
    };

    renderModal(detailWithReport);

    expect(await screen.findByText("Record Pregnancy Diagnosis")).toBeTruthy();
    expect(screen.queryByText("Pregnancy Confirmation")).toBeNull();
    expect(screen.getByText("Farmer's Observation Report")).toBeTruthy();
    expect(screen.getByText("Pending verification")).toBeTruthy();
    expect(screen.getByText(/Abdominal swelling and no heat signs/)).toBeTruthy();
    expect(screen.getByLabelText("View photo 1")).toBeTruthy();
    expect(screen.getByText("Diagnosis Window")).toBeTruthy();
    expect(screen.queryByText(/Confirmation status: Default/i)).toBeNull();
    expect(screen.queryByText(/Diagnosis status: Default/i)).toBeNull();
    expect(screen.queryByText(/\bDefault\b/i)).toBeNull();
  });

  it("does not offer a mutation after a finalized diagnosis", async () => {
    renderModal({
      ...taskDetail,
      status: "Completed",
      pregnancy: { pregnancyDiagnosis: { result: "Pregnant" } },
    });

    expect(
      await screen.findByText(/already been finalized/i),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Submit Diagnosis" })).toBeNull();
  });

  it("uses signed, fail-closed legacy readiness when backend readiness is absent", () => {
    expect(
      getPregnancyReadinessFallback(
        "2026-06-01T00:00:00.000Z",
        new Date("2026-08-01T00:00:00.000Z"),
      ),
    ).toMatchObject({ isEligible: true, daysPostAI: 61 });
    expect(
      getPregnancyReadinessFallback(
        "2026-09-01T00:00:00.000Z",
        new Date("2026-08-01T00:00:00.000Z"),
      ),
    ).toMatchObject({ isEligible: false, daysPostAI: -31 });
    expect(getPregnancyReadinessFallback("not-a-date")).toMatchObject({
      isEligible: false,
      daysPostAI: null,
    });
    expect(getPregnancyReadinessFallback(null)).toMatchObject({
      isEligible: false,
      daysPostAI: null,
    });
  });

  it("shows backend mutation errors inline instead of behind the modal", async () => {
    mocks.post.mockRejectedValue({
      response: { data: { message: "The diagnosis window changed." } },
    });
    renderModal();
    fireEvent.click(await screen.findByRole("button", { name: /^Confirmed Pregnant/ }));
    await chooseMethodAndDate();
    fireEvent.click(screen.getByRole("button", { name: "Submit Diagnosis" }));

    expect(
      (await screen.findByText("The diagnosis window changed.")).closest(
        '[role="alert"]',
      ),
    ).not.toBeNull();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("preserves same-task input and resets it when the Task identity changes", async () => {
    const { rerenderModal } = renderModal();
    await screen.findByText("Aug 26, 2024");
    fireEvent.change(screen.getByLabelText("Clinical Notes"), {
      target: { value: "Keep this finding" },
    });

    rerenderModal(ids.task, { taskType: "PD", raw: { status: "Pending" } });
    expect(screen.getByLabelText("Clinical Notes")).toHaveValue(
      "Keep this finding",
    );

    const nextTaskId = "507f1f77bcf86cd799439032";
    mocks.get.mockResolvedValue({
      data: { ...taskDetail, _id: nextTaskId },
    });
    rerenderModal(nextTaskId);
    await waitFor(() =>
      expect(screen.getByLabelText("Clinical Notes")).toHaveValue(""),
    );
  });
});
