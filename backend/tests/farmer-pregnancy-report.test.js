import test from "node:test";
import assert from "node:assert/strict";
import { submitFarmerPregnancyReport, verifyFarmerPregnancyReport } from "../src/controllers/ai-request.controllers.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Animal } from "../src/models/animal.model.js";
import { AnimalTimelineEvent } from "../src/models/animal-timeline-event.model.js";
import { Task } from "../src/models/task.model.js";

test("Farmer-Reported Pregnancy Foundation Tests", async (t) => {
  const farmerId = "507f1f77bcf86cd799439001";
  const technicianId = "507f1f77bcf86cd799439002";
  const animalId = "507f1f77bcf86cd799439003";
  const inseminationId = "507f1f77bcf86cd799439004";

  AnimalTimelineEvent.create = async () => {};
  AnimalTimelineEvent.insertMany = async () => {};
  Insemination.startSession = async () => ({
    withTransaction: async (cb) => await cb(),
    endSession: async () => {}
  });
  Insemination.updateOne = async () => {};

  const mockReq = (body, user) => ({
    params: { id: inseminationId },
    body,
    user
  });

  const mockRes = () => {
    const res = {};
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      res.body = data;
      return res;
    };
    return res;
  };

  await t.test("submitFarmerPregnancyReport does not overwrite original observation", async () => {
    const originalRequest = {
      _id: inseminationId,
      farmerId,
      animalId,
      status: "done",
      inseminationDate: new Date("2026-08-01"),
      outcome: null,
      isSuccess: null,
      farmerOutcomeReport: "possible_pregnancy",
      farmerOutcomeReportedAt: new Date("2026-08-01"),
      farmerObservationNotes: "Original notes",
      evidencePhotos: ["photo1.jpg"],
      save: async function() { this.saved = true; return this; }
    };

    Insemination.findOne = () => ({
      populate: async () => originalRequest
    });
    Animal.findById = async () => ({
      _id: animalId,
      reproductiveStatus: "Likely Pregnant"
    });

    const req = mockReq({ notes: "New pregnancy notes", evidencePhotos: ["newphoto.jpg"] }, { _id: farmerId, role: "farmer" });
    const res = mockRes();

    await submitFarmerPregnancyReport(req, res);

    assert.equal(res.statusCode, 200, res.body?.message);
    assert.equal(originalRequest.farmerPregnancyReport, true);
    assert.equal(originalRequest.farmerPregnancyNotes, "New pregnancy notes");
    assert.deepEqual(originalRequest.farmerPregnancyPhotos, ["newphoto.jpg"]);
    assert.equal(originalRequest.pregnancyReportVerificationStatus, "pending");

    assert.equal(originalRequest.farmerOutcomeReport, "possible_pregnancy");
    assert.equal(originalRequest.farmerObservationNotes, "Original notes");
    assert.deepEqual(originalRequest.evidencePhotos, ["photo1.jpg"]);
  });

  await t.test("verifyFarmerPregnancyReport Request More Info", async () => {
    const originalTaskFindOne = Task.findOne;
    const request = {
      _id: inseminationId,
      farmerId,
      animalId,
      status: "done",
      farmerPregnancyReport: true,
      pregnancyReportVerificationStatus: "pending",
      technicianId,
      approvedBy: technicianId,
      save: async function() { return this; }
    };

    Insemination.findOne = () => ({
      populate: async () => request
    });
    Animal.findById = async () => ({
      _id: animalId,
      reproductiveStatus: "Likely Pregnant"
    });
    Task.findOne = () => ({
      sort: async () => ({
        _id: "507f1f77bcf86cd799439005",
        technicianId,
        taskType: "PD",
        status: "Pending",
      }),
    });

    const req = mockReq({ action: "request_more_info" }, { _id: technicianId, role: "technician" });
    const res = mockRes();

    try {
      await verifyFarmerPregnancyReport(req, res);

      assert.equal(res.statusCode, 200, res.body?.message);
      assert.equal(request.pregnancyReportVerificationStatus, "more_info_requested");
      assert.equal(request.pregnancyReportReviewedBy, technicianId);
    } finally {
      Task.findOne = originalTaskFindOne;
    }
  });

  await t.test("submitFarmerPregnancyReport rejects in-progress AI", async () => {
    const originalRequest = {
      _id: inseminationId,
      farmerId,
      animalId,
      status: "in-progress",
      outcome: null,
      isSuccess: null,
      save: async function() { this.saved = true; return this; }
    };

    Insemination.findOne = () => ({ populate: async () => originalRequest });
    Animal.findById = async () => ({ _id: animalId, reproductiveStatus: "Normal" });

    const req = mockReq({ notes: "Early pregnancy" }, { _id: farmerId, role: "farmer" });
    const res = mockRes();

    await submitFarmerPregnancyReport(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, "AI_NOT_COMPLETED");
  });

  await t.test("submitFarmerPregnancyReport rejects done AI without inseminationDate", async () => {
    const originalRequest = {
      _id: inseminationId,
      farmerId,
      animalId,
      status: "done",
      inseminationDate: null,
      outcome: null,
      isSuccess: null,
      save: async function() { this.saved = true; return this; }
    };

    Insemination.findOne = () => ({ populate: async () => originalRequest });
    Animal.findById = async () => ({ _id: animalId, reproductiveStatus: "Normal" });

    const req = mockReq({ notes: "Pregnancy" }, { _id: farmerId, role: "farmer" });
    const res = mockRes();

    await submitFarmerPregnancyReport(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, "The AI service is missing a canonical insemination date.");
  });

  await t.test("submitFarmerPregnancyReport accepts done AI with canonical inseminationDate", async () => {
    const originalRequest = {
      _id: inseminationId,
      farmerId,
      animalId,
      status: "done",
      inseminationDate: new Date("2026-08-01"),
      outcome: null,
      isSuccess: null,
      save: async function() { this.saved = true; return this; }
    };

    Insemination.findOne = () => ({ populate: async () => originalRequest });
    Animal.findById = async () => ({ _id: animalId, reproductiveStatus: "Likely Pregnant" });

    const req = mockReq({ notes: "Pregnancy confirmed" }, { _id: farmerId, role: "farmer" });
    const res = mockRes();

    await submitFarmerPregnancyReport(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(originalRequest.farmerPregnancyReport, true);
  });

  await t.test("submitFarmerPregnancyReport rejects resolved AI protections", async () => {
    const originalRequest = {
      _id: inseminationId,
      farmerId,
      animalId,
      status: "done",
      inseminationDate: new Date("2026-08-01"),
      outcome: "Pregnant",
      isSuccess: true,
      save: async function() { this.saved = true; return this; }
    };

    Insemination.findOne = () => ({ populate: async () => originalRequest });
    Animal.findById = async () => ({ _id: animalId, reproductiveStatus: "Pregnant" });

    const req = mockReq({ notes: "Pregnancy" }, { _id: farmerId, role: "farmer" });
    const res = mockRes();

    await submitFarmerPregnancyReport(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, "AI_ALREADY_RESOLVED");
  });
});
