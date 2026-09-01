import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { getTechnicianDashboardData } from "../src/controllers/technician.controllers.js";
import { Insemination } from "../src/models/insemination.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { Task } from "../src/models/task.model.js";
import { Animal } from "../src/models/animal.model.js";
import { User } from "../src/models/user.model.js";

describe("Technician Dashboard Regression Tests", () => {
  const otonDispatch = {
    location: {
      municipalityCode: "063034000",
      municipalityName: "Oton",
      localityType: "municipality",
    },
    stage: "local",
  };

  let techUser;
  let adminUser;
  let farmerUser;
  let animal1, animal2, animal3;

  before(async () => {
    const baseUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/test_db";
    const isolatedUri = baseUri.replace(/\/[^/?]+(\?|$)/, "/test_db_dashboard$1");
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(isolatedUri);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.db.dropDatabase();
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Animal.deleteMany({}),
      Insemination.deleteMany({}),
      HealthRequest.deleteMany({}),
      Task.deleteMany({})
    ]);

    techUser = new User({
      clerkId: "clerk1",
      role: "technician",
      status: "active",
      email: "tech@example.com",
      name: "Tech User",
      isVerified: true,
      profileClaimStatus: "claimed",
      dispatchProfile: {
        acceptsNewRequests: true,
        availabilityStatus: "available",
        serviceCapabilities: ["AI", "HEALTH"],
        serviceMunicipalities: [{ municipalityCode: "063034000" }],
      },
    });
    adminUser = new User({ clerkId: "clerk2", role: "admin", status: "active", email: "admin@example.com", name: "Admin User" });
    farmerUser = new User({ clerkId: "clerk3", role: "farmer", status: "active", email: "farmer@example.com", name: "Farmer Bob" });
    await Promise.all([techUser.save(), adminUser.save(), farmerUser.save()]);

    animal1 = new Animal({ animalId: "A1", farmerId: farmerUser._id, breed: "Crossbreed", species: "Cattle" });
    animal2 = new Animal({ animalId: "A2", farmerId: farmerUser._id, breed: "Crossbreed", species: "Cattle" });
    animal3 = new Animal({ animalId: "A3", farmerId: farmerUser._id, breed: "Crossbreed", species: "Cattle" });
    await Promise.all([animal1.save(), animal2.save(), animal3.save()]);
  });

  const mockReqRes = (user, query = {}) => {
    let response = { statusCode: null, body: null };
    const req = { user, query };
    const res = {
      status: (code) => {
        response.statusCode = code;
        return {
          json: (data) => {
            response.body = data;
          },
        };
      },
    };
    return { req, res, response };
  };

  it("Unassigned AI request candidate-safe sorting", async () => {
    const unassignedAI = new Insemination({
      farmerId: farmerUser._id,
      animalId: animal1._id,
      status: "pending",
      dispatch: otonDispatch,
      createdAt: new Date("2026-08-01T10:00:00Z"),
      inseminationType: "Artificial Insemination"
    });
    await unassignedAI.save();

    const { req, res, response } = mockReqRes(techUser);
    await getTechnicianDashboardData(req, res);

    assert.equal(response.statusCode, 200);
    assert.ok(response.body.pendingRequests);
    const pending = response.body.pendingRequests;
    assert.equal(pending.length, 1);
    
    const item = pending[0];
    assert.equal(item.type, "insemination");
    assert.equal(item.raw, undefined, "Candidate item must not have raw property");
    assert.equal(item.farmer, farmerUser.name, "Candidate item must contain correct farmer display name");
    assert.ok(item.createdAt, "Candidate item must have top-level createdAt");
    assert.equal(item.farmerName, undefined, "Candidate item must not expose farmerName alias");
    assert.equal(item.farmerPhone, undefined, "Candidate item must not expose phone");
    assert.equal(item.location, undefined, "Candidate item must not expose precise location");
  });

  it("Unassigned Health request candidate-safe sorting", async () => {
    const unassignedHealth = new HealthRequest({
      farmerId: farmerUser._id,
      animalId: animal1._id,
      status: "pending",
      dispatch: otonDispatch,
      createdAt: new Date("2026-08-02T10:00:00Z"),
      urgency: "medium",
      symptoms: "cough"
    });
    await unassignedHealth.save();

    const { req, res, response } = mockReqRes(techUser);
    await getTechnicianDashboardData(req, res);

    assert.equal(response.statusCode, 200);
    assert.ok(response.body.pendingRequests);
    const pending = response.body.pendingRequests;
    assert.equal(pending.length, 1);
    
    const item = pending[0];
    assert.equal(item.type, "health");
    assert.equal(item.raw, undefined, "Candidate item must not have raw property");
    assert.equal(item.farmer, farmerUser.name, "Candidate item must contain correct farmer display name");
    assert.ok(item.createdAt, "Candidate item must have top-level createdAt");
    assert.equal(item.farmerName, undefined, "Candidate item must not expose farmerName alias");
    assert.equal(item.farmerPhone, undefined, "Candidate item must not expose phone");
    assert.equal(item.location, undefined, "Candidate item must not expose precise location");
  });

  it("Mixed full and candidate items are sorted properly and safely", async () => {
    const unassignedAI = new Insemination({
      farmerId: farmerUser._id,
      animalId: animal1._id,
      status: "pending",
      dispatch: otonDispatch,
      createdAt: new Date("2026-08-01T10:00:00Z"),
      inseminationType: "Artificial Insemination"
    });
    await unassignedAI.save();

    const assignedHealth = new HealthRequest({
      farmerId: farmerUser._id,
      animalId: animal2._id,
      status: "pending",
      createdAt: new Date("2026-08-03T10:00:00Z"), // Newest
      handledBy: techUser._id,
      urgency: "medium",
      symptoms: "cough"
    });
    await assignedHealth.save();

    const unassignedHealth = new HealthRequest({
      farmerId: farmerUser._id,
      animalId: animal3._id,
      status: "pending",
      dispatch: otonDispatch,
      createdAt: new Date("2026-08-02T10:00:00Z"), // Middle
      urgency: "low",
      symptoms: "fever"
    });
    await unassignedHealth.save();

    const { req, res, response } = mockReqRes(techUser);
    await getTechnicianDashboardData(req, res);

    assert.equal(response.statusCode, 200);
    assert.ok(response.body.pendingRequests);
    const pending = response.body.pendingRequests;
    assert.equal(pending.length, 2);
    
    // Sorted newest first
    assert.equal(pending[0].type, "health");
    assert.equal(pending[0].id.toString(), unassignedHealth._id.toString());
    assert.equal(pending[0].raw, undefined, "Unassigned item is candidate-safe");

    assert.equal(pending[1].type, "insemination");
    assert.equal(pending[1].id.toString(), unassignedAI._id.toString());
    assert.equal(pending[1].raw, undefined, "Unassigned item is candidate-safe");
    assert.ok(
      !pending.some((item) => item.id.toString() === assignedHealth._id.toString()),
      "Owned work belongs in My Work, not available Farmer Requests",
    );
  });

  it("Missing or malformed dates sort after valid-dated items without throwing", async () => {
    const validAI = new Insemination({
      farmerId: farmerUser._id,
      animalId: animal1._id,
      status: "pending",
      dispatch: otonDispatch,
      createdAt: new Date("2026-08-01T10:00:00Z"),
      inseminationType: "Artificial Insemination"
    });
    await validAI.save();

    // Mongoose adds createdAt automatically, so we'll unset it directly via mongo update
    const malformedAI = new Insemination({
      farmerId: farmerUser._id,
      animalId: animal2._id,
      status: "pending",
      dispatch: otonDispatch,
      inseminationType: "Artificial Insemination"
    });
    await malformedAI.save();
    await Insemination.updateOne(
      { _id: malformedAI._id },
      { $unset: { createdAt: 1, updatedAt: 1, preferredDate: 1 } },
      { timestamps: false, strict: false }
    );

    const { req, res, response } = mockReqRes(techUser);
    await getTechnicianDashboardData(req, res);

    assert.equal(response.statusCode, 200);
    assert.ok(response.body.pendingRequests);
    const pending = response.body.pendingRequests;
    assert.equal(pending.length, 2);
    
    // Valid AI is first because malformed receives sortable timestamp 0 (sorted last)
    assert.equal(pending[0].id.toString(), validAI._id.toString());
    assert.equal(pending[1].id.toString(), malformedAI._id.toString());
  });

  it("Claimed AI and Health work are excluded from available Farmer Requests", async () => {
    await Insemination.create({
      farmerId: farmerUser._id,
      animalId: animal2._id,
      status: "approved",
      approvedBy: techUser._id,
      dispatch: otonDispatch,
    });
    const assignedHealth = new HealthRequest({
      farmerId: farmerUser._id,
      animalId: animal1._id,
      status: "pending",
      createdAt: new Date(),
      handledBy: techUser._id,
      urgency: "medium",
      symptoms: "cough"
    });
    await assignedHealth.save();

    // Tech user request
    let { req, res, response } = mockReqRes(techUser);
    await getTechnicianDashboardData(req, res);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.pendingRequests.length, 0);

    // Admin user request
    ({ req, res, response } = mockReqRes(adminUser));
    await getTechnicianDashboardData(req, res);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.pendingRequests.length, 0);
  });

  it("shows only eligible unclaimed AI and Health requests", async () => {
    const outsideDispatch = {
      location: {
        municipalityCode: "063022000",
        municipalityName: "Miagao",
        localityType: "municipality",
      },
      stage: "local",
    };
    const records = await Promise.all([
      Insemination.create({
        farmerId: farmerUser._id,
        animalId: animal1._id,
        status: "pending",
        dispatch: otonDispatch,
      }),
      Insemination.create({
        farmerId: farmerUser._id,
        animalId: animal2._id,
        status: "pending",
        dispatch: outsideDispatch,
      }),
      HealthRequest.create({
        farmerId: farmerUser._id,
        animalId: animal2._id,
        status: "pending",
        symptoms: "Eligible health request",
        dispatch: otonDispatch,
      }),
      HealthRequest.create({
        farmerId: farmerUser._id,
        animalId: animal3._id,
        status: "pending",
        symptoms: "Outside service area",
        dispatch: outsideDispatch,
      }),
    ]);

    const { req, res, response } = mockReqRes(techUser);
    await getTechnicianDashboardData(req, res);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(
      response.body.pendingRequests.map((item) => item.id.toString()).sort(),
      [records[0]._id.toString(), records[2]._id.toString()].sort(),
    );
    assert.equal(response.body.stats.pendingHealth, 1);
  });

  it("counts only explicit visible urgent Health reports as Urgent Health", async () => {
    await Promise.all([
      HealthRequest.create({
        farmerId: farmerUser._id,
        animalId: animal1._id,
        status: "pending",
        symptoms: "Urgent Farmer report",
        urgency: "high",
        dispatch: otonDispatch,
      }),
      Task.create({
        technicianId: techUser._id,
        farmerId: farmerUser._id,
        animalIds: [animal2._id],
        taskType: "PD",
        category: "Emergency",
        notes: "Overdue reproductive work",
        status: "Pending",
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      }),
    ]);

    const { req, res, response } = mockReqRes(techUser, { fullAgenda: "true" });
    await getTechnicianDashboardData(req, res);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.stats.urgentHealth, 1);
    assert.ok(
      response.body.agendaItems.some((item) => item.taskType === "PD"),
      "The overdue Pregnancy task remains visible as due work",
    );
  });

  it("counts canonical AI, Health, and standalone Task completions for this Technician today", async () => {
    const otherTechnician = await User.create({
      clerkId: "clerk-other-tech",
      role: "technician",
      status: "active",
      email: "other-tech@example.com",
      name: "Other Technician",
      isVerified: true,
      profileClaimStatus: "claimed",
    });
    const now = new Date();

    await Promise.all([
      Insemination.create({
        farmerId: farmerUser._id,
        animalId: animal1._id,
        status: "done",
        technicianId: techUser._id,
        approvedBy: techUser._id,
      }),
      HealthRequest.create({
        farmerId: farmerUser._id,
        animalId: animal2._id,
        status: "resolved",
        symptoms: "Resolved today",
        handledBy: techUser._id,
        resolvedAt: now,
      }),
      Task.create({
        technicianId: techUser._id,
        farmerId: farmerUser._id,
        animalIds: [animal3._id],
        taskType: "PD",
        category: "Routine",
        notes: "Pregnancy work completed",
        status: "Completed",
        completedAt: now,
      }),
      Task.create({
        technicianId: techUser._id,
        farmerId: farmerUser._id,
        animalIds: [animal3._id],
        taskType: "Health",
        category: "Routine",
        notes: "Execution task mirrors a Health request",
        status: "Completed",
        completedAt: now,
        relatedRecordType: "health",
      }),
      Task.create({
        technicianId: otherTechnician._id,
        farmerId: farmerUser._id,
        animalIds: [animal3._id],
        taskType: "CD",
        category: "Routine",
        notes: "Another Technician completed this",
        status: "Completed",
        completedAt: now,
      }),
    ]);

    const { req, res, response } = mockReqRes(techUser);
    await getTechnicianDashboardData(req, res);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.stats.completedToday, 3);
  });
});
