import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Animal } from "../src/models/animal.model.js";
import { AnimalTimelineEvent } from "../src/models/animal-timeline-event.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import { Calving } from "../src/models/calving.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Notification } from "../src/models/notification.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Task } from "../src/models/task.model.js";
import { persistCalving } from "../src/services/calving.service.js";
import cloudinary from "../src/config/cloudinary.js";
import { recordCalving as recordFarmerCalving } from "../src/controllers/animals.controllers.js";
import { isPregnancyCycleActive } from "../src/domain/pregnancy-lifecycle.js";

const ids = {
  farmer: "507f1f77bcf86cd799439011",
  mother: "507f1f77bcf86cd799439021",
  pregnancy: "507f1f77bcf86cd799439022",
  insemination: "507f1f77bcf86cd799439023",
  actor: "507f1f77bcf86cd799439025",
  task: "507f1f77bcf86cd799439026",
  calving: "507f1f77bcf86cd799439027",
};

const baseMother = {
  _id: ids.mother,
  farmerId: ids.farmer,
  animalId: "MOTHER-1",
  earTag: "M-1",
  species: "Cattle",
  breed: "Native",
  color: "Brown",
  brand: "BR",
  barangay: "Poblacion",
  reproductiveStatus: "Pregnant",
  expectedCalvingDate: new Date("2026-07-11T00:00:00.000Z"),
  parity: 1,
};

const basePregnancy = {
  _id: ids.pregnancy,
  animalId: ids.mother,
  farmerId: ids.farmer,
  inseminationId: ids.insemination,
  pregnancyDiagnosis: {
    result: "Pregnant",
    date: new Date("2025-12-01T00:00:00.000Z"),
  },
  cycleStatus: "active",
};

const baseInsemination = {
  _id: ids.insemination,
  animalId: ids.mother,
  farmerId: ids.farmer,
  inseminationDate: new Date("2025-10-01T00:00:00.000Z"),
  sireBreed: "Brahman",
};

const actor = { _id: ids.actor, role: "technician" };
const validInput = (overrides = {}) => ({
  mother: { _id: ids.mother },
  pregnancy: { _id: ids.pregnancy },
  calves: [{ earTag: "C-1", sex: "F", color: "Brown", brand: "C1" }],
  date: new Date("2026-07-10T08:00:00.000Z"),
  calvingEase: "Natural",
  numberOfCalves: 1,
  technicianNote: "Healthy calf",
  actor,
  ...overrides,
});

const query = (value) => {
  const result = {
    session() { return result; },
    select() { return result; },
    populate() { return result; },
    sort() { return result; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
  return result;
};

const installHarness = (overrides = {}) => {
  const originals = {
    startSession: mongoose.startSession,
    animalFindOne: Animal.findOne,
    animalInsertMany: Animal.insertMany,
    animalUpdate: Animal.findByIdAndUpdate,
    pregnancyFindOne: Pregnancy.findOne,
    pregnancyUpdate: Pregnancy.updateOne,
    inseminationFindOne: Insemination.findOne,
    inseminationUpdate: Insemination.updateOne,
    calvingFindOne: Calving.findOne,
    calvingCreate: Calving.create,
    taskFindOne: Task.findOne,
    taskUpdate: Task.findOneAndUpdate,
    notificationCreate: Notification.create,
    timelineInsert: AnimalTimelineEvent.insertMany,
    auditCreate: AuditLog.create,
    cloudinaryUpload: cloudinary.uploader.upload,
    cloudinaryDestroy: cloudinary.uploader.destroy,
  };
  const session = {
    async withTransaction(work) { await work(); },
    async endSession() {},
  };
  const state = {
    mother: { ...baseMother, ...overrides.mother },
    pregnancy: {
      ...basePregnancy,
      ...overrides.pregnancy,
      pregnancyDiagnosis: {
        ...basePregnancy.pregnancyDiagnosis,
        ...overrides.pregnancy?.pregnancyDiagnosis,
      },
    },
    insemination: { ...baseInsemination, ...overrides.insemination },
    existingCalving: overrides.existingCalving || null,
    existingCalf: overrides.existingCalf || null,
    task: overrides.task === false ? null : (overrides.task || {
      _id: ids.task,
      farmerId: ids.farmer,
      animalIds: [ids.mother],
      taskType: "CD",
      status: "Pending",
      technicianId: ids.actor,
    }),
    inserted: [],
    calvings: [],
    motherUpdates: [],
    pregnancyUpdates: [],
    inseminationUpdates: [],
    taskUpdates: [],
    notifications: [],
    timelines: [],
    audits: [],
    uploads: [],
    destroyed: [],
    session,
  };

  mongoose.startSession = async () => session;
  Animal.findOne = (filter) => query(filter?._id ? state.mother : state.existingCalf);
  Animal.insertMany = async (documents, options) => {
    if (overrides.insertError) throw overrides.insertError;
    if (overrides.offspringFailure) throw new Error("offspring write failed");
    assert.equal(options.session, session);
    state.inserted = documents.map((document, index) => ({
      ...document,
      _id: `507f1f77bcf86cd79943903${index}`,
    }));
    return state.inserted;
  };
  Animal.findByIdAndUpdate = async (_id, update, options) => {
    state.motherUpdates.push({ update, options });
    return state.mother;
  };
  Pregnancy.findOne = () => query(state.pregnancy);
  Pregnancy.updateOne = async (...args) => { state.pregnancyUpdates.push(args); };
  Insemination.findOne = () => query(overrides.missingInsemination ? null : state.insemination);
  Insemination.updateOne = async (...args) => { state.inseminationUpdates.push(args); };
  Calving.findOne = () => query(state.existingCalving);
  Calving.create = async (documents, options) => {
    const calving = { ...documents[0], _id: ids.calving };
    state.calvings.push({ calving, options });
    state.existingCalving = calving;
    return [calving];
  };
  Task.findOne = () => query(
    state.task && ["Pending", "In Progress"].includes(state.task.status)
      ? state.task
      : null,
  );
  Task.findOneAndUpdate = async (...args) => {
    if (overrides.taskCompletionFailure) return null;
    state.taskUpdates.push(args);
    return { ...state.task, status: "Completed" };
  };
  Notification.create = async (documents, options) => {
    state.notifications.push({ document: documents[0], options });
    return documents;
  };
  AnimalTimelineEvent.insertMany = async (documents, options) => {
    state.timelines.push({ documents, options });
    return documents;
  };
  AuditLog.create = async (documents, options) => {
    state.audits.push({ document: documents[0], options });
    return documents;
  };
  cloudinary.uploader.upload = async () => {
    const upload = { secure_url: "https://cdn.example/new-calf.jpg", public_id: "new-calf-public-id" };
    state.uploads.push(upload);
    return upload;
  };
  cloudinary.uploader.destroy = async (publicId) => {
    state.destroyed.push(publicId);
    if (overrides.cleanupFailure) throw new Error("cleanup unavailable");
    return { result: "ok" };
  };

  return {
    state,
    restore() {
      mongoose.startSession = originals.startSession;
      Animal.findOne = originals.animalFindOne;
      Animal.insertMany = originals.animalInsertMany;
      Animal.findByIdAndUpdate = originals.animalUpdate;
      Pregnancy.findOne = originals.pregnancyFindOne;
      Pregnancy.updateOne = originals.pregnancyUpdate;
      Insemination.findOne = originals.inseminationFindOne;
      Insemination.updateOne = originals.inseminationUpdate;
      Calving.findOne = originals.calvingFindOne;
      Calving.create = originals.calvingCreate;
      Task.findOne = originals.taskFindOne;
      Task.findOneAndUpdate = originals.taskUpdate;
      Notification.create = originals.notificationCreate;
      AnimalTimelineEvent.insertMany = originals.timelineInsert;
      AuditLog.create = originals.auditCreate;
      cloudinary.uploader.upload = originals.cloudinaryUpload;
      cloudinary.uploader.destroy = originals.cloudinaryDestroy;
    },
  };
};

const withHarness = async (overrides, work) => {
  const harness = installHarness(overrides);
  try { await work(harness.state); } finally { harness.restore(); }
};

test("Calving: natural birth creates a female calf and all canonical records", async () => {
  await withHarness({}, async (state) => {
    const result = await persistCalving(validInput({ taskId: ids.task }));
    assert.equal(result.outcome, "live_birth");
    assert.equal(result.offspring[0].gender, "Female");
    assert.equal(result.offspring[0].motherId, ids.mother);
    assert.equal(result.offspring[0].farmerId, ids.farmer);
    assert.equal(result.offspring[0].breed, "Native x Brahman");
    assert.equal(result.offspring[0].birthDate.toISOString(), "2026-07-10T08:00:00.000Z");
    assert.equal(state.calvings[0].options.session, state.session);
    assert.equal(state.notifications[0].options.session, state.session);
    assert.equal(state.timelines[0].documents.length, 2);
    assert.equal(state.audits[0].document.metadata.pregnancyId, ids.pregnancy);
    assert.deepEqual(state.audits[0].document.metadata.calfIds, [result.offspring[0]._id]);
    assert.equal(state.taskUpdates[0][1].$set.relatedRecordType, "calving");
  });
});

test("Calving: difficult twin birth creates two unique offspring", async () => {
  await withHarness({}, async (state) => {
    const result = await persistCalving(validInput({
      calvingEase: "Difficult",
      numberOfCalves: 2,
      calves: [
        { earTag: "TW-1", sex: "M", color: "Black" },
        { earTag: "TW-2", sex: "F", color: "Brown" },
      ],
    }));
    assert.equal(result.offspring.length, 2);
    assert.equal(new Set(state.inserted.map((item) => item.animalId)).size, 2);
  });
});

test("Calving: cesarean is a live-birth outcome", async () => {
  await withHarness({}, async () => {
    const result = await persistCalving(validInput({ calvingEase: "Cesarean" }));
    assert.equal(result.calving.outcome, "live_birth");
    assert.equal(result.offspring.length, 1);
  });
});

test("Calving: mother update clears expected date and increments parity once", async () => {
  await withHarness({}, async (state) => {
    await persistCalving(validInput());
    const update = state.motherUpdates[0].update;
    assert.equal(update.$set.reproductiveStatus, "Post-partum");
    assert.equal(update.$unset.expectedCalvingDate, 1);
    assert.equal(update.$inc.parity, 1);
    assert.equal(state.taskUpdates.length, 0);
  });
});

test("Calving: pregnancy and insemination cycles are completed", async () => {
  await withHarness({}, async (state) => {
    await persistCalving(validInput());
    assert.equal(state.pregnancyUpdates[0][1].$set.cycleStatus, "completed");
    assert.equal(state.inseminationUpdates[0][1].$set.breedingCycleStatus, "completed");
  });
});

test("Calving: rejects pregnancy belonging to another mother", async () => {
  await withHarness({ pregnancy: { animalId: "507f1f77bcf86cd799439099" } }, async () => {
    await assert.rejects(persistCalving(validInput()), { code: "PREGNANCY_MOTHER_MISMATCH" });
  });
});

test("Calving: rejects Empty and unconfirmed pregnancy states", async () => {
  for (const result of ["Empty", undefined]) {
    await withHarness({ pregnancy: { pregnancyDiagnosis: { result } } }, async () => {
      await assert.rejects(persistCalving(validInput()), { code: "PREGNANCY_NOT_CONFIRMED" });
    });
  }
});

test("Calving: rejects likely-pregnant farmer report without clinical confirmation", async () => {
  await withHarness({
    mother: { reproductiveStatus: "Likely Pregnant" },
    pregnancy: { pregnancyDiagnosis: { result: undefined } },
  }, async () => {
    await assert.rejects(persistCalving(validInput()), { code: "PREGNANCY_NOT_CONFIRMED" });
  });
});

test("Calving: rejects duplicate pregnancy record", async () => {
  await withHarness({ existingCalving: { _id: ids.calving } }, async (state) => {
    await assert.rejects(persistCalving(validInput()), { code: "CALVING_ALREADY_RECORDED" });
    assert.equal(state.inserted.length, 0);
    assert.equal(state.motherUpdates.length, 0);
  });
});

test("Calving: rejects an ear tag already used by the farmer", async () => {
  await withHarness({ existingCalf: { earTag: "C-1" } }, async () => {
    await assert.rejects(persistCalving(validInput()), { code: "CALF_EAR_TAG_IN_USE" });
  });
});

test("Calving: rejects duplicate ear tags in one request", async () => {
  await assert.rejects(persistCalving(validInput({
    numberOfCalves: 2,
    calves: [{ earTag: "C-1", sex: "F" }, { earTag: "c-1", sex: "M" }],
  })), { code: "DUPLICATE_CALF_EAR_TAG" });
});

test("Calving: validates calf count, ear tag, and sex before writing", async () => {
  await assert.rejects(persistCalving(validInput({ numberOfCalves: 2 })), { code: "CALF_COUNT_MISMATCH" });
  await assert.rejects(persistCalving(validInput({ calves: [{ sex: "F" }] })), { code: "CALF_EAR_TAG_REQUIRED" });
  await assert.rejects(persistCalving(validInput({ calves: [{ earTag: "C-1", sex: "X" }] })), { code: "CALF_SEX_INVALID" });
});

test("Calving: rejects future, pre-AI, pre-diagnosis, and impossible early dates", async () => {
  await assert.rejects(persistCalving(validInput({ date: new Date("2099-01-01") })), { code: "CALVING_DATE_IN_FUTURE" });
  await withHarness({}, async () => {
    await assert.rejects(persistCalving(validInput({ date: new Date("2025-09-30") })), { code: "CALVING_BEFORE_AI" });
    await assert.rejects(persistCalving(validInput({ date: new Date("2025-11-01") })), { code: "CALVING_BEFORE_PREGNANCY_DIAGNOSIS" });
    await assert.rejects(persistCalving(validInput({ date: new Date("2026-01-15") })), { code: "CALVING_TOO_EARLY" });
  });
});

test("Calving: rejects missing related insemination", async () => {
  await withHarness({ missingInsemination: true }, async () => {
    await assert.rejects(persistCalving(validInput()), { code: "INSEMINATION_NOT_FOUND" });
  });
});

test("Calving: invalid or completed task is rejected before offspring writes", async () => {
  await withHarness({ task: false }, async (state) => {
    await assert.rejects(persistCalving(validInput({
      taskId: ids.task,
      calves: [{ earTag: "C-1", sex: "F", imageUrl: "data:image/jpeg;base64,abc" }],
    })), { code: "TASK_RECORD_MISMATCH" });
    assert.equal(state.inserted.length, 0);
    assert.equal(state.calvings.length, 0);
    assert.equal(state.uploads.length, 0);
  });
  await withHarness({ task: { ...baseMother, _id: ids.task, status: "Completed" } }, async (state) => {
    await assert.rejects(persistCalving(validInput({ taskId: ids.task })), { code: "TASK_RECORD_MISMATCH" });
    assert.equal(state.inserted.length, 0);
  });
});

test("Calving: retry conflicts without duplicating offspring or parity", async () => {
  await withHarness({}, async (state) => {
    await persistCalving(validInput());
    await assert.rejects(persistCalving(validInput()), { code: "CALVING_ALREADY_RECORDED" });
    assert.equal(state.inserted.length, 1);
    assert.equal(state.motherUpdates.length, 1);
  });
});

test("Calving: abortion creates no Animal and does not increment parity", async () => {
  await withHarness({}, async (state) => {
    const result = await persistCalving(validInput({
      calvingEase: "Abortion",
      numberOfCalves: 0,
      calves: [],
    }));
    assert.equal(result.offspring.length, 0);
    assert.equal(result.calving.outcome, "abortion");
    assert.equal(state.inserted.length, 0);
    assert.equal(state.motherUpdates[0].update.$inc, undefined);
    assert.equal(state.pregnancyUpdates[0][1].$set.cycleStatus, "lost");
    assert.match(state.notifications[0].document.message, /abortion/i);
  });
});

test("Calving: stillbirth stores embedded details without active livestock", async () => {
  await withHarness({}, async (state) => {
    const result = await persistCalving(validInput({
      calvingEase: "Stillbirth",
      calves: [{ sex: "F", color: "Brown" }],
    }));
    assert.equal(result.offspring.length, 0);
    assert.equal(result.calving.nonLivingCalves.length, 1);
    assert.equal(state.inserted.length, 0);
    assert.equal(state.motherUpdates[0].update.$inc.parity, 1);
    assert.equal(state.motherUpdates[0].update.$set.reproductiveStatus, "Post-partum");
    assert.equal(state.motherUpdates[0].update.$unset.expectedCalvingDate, 1);
    assert.match(state.notifications[0].document.message, /stillbirth/i);
  });
});

test("Calving: mixed outcome registers only living calves and counts the total delivery", async () => {
  await withHarness({}, async (state) => {
    const result = await persistCalving(validInput({
      outcome: "mixed",
      calvingEase: "Difficult",
      numberOfCalves: 2,
      calves: [{ earTag: "LIVE-1", sex: "F", color: "Brown" }],
      nonLivingCalves: [{ sex: "M", color: "Black" }],
    }));
    assert.equal(result.offspring.length, 1);
    assert.equal(result.calving.numberOfCalves, 2);
    assert.equal(result.calving.totalDelivered, 2);
    assert.equal(result.calving.livingCalfCount, 1);
    assert.equal(result.calving.stillbornCount, 1);
    assert.equal(state.motherUpdates[0].update.$inc.parity, 1);
    assert.equal(state.motherUpdates[0].update.$unset.expectedCalvingDate, 1);
  });
});

test("Calving: abortion uses pregnancy-loss recovery without incrementing parity", async () => {
  await withHarness({}, async (state) => {
    await persistCalving(validInput({ calvingEase: "Abortion", calves: [], numberOfCalves: 0 }));
    const update = state.motherUpdates[0].update;
    assert.equal(update.$set.reproductiveStatus, "Post-partum");
    assert.ok(update.$set.lastPregnancyLossDate);
    assert.equal(update.$set.lastCalvingDate, undefined);
    assert.equal(update.$inc, undefined);
    assert.equal(update.$unset.expectedCalvingDate, 1);
  });
});

test("Calving: failed transaction cleans only newly uploaded Cloudinary assets", async () => {
  await withHarness({ offspringFailure: true }, async (state) => {
    await assert.rejects(persistCalving(validInput({
      calves: [{ earTag: "C-1", sex: "F", imageUrl: "data:image/jpeg;base64,abc" }],
    })), /offspring write failed/);
    assert.deepEqual(state.destroyed, ["new-calf-public-id"]);
  });
  await withHarness({ offspringFailure: true }, async (state) => {
    await assert.rejects(persistCalving(validInput({
      calves: [{ earTag: "C-1", sex: "F", imageUrl: "https://cdn.example/existing.jpg" }],
    })), /offspring write failed/);
    assert.deepEqual(state.destroyed, []);
  });
});

test("Calving: cleanup failure preserves the original transaction error", async () => {
  await withHarness({ offspringFailure: true, cleanupFailure: true }, async () => {
    await assert.rejects(persistCalving(validInput({
      calves: [{ earTag: "C-1", sex: "F", imageUrl: "data:image/jpeg;base64,abc" }],
    })), /offspring write failed/);
  });
});

test("Animal ear-tag index uses normalized active farmer scope", () => {
  const index = Animal.schema.indexes().find(([, options]) => options.name === "uniq_active_ear_tag_per_farmer");
  assert.deepEqual(index[0], { farmerId: 1, normalizedEarTag: 1 });
  assert.equal(index[1].unique, true);
  assert.deepEqual(index[1].partialFilterExpression.deletedAt, null);
  assert.equal(index[1].partialFilterExpression.normalizedEarTag.$gt, "");
  const animal = new Animal({ farmerId: ids.farmer, animalId: "A-1", species: "Cattle", breed: "Native", earTag: "  Tag-1  " });
  const empty = new Animal({ farmerId: ids.farmer, animalId: "A-2", species: "Cattle", breed: "Native", earTag: "   " });
  return Promise.all([animal.validate(), empty.validate()]).then(() => {
    assert.equal(animal.normalizedEarTag, "tag-1");
    assert.equal(empty.normalizedEarTag, undefined);
    // The partial index omits soft-deleted documents, so their tags are reusable.
    assert.equal(index[1].partialFilterExpression.deletedAt, null);
  });
});

test("Calving: normalized unique-index E11000 becomes a structured conflict", async () => {
  const duplicate = Object.assign(new Error("duplicate key"), {
    code: 11000,
    keyPattern: { normalizedEarTag: 1 },
  });
  await withHarness({ insertError: duplicate }, async () => {
    await assert.rejects(persistCalving(validInput()), { code: "CALF_EAR_TAG_IN_USE", status: 409 });
  });
});

test("Calving: offspring failure prevents calving, mother, task, timeline, and audit writes", async () => {
  await withHarness({ offspringFailure: true }, async (state) => {
    await assert.rejects(persistCalving(validInput({ taskId: ids.task })), /offspring write failed/);
    assert.equal(state.calvings.length, 0);
    assert.equal(state.motherUpdates.length, 0);
    assert.equal(state.taskUpdates.length, 0);
    assert.equal(state.timelines.length, 0);
    assert.equal(state.audits.length, 0);
  });
});

test("Calving schema supports pregnancy loss without Animal references", () => {
  assert.ok(Calving.schema.path("outcome"));
  assert.ok(Calving.schema.path("nonLivingCalves"));
  assert.ok(Calving.schema.path("inseminationId"));
});

const controllerResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test("Calving route: farmer cannot record for another owner's animal", async () => {
  const original = Animal.findOne;
  Animal.findOne = () => query({ ...baseMother, farmerId: "507f1f77bcf86cd799439099" });
  try {
    const res = controllerResponse();
    await recordFarmerCalving({ body: { animalId: ids.mother }, user: { ...actor, role: "farmer" } }, res);
    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, /Unauthorized/i);
  } finally {
    Animal.findOne = original;
  }
});

test("Calving route: farmer early-calving override is rejected", async () => {
  const original = Animal.findOne;
  Animal.findOne = () => query({ ...baseMother, farmerId: ids.actor });
  try {
    const res = controllerResponse();
    await recordFarmerCalving({
      body: { animalId: ids.mother, earlyCalvingOverride: true },
      user: { ...actor, role: "farmer" },
    }, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, "EARLY_CALVING_OVERRIDE_FORBIDDEN");
  } finally {
    Animal.findOne = original;
  }
});

test("Historical pregnancy fallback: an existing Calving closes legacy cycles without status fields", () => {
  const legacyPregnancy = {
    pregnancyDiagnosis: { result: "Pregnant" },
    cycleStatus: undefined,
  };
  assert.equal(isPregnancyCycleActive(legacyPregnancy, false), true);
  assert.equal(isPregnancyCycleActive(legacyPregnancy, true), false);
});
