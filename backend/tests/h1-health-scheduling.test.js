import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { createAIRequest, updateRequestStatus, createReInseminationRequest } from "../src/controllers/ai-request.controllers.js";
import { createHealthRequest, updateHealthRequestStatus } from "../src/controllers/health-request.controllers.js";
import { Animal } from "../src/models/animal.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Notification } from "../src/models/notification.model.js";
import { MedicalRecord } from "../src/models/medical-record.model.js";
import { User } from "../src/models/user.model.js";
import {
  normalizeVisitPeriod,
  normalizeVisitScheduleDate,
  hasVisitScheduleChanged
} from "../src/domain/visit-scheduling.js";

test.before(async () => {
  let baseUri = process.env.MONGODB_TEST_URI || "mongodb://127.0.0.1:27017";
  const urlObj = new URL(baseUri);
  
  // Validate it's a test/local environment
  if (urlObj.hostname !== "127.0.0.1" && urlObj.hostname !== "localhost" && !urlObj.hostname.includes("test")) {
    throw new Error("Unsafe MongoDB URI detected. Refusing to connect to non-local/non-test database.");
  }
  
  const uniqueDbName = `test_h1_health_scheduling_${process.pid}_${Date.now()}_${Math.floor(Math.random()*1000)}`;
  urlObj.pathname = `/${uniqueDbName}`;
  const isolatedUri = urlObj.toString();
  
  console.log(`Connecting to isolated test database: ${uniqueDbName}`);
  await mongoose.connect(isolatedUri);

  await Animal.deleteMany({});
  await HealthRequest.deleteMany({});
  await Insemination.deleteMany({});
  await Notification.deleteMany({});
});

test.after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  }
});

const mockApp = { get: () => ({ emit: () => {} }) };
const reqRes = (body, userRole = "farmer", overrideId = null) => {
  const _id = overrideId || new mongoose.Types.ObjectId();
  const req = { user: { _id, role: userRole, name: "Test User" }, body, params: {}, app: mockApp };
  const res = {
    statusCode: null, body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; }
  };
  return { req, res, _id };
};

const otonHealthDispatch = {
  location: {
    municipalityCode: "063034000",
    municipalityName: "Oton",
    localityType: "municipality",
  },
  stage: "local",
};

const makeEligibleHealthTechnician = (req) => {
  Object.assign(req.user, {
    status: "active",
    deletedAt: null,
    isVerified: true,
    profileClaimStatus: "claimed",
    dispatchProfile: {
      acceptsNewRequests: true,
      availabilityStatus: "available",
      serviceCapabilities: ["HEALTH"],
      serviceMunicipalities: [{ municipalityCode: "063034000" }],
    },
  });
};

test("FARMER AI", async (t) => {
  const farmerId = new mongoose.Types.ObjectId();

  await t.test("no preferredDate", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "AI-123", gender: "Female", species: "Cattle", breed: "Brahman", birthDate: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000) });
    const { req, res } = reqRes({ animalId: animalId.toString(), comment: "Test AI creation" }, "farmer", farmerId);
    await createAIRequest(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.request.preferredDate, undefined);
  });
  await t.test("legacy preferredDate ignored", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "AI-123", gender: "Female", species: "Cattle", breed: "Brahman", birthDate: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000) });
    const { req, res } = reqRes({ animalId: animalId.toString(), preferredDate: new Date() }, "farmer", farmerId);
    await createAIRequest(req, res);
    assert.equal(res.body.request.preferredDate, undefined);
  });
  await t.test("Farmer schedule fields ignored", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "AI-123", gender: "Female", species: "Cattle", breed: "Brahman", birthDate: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000) });
    const { req, res } = reqRes({ animalId: animalId.toString(), scheduledDate: new Date(), visitPeriod: "morning", preferredTime: "10:00", scheduledAt: new Date(), serviceStartedAt: new Date() }, "farmer", farmerId);
    await createAIRequest(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.request.scheduledDate, undefined);
    assert.equal(res.body.request.visitPeriod, undefined);
    assert.equal(res.body.request.preferredTime, undefined);
    assert.equal(res.body.request.scheduledAt, undefined);
    assert.equal(res.body.request.serviceStartedAt, undefined);
  });
  await t.test("duplicate protection preserved", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "AI-123", gender: "Female", species: "Cattle", breed: "Brahman", birthDate: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000) });
    const { req, res } = reqRes({ animalId: animalId.toString() }, "farmer", farmerId);
    await createAIRequest(req, res);
    const { req: req2, res: res2 } = reqRes({ animalId: animalId.toString() }, "farmer", farmerId);
    await createAIRequest(req2, res2);
    assert.equal(res2.statusCode, 409);
  });
  await t.test("re-insemination linkage preserved", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "AI-123", gender: "Female", species: "Cattle", breed: "Brahman", birthDate: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000) });
    const ai1 = await Insemination.create({
      farmerId,
      animalId,
      status: "done",
      inseminationDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      isSuccess: false,
      farmerOutcomeReport: "return_to_heat",
      outcome: "Failed (Re-heat)",
      failureReason: "return_to_heat",
      outcomeVerificationStatus: "verified",
      outcomeConfirmationSource: "technician_return_to_heat"
    });
    
    const { req, res } = reqRes({ animalId: animalId.toString(), comment: "Test" }, "farmer", farmerId);
    req.params.id = ai1._id.toString();
    await createReInseminationRequest(req, res);
    if (res.statusCode !== 201) {
      console.log("409 ERROR BODY:", res.body);
      const active = await Insemination.findOne({ animalId });
      console.log("ACTIVE FOUND:", active);
    }
    if (res.body.request.previousAttemptId == null) {
      console.log("RE-INSEM REQUEST BODY:", res.body.request);
    }
    assert.equal(res.body.request.previousAttemptId?.toString(), ai1._id.toString());
  });
});

test("FARMER HEALTH", async (t) => {
  const farmerId = new mongoose.Types.ObjectId();

  await t.test("no preferredDate", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-123", species: "Carabao", breed: "Native" });
    const { req, res } = reqRes({ animalId: animalId.toString(), symptoms: "s" }, "farmer", farmerId);
    await createHealthRequest(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.request.preferredDate, undefined);
  });
  await t.test("legacy preferredDate ignored", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-123", species: "Carabao", breed: "Native" });
    const { req, res } = reqRes({ animalId: animalId.toString(), symptoms: "s", preferredDate: new Date() }, "farmer", farmerId);
    await createHealthRequest(req, res);
    assert.equal(res.body.request.preferredDate, undefined);
  });
  await t.test("Farmer schedule fields ignored", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-123", species: "Carabao", breed: "Native" });
    const { req, res } = reqRes({ animalId: animalId.toString(), symptoms: "s", scheduledDate: new Date(), visitPeriod: "morning", preferredTime: "10:00", scheduledAt: new Date(), serviceStartedAt: new Date() }, "farmer", farmerId);
    await createHealthRequest(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.request.scheduledDate, undefined);
    assert.equal(res.body.request.visitPeriod, undefined);
    assert.equal(res.body.request.preferredTime, undefined);
    assert.equal(res.body.request.scheduledAt, undefined);
    assert.equal(res.body.request.serviceStartedAt, undefined);
  });
  await t.test("farmerNotes trimmed", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-123", species: "Carabao", breed: "Native" });
    const { req, res } = reqRes({ animalId: animalId.toString(), symptoms: "s", farmerNotes: "  abc  " }, "farmer", farmerId);
    await createHealthRequest(req, res);
    assert.equal(res.body.request.farmerNotes, "abc");
  });
  await t.test("photos stored", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-123", species: "Carabao", breed: "Native" });
    const { req, res } = reqRes({ animalId: animalId.toString(), symptoms: "s", photos: ["p1.jpg", "p2.jpg"] }, "farmer", farmerId);
    await createHealthRequest(req, res);
    assert.deepEqual(res.body.request.photos, ["p1.jpg", "p2.jpg"]);
  });
  await t.test("structured request details survive POST and persistence", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-STRUCTURED", species: "Carabao", breed: "Native" });
    const medicalRecordsBefore = await MedicalRecord.countDocuments({ animalId });
    const structuredPayload = {
      animalId: animalId.toString(),
      requestType: "disease",
      symptoms: "Legacy compatibility summary",
      farmerNotes: "Legacy note should not override structured data.",
      requestDetails: {
        version: 1,
        assistanceRequested: "medicine_request",
        observedSigns: ["diarrhea", "not_eating_normally"],
        farmerDescription: "Started yesterday and the animal looks weak.",
      },
    };
    const { req, res } = reqRes(structuredPayload, "farmer", farmerId);

    await createHealthRequest(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.request.requestType, "medicine");
    assert.equal(res.body.request.symptoms, "Legacy compatibility summary");
    assert.equal(
      res.body.request.farmerNotes,
      "Started yesterday and the animal looks weak.",
    );
    assert.deepEqual(res.body.request.requestDetails.observedSigns, [
      "diarrhea",
      "not_eating_normally",
    ]);
    const persisted = await HealthRequest.findById(res.body.request._id).lean();
    assert.equal(persisted.requestDetails.assistanceRequested, "medicine_request");
    assert.deepEqual(persisted.requestDetails.observedSigns, [
      "diarrhea",
      "not_eating_normally",
    ]);
    assert.equal(
      persisted.activeCaseKey,
      `${animalId}:medicine`,
    );
    assert.equal(
      await MedicalRecord.countDocuments({ animalId }),
      medicalRecordsBefore,
    );
    const { req: duplicateReq, res: duplicateRes } = reqRes(
      structuredPayload,
      "farmer",
      farmerId,
    );
    await createHealthRequest(duplicateReq, duplicateRes);
    assert.equal(duplicateRes.statusCode, 409);
    assert.equal(duplicateRes.body.code, "ACTIVE_HEALTH_CASE_EXISTS");
  });
  await t.test("structured Preventive Care can omit illness observations", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-PREVENTIVE", species: "Carabao", breed: "Native" });
    const { req, res } = reqRes({
      animalId: animalId.toString(),
      requestDetails: {
        version: 1,
        assistanceRequested: "preventive_care",
        observedSigns: [],
        farmerDescription: "",
      },
    }, "farmer", farmerId);

    await createHealthRequest(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.request.requestType, "checkup");
    assert.deepEqual(res.body.request.requestDetails.observedSigns, []);
    assert.match(res.body.request.symptoms, /Preventive care/);
  });
  await t.test("invalid photos rejected", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-SCH6", species: "Carabao", breed: "Native" });
    const { req, res } = reqRes({ animalId: animalId.toString(), symptoms: "s", photos: ["", null, "ok.jpg", 123] }, "farmer", farmerId);
    await createHealthRequest(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, "INVALID_PHOTOS");
  });
  await t.test("duplicate protection preserved", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-123", species: "Carabao", breed: "Native" });
    const { req, res } = reqRes({ animalId: animalId.toString(), symptoms: "s" }, "farmer", farmerId);
    await createHealthRequest(req, res);
    const { req: req2, res: res2 } = reqRes({ animalId: animalId.toString(), symptoms: "s" }, "farmer", farmerId);
    await createHealthRequest(req2, res2);
    assert.equal(res2.statusCode, 409);
  });
});

test("NORMALIZATION", async (t) => {
  await t.test("date-only input", () => {
    const d = normalizeVisitScheduleDate("2030-08-07");
    assert.equal(d.toISOString(), "2030-08-07T04:00:00.000Z");
  });
  await t.test("legacy ISO input", () => {
    const d = normalizeVisitScheduleDate("2030-08-07T14:30:00.000Z");
    assert.equal(d.toISOString(), "2030-08-07T04:00:00.000Z");
  });
  await t.test("clock discarded", () => {
    const d1 = normalizeVisitScheduleDate("2030-08-07T00:00:00.000Z");
    const d2 = normalizeVisitScheduleDate("2030-08-07T23:59:59.000Z");
    assert.equal(d1.getTime(), d2.getTime());
  });
  await t.test("invalid date", () => {
    assert.throws(() => normalizeVisitScheduleDate("not-a-date"), (err) => err.code === "INVALID_SCHEDULE_DATE");
  });
  await t.test("past date", () => {
    assert.throws(() => normalizeVisitScheduleDate("1999-01-01"), (err) => err.code === "SCHEDULE_DATE_IN_PAST");
  });
  await t.test("Morning normalization", () => {
    assert.equal(normalizeVisitPeriod(" MORNING "), "morning");
  });
  await t.test("Afternoon normalization", () => {
    assert.equal(normalizeVisitPeriod("  Afternoon  "), "afternoon");
  });
  await t.test("invalid period", () => {
    assert.throws(() => normalizeVisitPeriod("evening"), (err) => err.code === "INVALID_VISIT_PERIOD");
  });
});

test("HEALTH SCHEDULING", async (t) => {
  const farmerId = new mongoose.Types.ObjectId();
  const techId = new mongoose.Types.ObjectId();

  await t.test("missing date", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-SCH1", species: "Carabao", breed: "Native" });
    const hr = await HealthRequest.create({ farmerId, animalId, symptoms: "Test", status: "pending" });
    const { req, res } = reqRes({ status: "scheduled", visitPeriod: "morning" }, "technician", techId);
    req.params.id = hr._id;
    await updateHealthRequestStatus(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, "SCHEDULE_DATE_REQUIRED");
  });
  await t.test("missing period", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-SCH2", species: "Carabao", breed: "Native" });
    const hr = await HealthRequest.create({ farmerId, animalId, symptoms: "Test", status: "pending" });
    const { req, res } = reqRes({ status: "scheduled", scheduledDate: "2026-10-10" }, "technician", techId);
    req.params.id = hr._id;
    await updateHealthRequestStatus(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, "VISIT_PERIOD_REQUIRED");
  });
  await t.test("invalid period", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-SCH3", species: "Carabao", breed: "Native" });
    const hr = await HealthRequest.create({ farmerId, animalId, symptoms: "Test", status: "pending" });
    const { req, res } = reqRes({ status: "scheduled", scheduledDate: "2026-10-10", visitPeriod: "evening" }, "technician", techId);
    req.params.id = hr._id;
    await updateHealthRequestStatus(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, "INVALID_VISIT_PERIOD");
  });
  await t.test("valid Morning", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-SCH4", species: "Carabao", breed: "Native" });
    const hr = await HealthRequest.create({ farmerId, animalId, symptoms: "Test", status: "pending", dispatch: otonHealthDispatch });
    const { req, res } = reqRes({ status: "scheduled", scheduledDate: "2026-10-10", visitPeriod: "morning" }, "technician", techId);
    makeEligibleHealthTechnician(req);
    req.params.id = hr._id;
    await updateHealthRequestStatus(req, res);
    assert.equal(res.statusCode, 200);
    const updated = await HealthRequest.findById(hr._id);
    assert.equal(updated.visitPeriod, "morning");
    assert.equal(updated.scheduledDate.toISOString(), "2026-10-10T04:00:00.000Z");
    assert.equal(updated.handlingMethod, "farm_visit");
  });
  await t.test("valid Afternoon", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-SCH5", species: "Carabao", breed: "Native" });
    const hr = await HealthRequest.create({ farmerId, animalId, symptoms: "Test", status: "pending", dispatch: otonHealthDispatch });
    const { req, res } = reqRes({ status: "scheduled", scheduledDate: "2026-10-10", visitPeriod: "afternoon" }, "technician", techId);
    makeEligibleHealthTechnician(req);
    req.params.id = hr._id;
    await updateHealthRequestStatus(req, res);
    assert.equal(res.statusCode, 200);
    const updated = await HealthRequest.findById(hr._id);
    assert.equal(updated.visitPeriod, "afternoon");
  });
  await t.test("period-only reschedule", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-SCH6", species: "Carabao", breed: "Native" });
    const hr = await HealthRequest.create({ farmerId, animalId, symptoms: "Test", status: "scheduled", scheduledDate: "2026-10-10", visitPeriod: "morning", handledBy: techId });
    const { req, res } = reqRes({ status: "scheduled", scheduledDate: "2026-10-10", visitPeriod: "afternoon" }, "technician", techId);
    req.params.id = hr._id;
    await updateHealthRequestStatus(req, res);
    assert.equal(res.statusCode, 200);
    const updated = await HealthRequest.findById(hr._id);
    assert.equal(updated.handlingMethod, "farm_visit");
    assert.equal(hasVisitScheduleChanged(
      new Date("2026-10-10T04:00:00.000Z"), "afternoon",
      new Date("2026-10-10T04:00:00.000Z"), "morning"
    ), true);
  });
  await t.test("same-period concurrency permitted", async () => {
    const animalId2 = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId2, farmerId, animalId: "HL-SCH2", species: "Carabao", breed: "Native" });
    const hr2 = await HealthRequest.create({ farmerId, animalId: animalId2, symptoms: "Test 2", status: "pending", dispatch: otonHealthDispatch });
    const { req, res } = reqRes({ status: "scheduled", scheduledDate: "2026-10-10", visitPeriod: "morning" }, "technician", techId);
    makeEligibleHealthTechnician(req);
    req.params.id = hr2._id;
    await updateHealthRequestStatus(req, res);
    assert.equal(res.statusCode, 200);
  });
  await t.test("notification metadata privacy", async () => {
    const farmerId2 = new mongoose.Types.ObjectId();
    await User.create({ _id: farmerId2, role: "farmer", pushToken: "ExponentPushToken[123]", firstName: "Test", lastName: "Farmer", name: "Test Farmer", email: "test" + farmerId2.toString() + "@example.com", phone: "1234567890", clerkId: "clerk_" + farmerId2.toString(), address: { province: "P", city: "C", barangay: "San Juan" } });
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId: farmerId2, animalId: "HL-SCH7", species: "Carabao", breed: "Native" });
    const hr3 = await HealthRequest.create({ farmerId: farmerId2, animalId, symptoms: "Test", status: "scheduled", scheduledDate: "2026-10-10", visitPeriod: "morning", handledBy: techId });
    const { req, res } = reqRes({ 
      status: "scheduled", 
      scheduledDate: "2026-10-11", 
      visitPeriod: "morning", 
      diagnosis: "Secret",
      findings: "Secret",
      treatment: "Secret",
      medicineGiven: "Secret",
      dosage: "Secret",
      advice: "Secret"
    }, "technician", techId);
    req.params.id = hr3._id;
    await updateHealthRequestStatus(req, res);
    
    const notif = await Notification.findOne({ "metadata.requestId": hr3._id }).sort({ createdAt: -1 });
    assert.ok(notif, "Notification should be created");
    assert.equal(notif.metadata.visitPeriod, "morning");
    assert.equal(notif.metadata.diagnosis, undefined);
    assert.equal(notif.metadata.findings, undefined);
    assert.equal(notif.metadata.treatment, undefined);
    assert.equal(notif.metadata.medicineGiven, undefined);
    assert.equal(notif.metadata.dosage, undefined);
    assert.equal(notif.metadata.advice, undefined);
    assert.ok(notif.message.toLowerCase().includes("reschedule") || notif.title.toLowerCase().includes("reschedule"));
  });
});

test("HEALTH START", async (t) => {
  const farmerId = new mongoose.Types.ObjectId();
  const techId = new mongoose.Types.ObjectId();
  const techId2 = new mongoose.Types.ObjectId();

  await t.test("unscheduled blocked", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-ST1", species: "Carabao", breed: "Native" });
    const reqUnscheduled = await HealthRequest.create({ farmerId, animalId, symptoms: "s", status: "pending" });
    const { req, res } = reqRes({ status: "in-progress" }, "technician", techId);
    req.params.id = reqUnscheduled._id;
    await updateHealthRequestStatus(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, "VISIT_NOT_SCHEDULED");
  });
  await t.test("scheduled allowed", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-ST2", species: "Carabao", breed: "Native" });
    const reqScheduled = await HealthRequest.create({ farmerId, animalId, symptoms: "s", status: "scheduled", handledBy: techId, scheduledDate: new Date(), visitPeriod: "morning", handlingMethod: "farm_visit" });
    const { req, res } = reqRes({ status: "in-progress" }, "technician", techId);
    req.params.id = reqScheduled._id;
    await updateHealthRequestStatus(req, res);
    assert.equal(res.statusCode, 200);
    const updated = await HealthRequest.findById(reqScheduled._id);
    assert.equal(updated.handlingMethod, "farm_visit");
  });
  await t.test("legacy schedule without period allowed", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-ST3", species: "Carabao", breed: "Native" });
    const reqLegacy = await HealthRequest.create({ farmerId, animalId, symptoms: "s", status: "scheduled", handledBy: techId, scheduledDate: new Date() });
    const { req, res } = reqRes({ status: "in-progress" }, "technician", techId);
    req.params.id = reqLegacy._id;
    await updateHealthRequestStatus(req, res);
    assert.equal(res.statusCode, 200);
  });
  await t.test("preferredDate-only blocked", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-ST4", species: "Carabao", breed: "Native" });
    const reqPref = await HealthRequest.create({ farmerId, animalId, symptoms: "s", status: "pending", preferredDate: new Date() });
    const { req, res } = reqRes({ status: "in-progress" }, "technician", techId);
    req.params.id = reqPref._id;
    await updateHealthRequestStatus(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, "VISIT_NOT_SCHEDULED");
  });
  await t.test("serviceStartedAt set once", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-ST5", species: "Carabao", breed: "Native" });
    const reqScheduled = await HealthRequest.create({ farmerId, animalId, symptoms: "s", status: "scheduled", handledBy: techId, scheduledDate: new Date(), visitPeriod: "morning" });
    const { req, res } = reqRes({ status: "in-progress" }, "technician", techId);
    req.params.id = reqScheduled._id;
    await updateHealthRequestStatus(req, res);
    const updated = await HealthRequest.findById(reqScheduled._id);
    assert.ok(updated.serviceStartedAt);
  });
  await t.test("retry preserves start time", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-ST6", species: "Carabao", breed: "Native" });
    const reqScheduled = await HealthRequest.create({ farmerId, animalId, symptoms: "s", status: "scheduled", handledBy: techId, scheduledDate: new Date(), visitPeriod: "morning" });
    // First transition
    const { req, res } = reqRes({ status: "in-progress" }, "technician", techId);
    req.params.id = reqScheduled._id;
    await updateHealthRequestStatus(req, res);
    
    const initialStart = (await HealthRequest.findById(reqScheduled._id)).serviceStartedAt;
    
    // Second transition
    const { req: req2, res: res2 } = reqRes({ status: "in-progress" }, "technician", techId);
    req2.params.id = reqScheduled._id;
    await updateHealthRequestStatus(req2, res2);
    
    const retryStart = (await HealthRequest.findById(reqScheduled._id)).serviceStartedAt;
    assert.equal(initialStart.getTime(), retryStart.getTime());
  });
  await t.test("ownership protection", async () => {
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-ST7", species: "Carabao", breed: "Native" });
    const reqOwned = await HealthRequest.create({ farmerId, animalId, symptoms: "s", status: "scheduled", handledBy: techId, scheduledDate: new Date() });
    const { req, res } = reqRes({ status: "in-progress" }, "technician", techId2);
    req.params.id = reqOwned._id;
    await updateHealthRequestStatus(req, res);
    assert.equal(res.statusCode, 403);
  });
  await t.test("Admin behavior preserved", async () => {
    const adminId = new mongoose.Types.ObjectId();
    const animalId = new mongoose.Types.ObjectId();
    await Animal.create({ _id: animalId, farmerId, animalId: "HL-ST8", species: "Carabao", breed: "Native" });
    const reqOwned = await HealthRequest.create({ farmerId, animalId, symptoms: "s", status: "scheduled", handledBy: techId, scheduledDate: new Date() });
    const { req, res } = reqRes({ status: "in-progress" }, "admin", adminId);
    req.params.id = reqOwned._id;
    await updateHealthRequestStatus(req, res);
    assert.equal(res.statusCode, 200);
  });
});
