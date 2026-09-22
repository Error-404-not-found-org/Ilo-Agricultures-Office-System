import test from "node:test";
import assert from "node:assert/strict";
import { Insemination } from "../src/models/insemination.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Calving } from "../src/models/calving.model.js";
import { MedicalRecord } from "../src/models/medical-record.model.js";
import { exportOfficialRecordsCsv } from "../src/controllers/animal-workflow.controllers.js";

const queryResult = (data) => ({
  sort() {
    return this;
  },
  limit() {
    return this;
  },
  populate() {
    return this;
  },
  lean: async () => data,
});

const responseRecorder = () => {
  let statusCode = 200;
  let body = null;
  const headers = {};
  return {
    response: {
      status(code) {
        statusCode = code;
        return this;
      },
      setHeader(name, value) {
        headers[name] = value;
        return this;
      },
      set(name, value) {
        headers[name] = value;
        return this;
      },
      send(payload) {
        body = payload;
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
    headers,
  };
};

const farmer = { _id: "farmer-1", name: "Farmer One" };
const animal = {
  _id: "animal-1",
  animalId: "AN-001",
  earTag: "TAG-001",
  species: "Cattle",
  breed: "Native",
};
const technician = { _id: "tech-a", name: "Tech A", role: "technician" };

const originals = {
  insemination: Insemination.find,
  pregnancy: Pregnancy.find,
  calving: Calving.find,
  medical: MedicalRecord.find,
};

const restoreModels = () => {
  Insemination.find = originals.insemination;
  Pregnancy.find = originals.pregnancy;
  Calving.find = originals.calving;
  MedicalRecord.find = originals.medical;
};

test("official records CSV uses canonical dates, technician ownership, and ignores pagination", async () => {
  let capturedFilters = {};
  Insemination.find = (filter) => {
    capturedFilters.ai = filter;
    return queryResult([
      {
        _id: "ai-1",
        status: "done",
        technicianId: technician,
        farmerId: farmer,
        animalId: animal,
        inseminationDate: new Date("2026-09-05T00:00:00.000Z"),
        createdAt: new Date("2026-09-22T00:00:00.000Z"),
        attemptNumber: 1,
        sireBreed: "Native",
        sireCode: "S-1",
      },
    ]);
  };
  Pregnancy.find = (filter) => {
    capturedFilters.pregnancy = filter;
    return queryResult([]);
  };
  Calving.find = (filter) => {
    capturedFilters.calving = filter;
    return queryResult([]);
  };
  MedicalRecord.find = (filter) => {
    capturedFilters.health = filter;
    return queryResult([]);
  };

  const recorder = responseRecorder();
  try {
    await exportOfficialRecordsCsv(
      {
        user: technician,
        query: {
          type: "insemination",
          fromDate: "2026-09-01",
          toDate: "2026-09-30",
          page: "99",
          limit: "1",
          technicianId: "tech-b",
        },
      },
      recorder.response,
    );

    assert.equal(recorder.statusCode, 200);
    assert.match(recorder.headers["Content-Type"], /text\/csv/);
    assert.match(recorder.headers["Content-Disposition"], /2026-09/);
    assert.match(recorder.body, /"Record Type","Service Date","Farmer","Animal","Ear Tag","Species","Breed","Technician"/);
    assert.match(recorder.body, /Insemination/);
    assert.match(recorder.body, /2026-09-05/);
    assert.doesNotMatch(recorder.body, /2026-09-22/);
    assert.match(capturedFilters.ai.$and?.map((entry) => JSON.stringify(entry)).join(" "), /tech-a/);
    assert.ok(capturedFilters.ai.inseminationDate.$gte instanceof Date);
    assert.ok(capturedFilters.ai.inseminationDate.$lte instanceof Date);
    assert.equal(capturedFilters.ai.inseminationDate.$gte.toISOString(), "2026-08-31T16:00:00.000Z");
    assert.equal(capturedFilters.ai.inseminationDate.$lte.toISOString(), "2026-09-30T15:59:59.999Z");
    assert.equal(capturedFilters.ai.updatedAt, undefined);
  } finally {
    restoreModels();
  }
});

test("all official records CSV contains mixed services without private health notes", async () => {
  Insemination.find = () =>
    queryResult([
      {
        _id: "ai-1",
        status: "done",
        technicianId: technician,
        farmerId: farmer,
        animalId: animal,
        inseminationDate: new Date("2026-09-05T00:00:00.000Z"),
        outcome: "Pregnant",
      },
    ]);
  Pregnancy.find = () =>
    queryResult([
      {
        _id: "preg-1",
        pregnancyDiagnosis: { date: new Date("2026-09-06T00:00:00.000Z"), result: "Pregnant" },
        confirmation: { confirmedBy: technician, methodCode: "clinical_examination" },
        farmerId: farmer,
        animalId: animal,
      },
    ]);
  Calving.find = () =>
    queryResult([
      {
        _id: "calving-1",
        date: new Date("2026-09-07T00:00:00.000Z"),
        technicianId: technician,
        farmerId: farmer,
        animalId: animal,
        outcome: "live_birth",
      },
    ]);
  MedicalRecord.find = () =>
    queryResult([
      {
        _id: "health-1",
        date: new Date("2026-09-08T00:00:00.000Z"),
        type: "Treatment",
        technicianId: technician,
        farmerId: farmer,
        animalId: animal,
        details: { diagnosis: "Infection", treatment: "Antibiotic" },
        note: "PRIVATE INTERNAL NOTE",
        clerkId: "clerk-secret",
      },
      {
        _id: "health-private-only",
        date: new Date("2026-09-09T00:00:00.000Z"),
        type: "Treatment",
        technicianId: technician,
        farmerId: farmer,
        animalId: animal,
        note: "PRIVATE ONLY NOTE",
      },
    ]);

  const recorder = responseRecorder();
  try {
    await exportOfficialRecordsCsv(
      {
        user: technician,
        query: { fromDate: "2026-09-01", toDate: "2026-09-30" },
      },
      recorder.response,
    );

    assert.equal(recorder.body.split("\n").length, 6);
    assert.match(recorder.body, /Insemination/);
    assert.match(recorder.body, /Pregnancy/);
    assert.match(recorder.body, /Visual Assessment/);
    assert.doesNotMatch(recorder.body, /clinical_examination/);
    assert.match(recorder.body, /Calving/);
    assert.match(recorder.body, /Health/);
    assert.match(recorder.body, /Antibiotic/);
    assert.doesNotMatch(recorder.body, /PRIVATE INTERNAL NOTE|PRIVATE ONLY NOTE|clerk-secret|health-1/);
  } finally {
    restoreModels();
  }
});
