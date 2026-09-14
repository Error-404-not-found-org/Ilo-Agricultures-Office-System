import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { getMonthlyAccomplishmentReport } from "../src/controllers/report.controllers.js";
import { Animal } from "../src/models/animal.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { User } from "../src/models/user.model.js";

let farmer;
let technician;
let animal;

before(async () => {
  const baseUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/test_db";
  const isolatedUri = baseUri.replace(/\/[^/?]+(\?|$)/, "/test_db_monthly_ai_report$1");
  if (mongoose.connection.readyState === 0) await mongoose.connect(isolatedUri);
});

after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  }
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Animal.deleteMany({}), Insemination.deleteMany({})]);
  farmer = await User.create({ role: "farmer", name: "Report Farmer", status: "active" });
  technician = await User.create({ role: "technician", name: "Report Technician", status: "active" });
  animal = await Animal.create({ animalId: "REPORT-1", farmerId: farmer._id, breed: "Brahman", species: "Cattle" });
});

const invokeReport = async (month, year) => {
  let statusCode;
  let body;
  await getMonthlyAccomplishmentReport(
    { query: { month: String(month), year: String(year) } },
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(value) {
        body = value;
      },
    },
  );
  return { statusCode, body };
};

test("historical AI is reported only in its Manila service month", async () => {
  const record = await Insemination.create({
    farmerId: farmer._id,
    animalId: animal._id,
    technicianId: technician._id,
    approvedBy: technician._id,
    status: "done",
    entryMode: "history_only",
    inseminationDate: new Date("2026-01-02T01:00:00.000Z"),
    completedAt: new Date("2026-01-02T01:00:00.000Z"),
  });
  await Insemination.collection.updateOne(
    { _id: record._id },
    { $set: { createdAt: new Date("2026-09-14T01:00:00.000Z"), updatedAt: new Date("2026-09-14T01:00:00.000Z") } },
  );

  const january = await invokeReport(1, 2026);
  const september = await invokeReport(9, 2026);

  assert.equal(january.statusCode, 200);
  assert.equal(january.body.length, 1);
  assert.equal(september.statusCode, 200);
  assert.equal(september.body.length, 0);
});

test("legacy completed AI without inseminationDate remains reportable by entry month", async () => {
  const record = await Insemination.create({
    farmerId: farmer._id,
    animalId: animal._id,
    technicianId: technician._id,
    approvedBy: technician._id,
    status: "done",
  });
  await Insemination.collection.updateOne(
    { _id: record._id },
    { $set: { createdAt: new Date("2026-09-14T01:00:00.000Z"), updatedAt: new Date("2026-09-14T01:00:00.000Z") } },
  );

  const september = await invokeReport(9, 2026);
  assert.equal(september.statusCode, 200);
  assert.equal(september.body.length, 1);
});
