import test from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import { updateHealthRequestStatus } from "../src/controllers/health-request.controllers.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { MedicalRecord } from "../src/models/medical-record.model.js";
import { Task } from "../src/models/task.model.js";

test.before(async () => {
  let baseUri = process.env.MONGODB_TEST_URI || "mongodb://127.0.0.1:27017";
  const urlObj = new URL(baseUri);
  if (urlObj.hostname !== "127.0.0.1" && urlObj.hostname !== "localhost" && !urlObj.hostname.includes("test")) {
    throw new Error("Unsafe MongoDB URI detected. Refusing to connect to non-local/non-test database.");
  }
  const uniqueDbName = `test_h4_health_workspace_${process.pid}_${Date.now()}_${Math.floor(Math.random()*1000)}`;
  urlObj.pathname = `/${uniqueDbName}`;
  await mongoose.connect(urlObj.toString());

  const originalStartSession = mongoose.startSession.bind(mongoose);
  mongoose.startSession = async (options) => {
    const session = await originalStartSession(options);
    session.withTransaction = async (work) => await work(session);
    return session;
  };
});

test.after(async () => {
  if (mongoose.connection.readyState !== 0) {
    const db = mongoose.connection.db;
    if (db) await db.dropDatabase();
    await mongoose.disconnect();
  }
});

test.afterEach(async () => {
  await HealthRequest.deleteMany({});
  await MedicalRecord.deleteMany({});
  await Task.deleteMany({});
});

test("H4 - Technician Health Workspace / Health Log controller tests", async (t) => {
  const mockTechId = new mongoose.Types.ObjectId();
  const req = {
    params: {},
    body: {},
    user: { _id: mockTechId, role: "technician" },
    app: {
      get: () => ({
        emit: () => {},
      }),
    },
  };
  const res = {
    status: function (s) { this.statusCode = s; return this; },
    json: function (d) { this.data = d; return this; }
  };

  await t.test("1. serviceStartedAt is write-once", async () => {
    const hr = await HealthRequest.create({
      farmerId: new mongoose.Types.ObjectId(),
      animalId: new mongoose.Types.ObjectId(),
      requestType: "medicine",
      symptoms: "Test",
      urgency: "high",
      status: "scheduled",
      handledBy: mockTechId,
      scheduledDate: new Date(),
      visitPeriod: "Morning"
    });

    req.params.id = hr._id.toString();
    req.body = { status: "in-progress" };
    
    await updateHealthRequestStatus(req, res);
    assert.strictEqual(res.statusCode, 200, res.data?.message);
    const afterFirst = await HealthRequest.findById(hr._id);
    assert.ok(afterFirst.serviceStartedAt);
    const firstDate = afterFirst.serviceStartedAt.getTime();

    // simulate delay or rewrite
    req.body = { status: "in-progress", technicianNote: "Retrying..." };
    await updateHealthRequestStatus(req, res);
    assert.strictEqual(res.statusCode, 200);
    const afterSecond = await HealthRequest.findById(hr._id);
    assert.strictEqual(afterSecond.serviceStartedAt.getTime(), firstDate, "serviceStartedAt should be immutable after set");
  });

  await t.test("2. Clinical Field Persistence and resolvedAt", async () => {
    const hr = await HealthRequest.create({
      farmerId: new mongoose.Types.ObjectId(),
      animalId: new mongoose.Types.ObjectId(),
      requestType: "disease",
      symptoms: "Test",
      urgency: "medium",
      status: "in-progress",
      handledBy: mockTechId,
      scheduledDate: new Date(),
      visitPeriod: "Afternoon",
      serviceStartedAt: new Date()
    });

    req.params.id = hr._id.toString();
    req.body = {
      status: "resolved",
      findings: "Fever and lethargy",
      diagnosis: "Viral infection",
      treatment: "Antiviral injection",
      medicineGiven: "ViroStop",
      dosage: "10ml",
      advice: "Rest and monitor",
      resolutionNotes: "All good",
      withdrawalPeriodDays: 14,
      followUpDate: new Date(Date.now() + 86400000).toISOString()
    };

    await updateHealthRequestStatus(req, res);
    assert.strictEqual(res.statusCode, 200, res.data?.message);

    const resolved = await HealthRequest.findById(hr._id);
    assert.strictEqual(resolved.status, "resolved");
    assert.ok(resolved.resolvedAt, "resolvedAt must be present");
    assert.strictEqual(resolved.findings, "Fever and lethargy");
    assert.strictEqual(resolved.diagnosis, "Viral infection");
    assert.strictEqual(resolved.treatment, "Antiviral injection");
    assert.strictEqual(resolved.medicineGiven, "ViroStop");
    assert.strictEqual(resolved.dosage, "10ml");
    assert.strictEqual(resolved.advice, "Rest and monitor");
    assert.strictEqual(resolved.resolutionNotes, "All good");
    assert.strictEqual(resolved.withdrawalPeriodDays, 14);
    assert.ok(resolved.followUpDate);
    assert.ok(!resolved.activeCaseKey, "activeCaseKey must be removed on resolution");
  });

  await t.test("3. MedicalRecord Mapping and Idempotency", async () => {
    const animalId = new mongoose.Types.ObjectId();
    const farmerId = new mongoose.Types.ObjectId();
    const hr = await HealthRequest.create({
      farmerId,
      animalId,
      requestType: "vaccination",
      symptoms: "Test",
      urgency: "low",
      status: "in-progress",
      handledBy: mockTechId,
      serviceStartedAt: new Date(),
      scheduledDate: new Date(),
      visitPeriod: "Morning"
    });

    const task = await Task.create({
      taskType: "Health",
      status: "In Progress",
      technicianId: mockTechId,
      farmerId,
      animalIds: [animalId],
      notes: "Test",
      category: "Routine"
    });

    req.params.id = hr._id.toString();
    req.body = {
      status: "resolved",
      taskId: task._id.toString(),
      diagnosis: "Healthy",
      treatment: "Vaccine shot",
      medicineGiven: "Rabies Vac",
      dosage: "2ml",
      withdrawalPeriodDays: 5
    };

    // First completion
    await updateHealthRequestStatus(req, res);
    assert.strictEqual(res.statusCode, 200);

    const records = await MedicalRecord.find({ healthRequestId: hr._id });
    assert.strictEqual(records.length, 1);
    
    const rec = records[0];
    assert.strictEqual(rec.details.medicineName, "Rabies Vac");
    assert.strictEqual(rec.details.dosage, "2ml");
    assert.strictEqual(rec.details.diagnosis, "Healthy");
    assert.strictEqual(rec.details.treatment, "Vaccine shot");
    assert.strictEqual(rec.details.withdrawalPeriodDays, 5);
    assert.ok(rec.details.withdrawalEndDate);

    const hrAfter = await HealthRequest.findById(hr._id);
    assert.strictEqual(hrAfter.status, "resolved");

    const taskAfter = await Task.findById(task._id);
    assert.strictEqual(taskAfter.status, "Completed");
    assert.ok(taskAfter.completedAt);
    assert.strictEqual(taskAfter.relatedRecordType, "health");
    assert.strictEqual(String(taskAfter.relatedRecordId), String(hr._id));
    assert.strictEqual(String(taskAfter.metadata?.requestId), String(hr._id));

    // Double completion (Retry idempotency)
    req.body.dosage = "5ml"; // Should not override existing MedicalRecord
    await updateHealthRequestStatus(req, res);
    const records2 = await MedicalRecord.find({ healthRequestId: hr._id });
    assert.strictEqual(records2.length, 1, "Must not create duplicate MedicalRecord");
    assert.strictEqual(records2[0].details.dosage, "2ml", "Must not update existing idempotent record");
  });

  await t.test("4. Transaction Mismatch: Wrong Technician task", async () => {
    const animalId = new mongoose.Types.ObjectId();
    const farmerId = new mongoose.Types.ObjectId();
    const otherTechId = new mongoose.Types.ObjectId();
    const hr = await HealthRequest.create({ farmerId, animalId, requestType: "disease", symptoms: "Test", urgency: "medium", status: "in-progress", handledBy: mockTechId, serviceStartedAt: new Date(), scheduledDate: new Date(), visitPeriod: "Afternoon" });
    const task = await Task.create({ taskType: "Health", status: "In Progress", technicianId: otherTechId, farmerId, animalIds: [animalId], notes: "Test", category: "Routine" });
    
    req.params.id = hr._id.toString();
    req.body = { status: "resolved", taskId: task._id.toString(), diagnosis: "Test", treatment: "Test" };
    
    await updateHealthRequestStatus(req, res);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.data.code, "TASK_ASSIGNMENT_MISMATCH");
    
    const hrAfter = await HealthRequest.findById(hr._id);
    assert.strictEqual(hrAfter.status, "in-progress");
    const taskAfter = await Task.findById(task._id);
    assert.strictEqual(taskAfter.status, "In Progress");
    const mrCount = await MedicalRecord.countDocuments({ healthRequestId: hr._id });
    assert.strictEqual(mrCount, 0);
  });

  await t.test("5. Transaction Mismatch: Wrong Farmer task", async () => {
    const animalId = new mongoose.Types.ObjectId();
    const farmerId = new mongoose.Types.ObjectId();
    const otherFarmerId = new mongoose.Types.ObjectId();
    const hr = await HealthRequest.create({ farmerId, animalId, requestType: "disease", symptoms: "Test", urgency: "medium", status: "in-progress", handledBy: mockTechId, serviceStartedAt: new Date(), scheduledDate: new Date(), visitPeriod: "Afternoon" });
    const task = await Task.create({ taskType: "Health", status: "In Progress", technicianId: mockTechId, farmerId: otherFarmerId, animalIds: [animalId], notes: "Test", category: "Routine" });
    
    req.params.id = hr._id.toString();
    req.body = { status: "resolved", taskId: task._id.toString(), diagnosis: "Test", treatment: "Test" };
    
    await updateHealthRequestStatus(req, res);
    assert.strictEqual(res.statusCode, 409);
    assert.strictEqual(res.data.code, "TASK_FARMER_MISMATCH");
    
    const mrCount = await MedicalRecord.countDocuments({ healthRequestId: hr._id });
    assert.strictEqual(mrCount, 0);
  });

  await t.test("6. Transaction Mismatch: Wrong Animal task", async () => {
    const animalId = new mongoose.Types.ObjectId();
    const otherAnimalId = new mongoose.Types.ObjectId();
    const farmerId = new mongoose.Types.ObjectId();
    const hr = await HealthRequest.create({ farmerId, animalId, requestType: "disease", symptoms: "Test", urgency: "medium", status: "in-progress", handledBy: mockTechId, serviceStartedAt: new Date(), scheduledDate: new Date(), visitPeriod: "Afternoon" });
    const task = await Task.create({ taskType: "Health", status: "In Progress", technicianId: mockTechId, farmerId, animalIds: [otherAnimalId], notes: "Test", category: "Routine" });
    
    req.params.id = hr._id.toString();
    req.body = { status: "resolved", taskId: task._id.toString(), diagnosis: "Test", treatment: "Test" };
    
    await updateHealthRequestStatus(req, res);
    assert.strictEqual(res.statusCode, 409);
    assert.strictEqual(res.data.code, "TASK_ANIMAL_MISMATCH");
    
    const mrCount = await MedicalRecord.countDocuments({ healthRequestId: hr._id });
    assert.strictEqual(mrCount, 0);
  });

  await t.test("7. Transaction Mismatch: Wrong Task type", async () => {
    const animalId = new mongoose.Types.ObjectId();
    const farmerId = new mongoose.Types.ObjectId();
    const hr = await HealthRequest.create({ farmerId, animalId, requestType: "disease", symptoms: "Test", urgency: "medium", status: "in-progress", handledBy: mockTechId, serviceStartedAt: new Date(), scheduledDate: new Date(), visitPeriod: "Afternoon" });
    const task = await Task.create({ taskType: "AI", status: "In Progress", technicianId: mockTechId, farmerId, animalIds: [animalId], notes: "Test", category: "Routine" });
    
    req.params.id = hr._id.toString();
    req.body = { status: "resolved", taskId: task._id.toString(), diagnosis: "Test", treatment: "Test" };
    
    await updateHealthRequestStatus(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.data.code, "INVALID_TASK_TYPE");
    
    const mrCount = await MedicalRecord.countDocuments({ healthRequestId: hr._id });
    assert.strictEqual(mrCount, 0);
  });
});
