import { vi, describe, it, expect, beforeEach } from "vitest";
import { previousInsemination } from "../src/controllers/technician.controllers.js";
import { User } from "../src/models/user.model.js";
import { Animal } from "../src/models/animal.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Calving } from "../src/models/calving.model.js";
import { Task } from "../src/models/task.model.js";
import { inngest } from "../src/config/inngest.js";
import { recordPreviousInsemination } from "../src/services/previous-insemination.service.js";

vi.mock("../src/models/user.model.js");
vi.mock("../src/models/animal.model.js");
vi.mock("../src/models/insemination.model.js");
vi.mock("../src/models/pregnancy.model.js");
vi.mock("../src/models/calving.model.js");
vi.mock("../src/models/task.model.js");
vi.mock("../src/config/inngest.js");
vi.mock("../src/services/previous-insemination.service.js");

describe("Historical AI Recording Endpoint", () => {
  const mockReq = (body) => ({
    body,
    user: { _id: "tech123", role: "technician", name: "Test Tech" },
    app: { get: () => ({ emit: vi.fn() }) },
  });

  const mockRes = () => {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const runTest = async (mockData, requestBody) => {
    User.findById.mockResolvedValue(mockData.farmer || { _id: "farmer123" });
    Animal.findById.mockResolvedValue(mockData.animal || { _id: "animal123", farmerId: "farmer123" });
    Insemination.findOne
      .mockResolvedValueOnce(mockData.newerInsemination || null)
      .mockResolvedValueOnce(mockData.activeInsemination || null);
    Pregnancy.findOne.mockResolvedValue(mockData.activePregnancy || null);
    Calving.findOne.mockResolvedValue(mockData.newerCalving || null);

    recordPreviousInsemination.mockResolvedValue({
      insemination: { _id: "ai123" },
      outcome: "created",
      task: null,
    });
    Insemination.findByIdAndUpdate.mockResolvedValue({});
    Task.updateOne.mockResolvedValue({});

    const req = mockReq(requestBody);
    const res = mockRes();
    await previousInsemination(req, res);
    return res;
  };

  it("1. Previous AI 17 days ago accepted", async () => {
    const pastDate = new Date(Date.now() - 17 * 24 * 60 * 60 * 1000);
    const res = await runTest({}, {
      farmerId: "farmer123",
      animalId: "animal123",
      entryMode: "history_only",
      inseminationDetails: { inseminationDate: pastDate },
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(recordPreviousInsemination).toHaveBeenCalledWith(expect.objectContaining({ entryMode: "history_only" }));
  });

  it("9. Future AI date rejected", async () => {
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    recordPreviousInsemination.mockRejectedValueOnce(Object.assign(
      new Error("Previous AI service date cannot be in the future."),
      { status: 400, code: "PREVIOUS_AI_DATE_IN_FUTURE" },
    ));
    const res = await runTest({}, {
      farmerId: "farmer123",
      animalId: "animal123",
      entryMode: "history_only",
      inseminationDetails: { inseminationDate: futureDate },
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("future") }));
  });

  it("10. Farmer/animal mismatch rejected", async () => {
    const pastDate = new Date(Date.now() - 100000);
    const res = await runTest({ animal: { _id: "animal123", farmerId: "otherFarmer" } }, {
      farmerId: "farmer123",
      animalId: "animal123",
      entryMode: "history_only",
      inseminationDetails: { inseminationDate: pastDate },
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "ANIMAL_FARMER_MISMATCH" }));
  });

  it("11. History-only AI is allowed beside active work", async () => {
    const pastDate = new Date(Date.now() - 100000);
    const res = await runTest({ activeInsemination: { _id: "active123" } }, {
      farmerId: "farmer123",
      animalId: "animal123",
      entryMode: "history_only",
      inseminationDetails: { inseminationDate: pastDate },
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("12. History-only AI is allowed beside a newer AI", async () => {
    const pastDate = new Date(Date.now() - 100000);
    const res = await runTest({ newerInsemination: { _id: "newer123" } }, {
      farmerId: "farmer123",
      animalId: "animal123",
      entryMode: "history_only",
      inseminationDetails: { inseminationDate: pastDate },
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("13. History-only AI is allowed beside a newer calving", async () => {
    const pastDate = new Date(Date.now() - 100000);
    const res = await runTest({ newerCalving: { _id: "calving123" } }, {
      farmerId: "farmer123",
      animalId: "animal123",
      entryMode: "history_only",
      inseminationDetails: { inseminationDate: pastDate },
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("14. History-only AI does not replace a current pregnancy", async () => {
    const pastDate = new Date(Date.now() - 100000);
    const res = await runTest({ animal: { _id: "animal123", farmerId: "farmer123", reproductiveStatus: "Pregnant" } }, {
      farmerId: "farmer123",
      animalId: "animal123",
      entryMode: "history_only",
      inseminationDetails: { inseminationDate: pastDate },
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
