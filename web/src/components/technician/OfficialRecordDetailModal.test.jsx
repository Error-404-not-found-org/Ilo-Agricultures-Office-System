import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("../../lib/axios", () => ({
  default: { get: mocks.get },
}));

import OfficialRecordDetailModal from "./OfficialRecordDetailModal";
import { normalizeRecordAttachments } from "./officialRecordAttachments";

const identity = {
  animalId: "animal-1",
  recordKind: "medical_record",
  recordId: "medical-1",
};

const dataImage = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

const healthRecord = (attachments = []) => ({
  sourceId: "medical-1",
  type: "health",
  title: "Health record",
  date: "2026-08-08T04:00:00.000Z",
  animalId: {
    _id: "animal-1",
    animalId: "TAG-001",
    earTag: "TAG-001",
    species: "Cattle",
    breed: "Native",
  },
  farmerId: { name: "Farmer One" },
  technician: { name: "Technician One" },
  details: {
    serviceDate: "2026-08-08T04:00:00.000Z",
    requestType: "disease",
    diagnosis: "Bacterial infection",
    treatment: "Antibiotic",
  },
  attachments,
});

const directHealthRecord = () => ({
  ...healthRecord(),
  date: "2026-08-08T00:00:00.000Z",
  datePrecision: "date",
  details: {
    serviceDate: "2026-08-08T00:00:00.000Z",
    serviceType: "medicine",
    isDirectHealthService: true,
    diagnosis: "Bacterial infection",
    treatment: "Antibiotic",
  },
});

const renderDetail = ({ record = healthRecord(), onClose = vi.fn() } = {}) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  mocks.get.mockResolvedValue({ data: { data: record } });
  render(
    <QueryClientProvider client={client}>
      <OfficialRecordDetailModal
        recordIdentity={identity}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
  return { onClose };
};

describe("OfficialRecordDetailModal attachments", () => {
  let anchorClick;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:attachment"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    anchorClick.mockRestore();
  });

  it("labels standalone Health records as services and shows a date without time", async () => {
    renderDetail({ record: directHealthRecord() });

    expect(await screen.findByText("Service type")).toBeInTheDocument();
    expect(screen.queryByText("Request type")).toBeNull();
    expect(screen.getByText("Medicine")).toBeInTheDocument();
    expect(screen.getByText("August 8, 2026")).toBeInTheDocument();
    expect(screen.queryByText(/8:00\s*AM/i)).toBeNull();
  });

  it("omits the section when the official record has no valid attachments", async () => {
    renderDetail();

    await screen.findByText("Bacterial infection");
    expect(screen.queryByText("Attachments")).toBeNull();
  });

  it("omits the section for an AI record without evidence", async () => {
    renderDetail({
      record: {
        ...healthRecord(),
        type: "ai",
        title: "Artificial Insemination",
      },
    });

    await screen.findByText("Artificial Insemination");
    expect(screen.queryByRole("region", { name: "Attachments" })).toBeNull();
  });

  it("renders one compact attachment row with View and Download actions", async () => {
    renderDetail({
      record: healthRecord([
        {
          url: "https://res.cloudinary.com/demo/image/upload/v1/opaque-id.jpg",
          category: "farmer_evidence",
        },
      ]),
    });

    expect(await screen.findByText("Attachments")).toBeInTheDocument();
    expect(screen.getByText("1 saved photo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Health_Photo_1.jpg" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Health_Photo_1.jpg" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download Health_Photo_1.jpg" })).toBeInTheDocument();
  });

  it("renders every valid attachment and ignores invalid URLs", async () => {
    renderDetail({
      record: healthRecord([
        { url: "https://example.test/one.jpg" },
        { url: "https://example.test/two.png" },
        { url: "javascript:alert(1)" },
      ]),
    });

    expect(await screen.findByRole("button", { name: "Health_Photo_1.jpg" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Health_Photo_2.png" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Health_Photo_3/ })).toBeNull();
  });

  it("renders canonical base64 AI evidence and opens it in the shared viewer", async () => {
    renderDetail({
      record: {
        ...healthRecord([{ url: dataImage, category: "request_evidence" }]),
        type: "ai",
        title: "Artificial Insemination",
      },
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "View AI_Evidence_1.jpg" }),
    );

    expect(
      screen.getByRole("img", { name: "Preview of AI_Evidence_1.jpg" }),
    ).toHaveAttribute("src", dataImage);
    expect(screen.getByText("Read-only saved activity")).toBeInTheDocument();
  });

  it("normalizes current evidence for every supported Records type", () => {
    const supported = [
      { type: "ai", expected: "AI_Evidence_1.jpg" },
      { type: "health", expected: "Health_Photo_1.jpg" },
      { type: "calving", expected: "Calving_Photo_1.jpg" },
    ];

    supported.forEach(({ type, expected }) => {
      expect(
        normalizeRecordAttachments({
          ...healthRecord([{ url: dataImage }]),
          type,
        }).map((attachment) => attachment.displayName),
      ).toEqual([expected]);
    });

    expect(
      normalizeRecordAttachments({
        ...healthRecord([{ url: dataImage }]),
        type: "health",
        sourceKind: "health_request",
        title: "Health Advice",
      }),
    ).toHaveLength(1);
    expect(
      normalizeRecordAttachments({
        ...healthRecord(),
        type: "pregnancy",
        attachments: [],
      }),
    ).toEqual([]);
  });

  it("shows abortion delivery method as not applicable even for a legacy Natural value", async () => {
    renderDetail({
      record: {
        ...healthRecord(),
        type: "calving",
        title: "Calving Record",
        details: {
          calvingOutcome: "abortion",
          calvingEase: "Natural",
          numberOfCalves: 0,
        },
      },
    });

    expect(await screen.findByText("Not applicable")).toBeInTheDocument();
  });

  it("opens attachments from filename or View and closes only the nested preview", async () => {
    const { onClose } = renderDetail({
      record: healthRecord([
        { url: "https://example.test/one.jpg" },
        { url: "https://example.test/two.jpg" },
      ]),
    });

    fireEvent.click(await screen.findByRole("button", { name: "Health_Photo_1.jpg" }));
    expect(
      screen.getByRole("img", { name: "Preview of Health_Photo_1.jpg" }),
    ).toHaveAttribute("src", "https://example.test/one.jpg");

    const dialogs = screen.getAllByRole("dialog");
    const previewDialog = dialogs.at(-1);
    fireEvent.click(
      within(previewDialog).getByRole("button", { name: "Close dialog" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("img", { name: "Preview of Health_Photo_1.jpg" }),
      ).toBeNull(),
    );
    expect(
      screen.getByAltText("Preview of Health_Photo_1.jpg"),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Read-only saved activity")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View Health_Photo_2.jpg" }));
    expect(
      screen.getByRole("img", { name: "Preview of Health_Photo_2.jpg" }),
    ).toHaveAttribute("src", "https://example.test/two.jpg");

    const reopenedPreview = screen.getAllByRole("dialog").at(-1);
    fireEvent.click(
      within(reopenedPreview).getByRole("button", { name: "Close modal" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("img", { name: "Preview of Health_Photo_2.jpg" }),
      ).toBeNull(),
    );
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "View Health_Photo_1.jpg" }));
    const escapePreview = screen.getAllByRole("dialog").at(-1);
    fireEvent(
      escapePreview,
      new Event("cancel", { bubbles: false, cancelable: true }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("img", { name: "Preview of Health_Photo_1.jpg" }),
      ).toBeNull(),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("downloads the selected attachment with a meaningful contextual filename", async () => {
    let clickedDownload = "";
    anchorClick.mockImplementation(function captureDownload() {
      clickedDownload = this.download;
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["image"], { type: "image/jpeg" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderDetail({
      record: healthRecord([{ url: "https://example.test/one.jpg" }]),
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Download Health_Photo_1.jpg" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/one.jpg",
      { mode: "cors", credentials: "omit" },
    ));
    await waitFor(() =>
      expect(clickedDownload).toBe("Health_TAG-001_2026-08-08_1.jpg"),
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:attachment");
  });

  it.each(["X", "Close button", "backdrop", "Escape"])(
    "keeps the parent %s close contract intact",
    async (method) => {
      const result = renderDetail();
      await screen.findByText("Bacterial infection");
      const recordDialog = screen.getAllByRole("dialog")[0];
      if (method === "X") {
        fireEvent.click(
          within(recordDialog).getByRole("button", { name: "Close modal" }),
        );
      } else if (method === "Close button") {
        fireEvent.click(
          within(recordDialog).getByRole("button", { name: "Close" }),
        );
      } else if (method === "backdrop") {
        fireEvent.click(
          within(recordDialog).getByRole("button", { name: "Close dialog" }),
        );
      } else {
        fireEvent(
          recordDialog,
          new Event("cancel", { bubbles: false, cancelable: true }),
        );
      }
      expect(result.onClose).toHaveBeenCalledTimes(1);
    },
  );

  it("retains record content when the parent clears selection for the exit transition", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mocks.get.mockResolvedValue({ data: { data: healthRecord() } });
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <OfficialRecordDetailModal
          recordIdentity={identity}
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Bacterial infection")).toBeInTheDocument();

    rerender(
      <QueryClientProvider client={client}>
        <OfficialRecordDetailModal recordIdentity={null} onClose={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Bacterial infection")).toBeInTheDocument();
    expect(screen.getByText("Health record")).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it("generates clean display names instead of exposing storage IDs", () => {
    const normalized = normalizeRecordAttachments({
      ...healthRecord(),
      attachments: [
        { url: "https://example.test/storage-id.jpg" },
        { url: "https://example.test/7f45a9c2.webp" },
      ],
    });

    expect(normalized.map((item) => item.displayName)).toEqual([
      "Health_Photo_1.jpg",
      "Health_Photo_2.webp",
    ]);
  });
});
