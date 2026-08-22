import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import mongoose from "mongoose";
import { Insemination } from "../src/models/insemination.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Calving } from "../src/models/calving.model.js";
import { MedicalRecord } from "../src/models/medical-record.model.js";
import { Animal } from "../src/models/animal.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import {
  getAnimalHealthHistory,
  getAnimalRecords,
  getOfficialRecordDetail,
  getOfficialRecords,
} from "../src/controllers/animal-workflow.controllers.js";

const queryResult = (data) => ({
  sort() {
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

test("AI follow-up mutations do not replace the completion timestamp", () => {
  const controller = readFileSync(
    new URL("../src/controllers/ai-request.controllers.js", import.meta.url),
    "utf8",
  );
  const start = controller.indexOf("export const submitFarmerBreedingObservation");
  const end = controller.indexOf("// DELETE /api/ai-request/:id", start);
  const handler = controller.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(handler, /request\.completedAt\s*=/);
  assert.match(handler, /request\.farmerOutcomeReportedAt\s*=/);
  assert.match(handler, /request\.save\(\)/);
});

test("animal official records exclude Advice and Office Pickup requests", async () => {
  const originals = {
    animal: Animal.findOne,
    insemination: Insemination.find,
    pregnancy: Pregnancy.find,
    calving: Calving.find,
    health: HealthRequest.find,
    medical: MedicalRecord.find,
  };
  let healthRequestQueryAttempted = false;
  Animal.findOne = async () => ({
    _id: "animal-boundary-1",
    farmerId: "farmer-1",
  });
  Insemination.find = () => queryResult([]);
  Pregnancy.find = () => queryResult([]);
  Calving.find = () => queryResult([]);
  HealthRequest.find = () => {
    healthRequestQueryAttempted = true;
    return queryResult([
      { _id: "advice-1", handlingMethod: "advice", status: "resolved" },
      {
        _id: "pickup-1",
        handlingMethod: "office_pickup",
        status: "resolved",
      },
    ]);
  };
  MedicalRecord.find = () =>
    queryResult([
      {
        _id: "medical-1",
        animalId: "animal-boundary-1",
        type: "Treatment",
        date: new Date("2026-08-20T00:00:00.000Z"),
        details: { diagnosis: "Clinical diagnosis" },
      },
    ]);

  const recorder = responseRecorder();
  try {
    await getAnimalRecords(
      {
        user: { _id: "farmer-1", role: "farmer" },
        params: { id: "animal-boundary-1" },
        query: { page: "1", limit: "10" },
      },
      recorder.response,
    );

    assert.equal(recorder.statusCode, 200);
    assert.equal(healthRequestQueryAttempted, false);
    assert.deepEqual(
      recorder.body.data.map((record) => record.recordKind),
      ["medical_record"],
    );
  } finally {
    Animal.findOne = originals.animal;
    Insemination.find = originals.insemination;
    Pregnancy.find = originals.pregnancy;
    Calving.find = originals.calving;
    HealthRequest.find = originals.health;
    MedicalRecord.find = originals.medical;
  }
});

test("animal health history keeps request responses and hides Farmer-only internal notes", async () => {
  const originals = {
    animal: Animal.findOne,
    health: HealthRequest.find,
    medical: MedicalRecord.find,
  };
  Animal.findOne = async () => ({
    _id: "animal-history-1",
    farmerId: "farmer-1",
  });
  HealthRequest.find = () =>
    queryResult([
      {
        _id: "pickup-history-1",
        animalId: "animal-history-1",
        handlingMethod: "office_pickup",
        status: "resolved",
        advice: "Pickup information",
        technicianNote: "INTERNAL ONLY",
        statusHistory: [
          { status: "resolved", note: "PRIVATE", actorId: "tech-1" },
        ],
        createdAt: new Date("2026-08-20T00:00:00.000Z"),
      },
    ]);
  MedicalRecord.find = () => queryResult([]);

  const recorder = responseRecorder();
  try {
    await getAnimalHealthHistory(
      {
        user: { _id: "farmer-1", role: "farmer" },
        params: { id: "animal-history-1" },
        query: { page: "1", limit: "10" },
      },
      recorder.response,
    );

    assert.equal(recorder.statusCode, 200);
    assert.equal(recorder.body.data[0].recordKind, "health_request");
    assert.equal(recorder.body.data[0].advice, "Pickup information");
    assert.doesNotMatch(JSON.stringify(recorder.body), /INTERNAL ONLY|PRIVATE|actorId/);
  } finally {
    Animal.findOne = originals.animal;
    HealthRequest.find = originals.health;
    MedicalRecord.find = originals.medical;
  }
});

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

test("Official record detail: AI exposes canonical service and follow-up context", async () => {
  const originals = {
    animal: Animal.findOne,
    insemination: Insemination.findOne,
  };
  const animal = {
    _id: "animal-1",
    farmerId: "farmer-1",
    earTag: "TAG-001",
  };

  Animal.findOne = async () => animal;
  const createdAt = new Date("2026-07-31T08:00:00.000Z");
  const completedAt = new Date("2026-08-01T07:20:00.000Z");
  const serviceStartedAt = new Date("2026-08-01T07:00:00.000Z");
  const outcomeConfirmedAt = new Date("2026-09-05T04:00:00.000Z");
  const observationReportedAt = new Date("2026-08-22T03:00:00.000Z");
  const previousAttemptDate = new Date("2026-05-01T06:30:00.000Z");
  const pregnancyDiagnosisDate = new Date("2026-09-05T03:45:00.000Z");
  Insemination.findOne = () =>
    queryResult({
      _id: "ai-1",
      animalId: animal,
      status: "done",
      attemptNumber: 2,
      inseminationDate: new Date("2026-08-01T07:10:00.000Z"),
      createdAt,
      completedAt,
      serviceStartedAt,
      earlyStartMinutes: 15,
      outcome: "Pregnant",
      outcomeVerificationStatus: "verified",
      outcomeConfirmationSource: "technician_pregnancy_diagnosis",
      outcomeConfirmedBy: { _id: "tech-1", name: "Tech One" },
      outcomeConfirmedAt,
      farmerOutcomeReport: "possible_pregnancy",
      farmerOutcomeReportedAt: observationReportedAt,
      farmerObservationSigns: ["no_return_to_heat"],
      farmerObservationNotes: "No heat observed.",
      previousAttemptId: {
        attemptNumber: 1,
        inseminationDate: previousAttemptDate,
        outcome: "Failed (Re-heat)",
        failureReason: "return_to_heat",
      },
      pregnancyId: {
        _id: "pregnancy-1",
        pregnancyDiagnosis: {
          date: pregnancyDiagnosisDate,
          result: "Pregnant",
        },
        confirmation: { methodCode: "ultrasound" },
      },
      imageUrl: "https://example.test/request.jpg",
      evidencePhotos: [
        "https://example.test/follow-up.jpg",
        "https://example.test/request.jpg",
      ],
    });

  const recorder = responseRecorder();
  try {
    await getOfficialRecordDetail(
      {
        user: { _id: "farmer-1", role: "farmer" },
        params: {
          id: "animal-1",
          recordKind: "insemination",
          recordId: "ai-1",
        },
      },
      recorder.response,
    );

    assert.equal(recorder.statusCode, 200);
    assert.equal(recorder.body.data.dateLabel, "AI performed at");
    assert.equal(recorder.body.data.datePrecision, "datetime");
    assert.equal(recorder.body.data.details.entryDate, completedAt);
    assert.equal(
      recorder.body.data.details.entryDateLabel,
      "Record completed at",
    );
    assert.equal(recorder.body.data.details.requestedAt, createdAt);
    assert.equal(
      recorder.body.data.details.requestedAtLabel,
      "Workflow created at",
    );
    assert.equal(recorder.body.data.details.serviceStartedAt, serviceStartedAt);
    assert.equal(recorder.body.data.details.earlyStartMinutes, 15);
    assert.equal(recorder.body.data.details.outcomeVerificationStatus, "verified");
    assert.equal(
      recorder.body.data.details.outcomeConfirmationSource,
      "technician_pregnancy_diagnosis",
    );
    assert.equal(recorder.body.data.details.outcomeConfirmedBy, "Tech One");
    assert.equal(recorder.body.data.details.outcomeConfirmedAt, outcomeConfirmedAt);
    assert.equal(
      recorder.body.data.details.farmerOutcomeReport,
      "possible_pregnancy",
    );
    assert.deepEqual(recorder.body.data.details.farmerObservationSigns, [
      "no_return_to_heat",
    ]);
    assert.equal(
      recorder.body.data.details.farmerObservationNotes,
      "No heat observed.",
    );
    assert.equal(
      recorder.body.data.details.farmerOutcomeReportedAt,
      observationReportedAt,
    );
    assert.equal(recorder.body.data.details.previousAttemptNumber, 1);
    assert.equal(
      recorder.body.data.details.previousAttemptDate,
      previousAttemptDate,
    );
    assert.equal(
      recorder.body.data.details.previousAttemptOutcome,
      "Failed (Re-heat)",
    );
    assert.equal(
      recorder.body.data.details.previousAttemptFailureReason,
      "return_to_heat",
    );
    assert.equal(recorder.body.data.details.pregnancyLinked, true);
    assert.equal(recorder.body.data.details.pregnancyResult, "Pregnant");
    assert.equal(
      recorder.body.data.details.pregnancyDiagnosisDate,
      pregnancyDiagnosisDate,
    );
    assert.equal(
      recorder.body.data.details.pregnancyConfirmationMethod,
      "ultrasound",
    );
    assert.deepEqual(
      recorder.body.data.attachments.map((attachment) => attachment.url),
      [
        "https://example.test/request.jpg",
        "https://example.test/follow-up.jpg",
      ],
    );
  } finally {
    Animal.findOne = originals.animal;
    Insemination.findOne = originals.insemination;
  }
});

test("Official record detail: legacy AI does not present creation as completion", async () => {
  const originals = {
    animal: Animal.findOne,
    insemination: Insemination.findOne,
  };
  const createdAt = new Date("2025-04-01T08:00:00.000Z");
  const animal = {
    _id: "animal-legacy",
    farmerId: "farmer-1",
    earTag: "TAG-LEGACY",
  };

  Animal.findOne = async () => animal;
  Insemination.findOne = () =>
    queryResult({
      _id: "ai-legacy",
      animalId: animal,
      status: "done",
      attemptNumber: 1,
      inseminationDate: new Date("2025-04-02T07:00:00.000Z"),
      createdAt,
    });

  const recorder = responseRecorder();
  try {
    await getOfficialRecordDetail(
      {
        user: { _id: "farmer-1", role: "farmer" },
        params: {
          id: "animal-legacy",
          recordKind: "insemination",
          recordId: "ai-legacy",
        },
      },
      recorder.response,
    );

    assert.equal(recorder.statusCode, 200);
    assert.equal(recorder.body.data.details.entryDate, null);
    assert.equal(recorder.body.data.details.completedAt, null);
    assert.equal(recorder.body.data.details.requestedAt, createdAt);
    assert.equal(
      recorder.body.data.details.requestedAtLabel,
      "Workflow created at",
    );
  } finally {
    Animal.findOne = originals.animal;
    Insemination.findOne = originals.insemination;
  }
});

test("Official record detail: pregnancy returns canonical confirmation metadata", async () => {
  const originals = {
    animal: Animal.findOne,
    pregnancy: Pregnancy.findOne,
  };
  let pregnancyScope = null;
  const animal = {
    _id: "animal-1",
    farmerId: "farmer-1",
    earTag: "TAG-001",
    breed: "Brahman",
    species: "Cattle",
    reproductiveStatus: "Pregnant",
  };
  const confirmedAt = new Date("2026-07-10T04:00:00.000Z");
  const pregnancyId = new mongoose.Types.ObjectId();

  Animal.findOne = async () => animal;
  Pregnancy.findOne = (scope) => {
    pregnancyScope = scope;
    return queryResult({
      _id: pregnancyId,
      animalId: animal,
      pregnancyDiagnosis: { date: confirmedAt, result: "Pregnant" },
      confirmation: {
        methodCode: "ultrasound",
        stage: "standard",
        confirmedAt,
        confirmedBy: { _id: "tech-1", name: "Tech One" },
        policyVersion: "policy-1",
        recheckRequired: false,
      },
      recheckStatus: "not_required",
      inseminationId: { _id: "ai-1", attemptNumber: 2 },
      targetCalvingDate: new Date("2027-04-18T04:00:00.000Z"),
      technicianNote: "Pregnancy confirmed.",
      createdAt: confirmedAt,
    });
  };

  const recorder = responseRecorder();
  try {
    await getOfficialRecordDetail(
      {
        user: { _id: "farmer-1", role: "farmer" },
        params: {
          id: "animal-1",
          recordKind: "pregnancy",
          recordId: String(pregnancyId),
        },
      },
      recorder.response,
    );

    assert.equal(recorder.statusCode, 200);
    assert.equal(pregnancyScope.animalId, "animal-1");
    assert.equal(recorder.body.data.sourceKind, "pregnancy");
    assert.equal(recorder.body.data.sourceId, String(pregnancyId));
    assert.equal(recorder.body.data.type, "pregnancy");
    assert.equal(recorder.body.data.animalId.earTag, "TAG-001");
    assert.equal(recorder.body.data.datePrecision, "date");
    assert.equal(
      recorder.body.data.dateLabel,
      "Pregnancy diagnosis performed on",
    );
    assert.deepEqual(recorder.body.data.attachments, []);
    assert.equal(recorder.body.data.details.diagnosticMethod, "ultrasound");
    assert.equal(recorder.body.data.details.relatedAttempt, 2);
    assert.equal(recorder.body.data.details.technician, "Tech One");
    assert.equal(
      recorder.body.data.actions.pregnancyTrackerAvailable,
      true,
    );
  } finally {
    Animal.findOne = originals.animal;
    Pregnancy.findOne = originals.pregnancy;
  }
});

test("Official record detail: calving separates occurrence date from entry time and loads calf photos", async () => {
  const originals = {
    animal: Animal.findOne,
    calving: Calving.findOne,
  };
  const calvingDate = new Date("2026-08-02T00:00:00.000Z");
  const enteredAt = new Date("2026-08-02T07:10:00.000Z");
  const animal = {
    _id: "animal-1",
    farmerId: "farmer-1",
    earTag: "DAM-001",
  };

  Animal.findOne = async () => animal;
  Calving.findOne = () =>
    queryResult({
      _id: "calving-1",
      animalId: animal,
      technicianId: { _id: "tech-1", name: "Tech One" },
      date: calvingDate,
      createdAt: enteredAt,
      outcome: "live_birth",
      calvingEase: "natural",
      numberOfCalves: 1,
      livingCalfCount: 1,
      stillbornCount: 0,
      calves: [
        {
          sex: "F",
          earTag: "CALF-001",
          animalId: {
            _id: "calf-animal-1",
            earTag: "CALF-001",
            imageUrl: "https://example.test/calf.jpg",
          },
        },
      ],
      nonLivingCalves: [],
    });

  const recorder = responseRecorder();
  try {
    await getOfficialRecordDetail(
      {
        user: { _id: "farmer-1", role: "farmer" },
        params: {
          id: "animal-1",
          recordKind: "calving",
          recordId: "calving-1",
        },
      },
      recorder.response,
    );

    assert.equal(recorder.statusCode, 200);
    assert.equal(recorder.body.data.dateLabel, "Calving occurred on");
    assert.equal(recorder.body.data.datePrecision, "date");
    assert.equal(recorder.body.data.details.serviceDate, calvingDate);
    assert.equal(recorder.body.data.details.entryDate, enteredAt);
    assert.equal(
      recorder.body.data.details.entryDateLabel,
      "Recorded in BreedSmart at",
    );
    assert.equal(
      recorder.body.data.details.calves[0].imageUrl,
      "https://example.test/calf.jpg",
    );
    assert.equal(recorder.body.data.attachments.length, 1);
    assert.equal(
      recorder.body.data.attachments[0].category,
      "offspring_identity",
    );
  } finally {
    Animal.findOne = originals.animal;
    Calving.findOne = originals.calving;
  }
});

test("Official record detail: linked MedicalRecord exposes the Health report action", async () => {
  const originals = {
    animal: Animal.findOne,
    medical: MedicalRecord.findOne,
  };
  const animal = {
    _id: "animal-1",
    farmerId: "farmer-1",
    earTag: "TAG-001",
  };

  Animal.findOne = async () => animal;
  MedicalRecord.findOne = () =>
    queryResult({
      _id: "medical-1",
      animalId: animal,
      technicianId: { _id: "tech-1", name: "Tech One" },
      healthRequestId: {
        _id: "health-1",
        requestType: "disease",
        symptoms: "Low appetite",
        urgency: "medium",
        farmerNotes: "Started yesterday",
        photos: [
          "https://example.test/health-1.jpg",
          "https://example.test/shared.jpg",
        ],
        imageUrl: "https://example.test/shared.jpg",
      },
      type: "Treatment",
      date: new Date("2026-08-08T04:00:00.000Z"),
      details: {
        diagnosis: "Bacterial infection",
        treatment: "Antibiotic",
        withdrawalPeriodDays: 7,
      },
      imageUrl: "https://example.test/medical.jpg",
      createdAt: new Date("2026-08-08T04:30:00.000Z"),
    });

  const recorder = responseRecorder();
  try {
    await getOfficialRecordDetail(
      {
        user: { _id: "farmer-1", role: "farmer" },
        params: {
          id: "animal-1",
          recordKind: "medical_record",
          recordId: "medical-1",
        },
      },
      recorder.response,
    );

    assert.equal(recorder.statusCode, 200);
    assert.equal(recorder.body.data.type, "health");
    assert.equal(recorder.body.data.details.symptoms, "Low appetite");
    assert.equal(recorder.body.data.details.diagnosis, "Bacterial infection");
    assert.equal(recorder.body.data.dateLabel, "Health service record date");
    assert.deepEqual(
      recorder.body.data.attachments.map((attachment) => attachment.url),
      [
        "https://example.test/health-1.jpg",
        "https://example.test/shared.jpg",
        "https://example.test/medical.jpg",
      ],
    );
    assert.equal(recorder.body.data.actions.reportPreviewAvailable, true);
    assert.equal(recorder.body.data.actions.reportId, "medical-1");
  } finally {
    Animal.findOne = originals.animal;
    MedicalRecord.findOne = originals.medical;
  }
});

test("Official record detail rejects raw HealthRequest identifiers", async () => {
  const recorder = responseRecorder();

  await getOfficialRecordDetail(
    {
      user: { _id: "farmer-1", role: "farmer" },
      params: {
        id: "animal-1",
        recordKind: "health_request",
        recordId: "health-1",
      },
    },
    recorder.response,
  );

  assert.equal(recorder.statusCode, 400);
  assert.equal(recorder.body.code, "OFFICIAL_RECORD_KIND_INVALID");
});
