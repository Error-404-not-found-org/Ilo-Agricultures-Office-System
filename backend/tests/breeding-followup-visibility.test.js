import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { getWorkQueue } from "../src/controllers/technician.controllers.js";
import { Task } from "../src/models/task.model.js";
import { User } from "../src/models/user.model.js";

describe("Breeding Follow-up My Work Visibility", () => {
  before(async () => {
    const baseUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/test_db";
    const isolatedUri = baseUri.replace(/\/[^/?]+(\?|$)/, "/test_db_dashboard$1");
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(isolatedUri);
    }
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await Task.deleteMany({});
    await User.deleteMany({});
  });

  it("should enforce dueDate visibility rules on BreedingFollowUp and PD tasks", async () => {
    const technician = await User.create({
      name: "Test Tech",
      email: "tech@test.com",
      password: "password123",
      role: "technician",
    });

    const mockReq = {
      user: {
        _id: technician._id,
        role: "technician",
      },
      query: {
        limit: 100,
        full: "true",
      },
    };

    const mockRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
    };

    const now = new Date();
    const future = new Date(now.getTime() + 86400000 * 5); // +5 days
    const past = new Date(now.getTime() - 86400000 * 5); // -5 days

    const farmer = await User.create({
      name: "Test Farmer",
      email: "farmer@test.com",
      password: "password123",
      role: "farmer",
    });

    const baseTaskFields = {
      notes: "Test notes",
      category: "Routine",
      farmerId: farmer._id,
      technicianId: technician._id,
    };

    // 1. Future Pending BreedingFollowUp -> Hidden
    await Task.create({
      ...baseTaskFields,
      taskType: "BreedingFollowUp",
      status: "Pending",
      dueDate: future,
    });

    // 2. Due today Pending BreedingFollowUp -> Visible
    await Task.create({
      ...baseTaskFields,
      taskType: "BreedingFollowUp",
      status: "Pending",
      dueDate: now,
    });

    // 3. Overdue Pending BreedingFollowUp -> Visible
    await Task.create({
      ...baseTaskFields,
      taskType: "BreedingFollowUp",
      status: "Pending",
      dueDate: past,
    });

    // 4. Future In Progress BreedingFollowUp -> Visible
    await Task.create({
      ...baseTaskFields,
      taskType: "BreedingFollowUp",
      status: "In Progress",
      dueDate: future,
    });

    // 5. Completed BreedingFollowUp -> Not Active (Hidden)
    await Task.create({
      ...baseTaskFields,
      taskType: "BreedingFollowUp",
      status: "Completed",
      dueDate: past,
    });

    // 6. Cancelled BreedingFollowUp -> Hidden
    await Task.create({
      ...baseTaskFields,
      taskType: "BreedingFollowUp",
      status: "Cancelled",
      dueDate: past,
    });

    // 7. Missing dueDate Pending BreedingFollowUp -> Hidden
    await Task.create({
      ...baseTaskFields,
      taskType: "BreedingFollowUp",
      status: "Pending",
    });

    // 8. PD existing visibility rule - Future Pending -> Hidden
    await Task.create({
      ...baseTaskFields,
      taskType: "PD",
      status: "Pending",
      dueDate: future,
    });

    // 9. GeneralVisit (Other) Future Pending -> Visible (no dueDate limit)
    await Task.create({
      ...baseTaskFields,
      taskType: "GeneralVisit",
      status: "Pending",
      dueDate: future,
    });

    await getWorkQueue(mockReq, mockRes);

    const agendaItems = mockRes.body.data || [];

    const visibleTypesAndStatus = agendaItems.map((t) => ({
      taskType: t.taskType,
      status: t.status,
      isFuture: new Date(t.displayDate || t.dueDate) > now,
      hasDueDate: !!(t.displayDate || t.dueDate),
    }));

    // Should contain:
    // - Due today Pending BreedingFollowUp (not future)
    // - Overdue Pending BreedingFollowUp (not future)
    // - Future In Progress BreedingFollowUp
    // - GeneralVisit Future Pending

    const visibleBreedingFollowUps = visibleTypesAndStatus.filter(
      (t) => t.taskType === "BreedingFollowUp"
    );

    assert.strictEqual(
      visibleBreedingFollowUps.length,
      3,
      "Should only see 3 BreedingFollowUp tasks"
    );

    // Assert that the hidden ones are NOT here
    assert.ok(
      !visibleBreedingFollowUps.some(
        (t) => t.status === "Pending" && t.isFuture && t.hasDueDate
      ),
      "Future pending BreedingFollowUp should be hidden"
    );

    assert.ok(
      !visibleBreedingFollowUps.some(
        (t) => t.status === "Pending" && !t.hasDueDate
      ),
      "Missing dueDate pending BreedingFollowUp should be hidden"
    );

    assert.ok(
      !visibleBreedingFollowUps.some((t) => t.status === "Completed"),
      "Completed BreedingFollowUp should be hidden"
    );

    assert.ok(
      !visibleBreedingFollowUps.some((t) => t.status === "Cancelled"),
      "Cancelled BreedingFollowUp should be hidden"
    );

    // Assert PD future pending is hidden
    const visiblePDs = visibleTypesAndStatus.filter((t) => t.taskType === "PD");
    assert.strictEqual(visiblePDs.length, 0, "Future pending PD should be hidden");

    // Assert GeneralVisit future pending is visible
    const visibleGenerals = visibleTypesAndStatus.filter(
      (t) => t.taskType === "GeneralVisit"
    );
    assert.strictEqual(visibleGenerals.length, 1, "Future pending GeneralVisit should be visible");
  });
});
