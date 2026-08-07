import test from "node:test";
import assert from "node:assert/strict";
import { Insemination } from "../src/models/insemination.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Calving } from "../src/models/calving.model.js";
import { MedicalRecord } from "../src/models/medical-record.model.js";
import { getOfficialRecords } from "../src/controllers/animal-workflow.controllers.js";

const queryResult = (data) => ({
  populate() {
    return this;
  },
  lean: async () => data,
});

const responseRecorder = () => {
  let statusCode = 200;
  let body = null;
  return {
    response: {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    },
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
  };
};

test("Official records: farmer scope overrides a supplied farmer id", async () => {
  const originals = {
    insemination: Insemination.find,
    pregnancy: Pregnancy.find,
    calving: Calving.find,
    medical: MedicalRecord.find,
  };
  let inseminationQuery = null;
  const animal = {
    _id: "animal-1",
    animalId: "CAT-001",
    earTag: "TAG-001",
    breed: "Brahman",
    species: "Cattle",
  };
  const farmer = { _id: "farmer-1", name: "Farmer One" };

  Insemination.find = (query) => {
    inseminationQuery = query;
    return queryResult([
      {
        _id: "ai-1",
        farmerId: farmer,
        animalId: animal,
        status: "done",
        attemptNumber: 1,
        inseminationDate: new Date("2026-07-10T00:00:00.000Z"),
        createdAt: new Date("2026-07-10T00:00:00.000Z"),
      },
    ]);
  };
  Pregnancy.find = () => queryResult([]);
  Calving.find = () => queryResult([]);
  MedicalRecord.find = () => queryResult([
    {
      _id: "note-1",
      farmerId: farmer,
      animalId: animal,
      technicianId: { _id: "tech-1", name: "Tech One" },
      type: "General Note",
      note: "Monitor appetite",
      date: new Date("2026-07-11T00:00:00.000Z"),
      createdAt: new Date("2026-07-11T00:00:00.000Z"),
    },
  ]);

  const recorder = responseRecorder();
  try {
    await getOfficialRecords(
      {
        user: { _id: "farmer-1", role: "farmer" },
        query: { farmerId: "farmer-2", page: "1", limit: "25" },
      },
      recorder.response,
    );

    assert.equal(recorder.statusCode, 200);
    assert.equal(inseminationQuery.farmerId, "farmer-1");
    assert.equal(inseminationQuery.status, "done");
    assert.equal(recorder.body.total, 2);
    assert.equal(recorder.body.data[0].category, "General Note");
    assert.equal(recorder.body.data[1].category, "AI");
  } finally {
    Insemination.find = originals.insemination;
    Pregnancy.find = originals.pregnancy;
    Calving.find = originals.calving;
    MedicalRecord.find = originals.medical;
  }
});

test("Official records: request-linked Health outcome stays one MedicalRecord with safe request context", async () => {
  const originals = {
    insemination: Insemination.find,
    pregnancy: Pregnancy.find,
    calving: Calving.find,
    medical: MedicalRecord.find,
  };
  const populateCalls = [];
  const linkedHealthRequest = {
    _id: "health-request-1",
    requestType: "disease",
    symptoms: "Loss of appetite and weakness",
    urgency: "medium",
    farmerNotes: "Stopped eating yesterday",
    advice: "Provide clean water",
    followUpDate: new Date("2026-08-12T04:00:00.000Z"),
    resolutionNotes: "Monitor for 48 hours",
  };
  const medicalRecord = {
    _id: "medical-record-1",
    farmerId: { _id: "farmer-1", name: "Farmer One" },
    animalId: { _id: "animal-1", earTag: "TAG-001" },
    technicianId: { _id: "tech-1", name: "Juan Dela Cruz" },
    healthRequestId: linkedHealthRequest,
    type: "Treatment",
    date: new Date("2026-08-08T04:00:00.000Z"),
    details: {
      diagnosis: "Bacterial infection",
      treatment: "Antibiotic treatment",
      medicineName: "Oxytetracycline",
      dosage: "10 mL",
    },
  };

  Insemination.find = () => queryResult([]);
  Pregnancy.find = () => queryResult([]);
  Calving.find = () => queryResult([]);
  MedicalRecord.find = () => ({
    populate(path, selection) {
      populateCalls.push({ path, selection });
      return this;
    },
    lean: async () => [medicalRecord],
  });

  const recorder = responseRecorder();
  try {
    await getOfficialRecords(
      {
        user: { _id: "farmer-1", role: "farmer" },
        query: { type: "health", page: "1", limit: "25" },
      },
      recorder.response,
    );

    assert.equal(recorder.statusCode, 200);
    assert.equal(recorder.body.total, 1);
    assert.equal(recorder.body.data.length, 1);
    assert.equal(recorder.body.data[0].recordKind, "medical_record");
    assert.equal(
      recorder.body.data[0].source.healthRequestId.symptoms,
      "Loss of appetite and weakness",
    );
    assert.equal(
      recorder.body.data[0].source.details.medicineName,
      "Oxytetracycline",
    );

    const healthRequestPopulate = populateCalls.find(
      (call) => call.path === "healthRequestId",
    );
    assert.ok(healthRequestPopulate);
    assert.match(healthRequestPopulate.selection, /requestType/);
    assert.match(healthRequestPopulate.selection, /symptoms/);
    assert.match(healthRequestPopulate.selection, /urgency/);
    assert.match(healthRequestPopulate.selection, /farmerNotes/);
    assert.match(healthRequestPopulate.selection, /advice/);
    assert.doesNotMatch(
      healthRequestPopulate.selection,
      /phone|address|location|coordinate|direction/i,
    );
  } finally {
    Insemination.find = originals.insemination;
    Pregnancy.find = originals.pregnancy;
    Calving.find = originals.calving;
    MedicalRecord.find = originals.medical;
  }
});

test("Official records: invalid date range is rejected", async () => {
  const recorder = responseRecorder();
  await getOfficialRecords(
    {
      user: { _id: "tech-1", role: "technician" },
      query: { fromDate: "2026-08-01", toDate: "2026-07-01" },
    },
    recorder.response,
  );
  assert.equal(recorder.statusCode, 400);
  assert.equal(recorder.body.code, "RECORD_DATE_RANGE_INVALID");
});
