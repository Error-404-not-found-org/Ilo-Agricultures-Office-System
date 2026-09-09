import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import mongoose from "mongoose";
import cloudinary from "../src/config/cloudinary.js";

import { Animal } from "../src/models/animal.model.js";
import { AnimalTimelineEvent } from "../src/models/animal-timeline-event.model.js";
import { Calving } from "../src/models/calving.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import {
  PregnancyLossReport,
  PREGNANCY_LOSS_REPORT_STATUS,
} from "../src/models/pregnancy-loss-report.model.js";
import { Task } from "../src/models/task.model.js";
import { Notification } from "../src/models/notification.model.js";
import { User } from "../src/models/user.model.js";
import { recordCalving } from "../src/controllers/animals.controllers.js";
import {
  PREGNANCY_LOSS_REVIEW_OUTCOME,
  reviewPregnancyLossReport,
  submitPregnancyLossReport,
} from "../src/services/pregnancy-loss-report.service.js";

const ids = {
  animal: new mongoose.Types.ObjectId(),
  farmer: new mongoose.Types.ObjectId(),
  pregnancy: new mongoose.Types.ObjectId(),
  insemination: new mongoose.Types.ObjectId(),
  report: new mongoose.Types.ObjectId(),
  task: new mongoose.Types.ObjectId(),
  technician: new mongoose.Types.ObjectId(),
  otherTechnician: new mongoose.Types.ObjectId(),
  calving: new mongoose.Types.ObjectId(),
};

const originals = {
  startSession: mongoose.startSession,
  animalFindOne: Animal.findOne,
  timelineCreate: AnimalTimelineEvent.create,
  calvingFindOne: Calving.findOne,
  inseminationFindOne: Insemination.findOne,
  pregnancyFindOne: Pregnancy.findOne,
  reportFindOne: PregnancyLossReport.findOne,
  reportFindById: PregnancyLossReport.findById,
  reportCreate: PregnancyLossReport.create,
  reportFindOneAndUpdate: PregnancyLossReport.findOneAndUpdate,
  taskFindOne: Task.findOne,
  taskCreate: Task.create,
  taskFindOneAndUpdate: Task.findOneAndUpdate,
  taskUpdateOne: Task.updateOne,
  userFindOne: User.findOne,
  notificationCreate: Notification.create,
  notificationFindOneAndUpdate: Notification.findOneAndUpdate,
  cloudinaryUpload: cloudinary.uploader.upload,
  cloudinaryDestroy: cloudinary.uploader.destroy,
};

let state;

const query = (resolveValue) => ({
  sort() {
    return this;
  },
  session() {
    return this;
  },
  populate() {
    return this;
  },
  select() {
    return this;
  },
  lean() {
    return Promise.resolve(resolveValue());
  },
  then(resolve, reject) {
    return Promise.resolve(resolveValue()).then(resolve, reject);
  },
});

const applySet = (target, values = {}) => {
  for (const [key, value] of Object.entries(values)) {
    if (key.startsWith("metadata.")) {
      target.metadata ||= {};
      target.metadata[key.slice("metadata.".length)] = value;
    } else {
      target[key] = value;
    }
  }
};

const installHarness = () => {
  state = {
    animal: {
      _id: ids.animal,
      farmerId: ids.farmer,
      gender: "Female",
      reproductiveStatus: "Pregnant",
      expectedCalvingDate: new Date("2026-12-01T00:00:00.000Z"),
      parity: 2,
      deletedAt: null,
    },
    pregnancy: {
      _id: ids.pregnancy,
      animalId: ids.animal,
      farmerId: ids.farmer,
      inseminationId: ids.insemination,
      cycleStatus: "active",
      pregnancyDiagnosis: {
        result: "Pregnant",
        date: new Date("2026-06-01T00:00:00.000Z"),
      },
      confirmation: {
        confirmedBy: ids.technician,
      },
      deletedAt: null,
    },
    insemination: {
      _id: ids.insemination,
      animalId: ids.animal,
      inseminationDate: new Date("2026-04-01T00:00:00.000Z"),
      breedingCycleStatus: "active",
      deletedAt: null,
    },
    report: null,
    task: null,
    confirmingTechnician: {
      _id: ids.technician,
      role: "technician",
      status: "active",
      deletedAt: null,
    },
    calving: null,
    timelines: [],
    notifications: [],
  };

  Notification.create = async (doc) => {
    const payload = Array.isArray(doc) ? doc[0] : doc;
    const notification = { _id: new mongoose.Types.ObjectId(), ...payload };
    state.notifications.push(notification);
    return notification;
  };
  Notification.findOneAndUpdate = async (filter, update) => {
    const notification = { _id: new mongoose.Types.ObjectId(), ...update?.$setOnInsert };
    state.notifications.push(notification);
    return notification;
  };

  mongoose.startSession = async () => ({
    withTransaction: async (work) => work(),
    endSession: async () => {},
  });
  Animal.findOne = () => query(() => state.animal);
  Pregnancy.findOne = () => query(() => state.pregnancy);
  Insemination.findOne = () => query(() => state.insemination);
  Calving.findOne = () => query(() => state.calving);
  PregnancyLossReport.findOne = () =>
    query(() =>
      state.report &&
      [
        PREGNANCY_LOSS_REPORT_STATUS.PENDING_REVIEW,
        PREGNANCY_LOSS_REPORT_STATUS.NEEDS_VISIT,
      ].includes(state.report.status)
        ? state.report
        : null,
    );
  PregnancyLossReport.findById = () => query(() => state.report);
  PregnancyLossReport.create = async ([document]) => {
    state.report = {
      _id: ids.report,
      status: PREGNANCY_LOSS_REPORT_STATUS.PENDING_REVIEW,
      ...document,
    };
    return [state.report];
  };
  PregnancyLossReport.findOneAndUpdate = async (_filter, update) => {
    if (
      !state.report ||
      ![
        PREGNANCY_LOSS_REPORT_STATUS.PENDING_REVIEW,
        PREGNANCY_LOSS_REPORT_STATUS.NEEDS_VISIT,
      ].includes(state.report.status)
    ) {
      return null;
    }
    applySet(state.report, update.$set);
    return state.report;
  };
  Task.findOne = () =>
    query(() =>
      state.task && ["Pending", "In Progress"].includes(state.task.status)
        ? state.task
        : null,
    );
  User.findOne = (filter) =>
    query(() => {
      const technician = state.confirmingTechnician;
      if (!technician) return null;
      if (String(technician._id) !== String(filter._id)) return null;
      if (technician.role !== filter.role) return null;
      if (technician.deletedAt !== null) return null;
      if (["suspended", "deleted"].includes(technician.status)) return null;
      return technician;
    });
  Task.create = async ([document]) => {
    state.task = { _id: ids.task, metadata: {}, ...document };
    return [state.task];
  };
  Task.findOneAndUpdate = async (filter, update) => {
    if (!state.task || !["Pending", "In Progress"].includes(state.task.status)) {
      return null;
    }
    if (filter._id && String(filter._id) !== String(state.task._id)) return null;
    if (filter.$or) {
      const ownershipMatches = filter.$or.some((condition) => {
        const expected = condition.technicianId;
        if (expected === null) return state.task.technicianId == null;
        if (expected?.$exists === false) {
          return state.task.technicianId === undefined;
        }
        return String(expected) === String(state.task.technicianId);
      });
      if (!ownershipMatches) return null;
    }
    applySet(state.task, update.$set);
    return state.task;
  };
  Task.updateOne = async (_filter, update) => {
    applySet(state.task, update.$set);
    return { modifiedCount: 1 };
  };
  AnimalTimelineEvent.create = async ([entry]) => {
    state.timelines.push(entry);
    return [entry];
  };
  cloudinary.uploader.upload = async () => ({
    secure_url:
      "https://res.cloudinary.com/demo/image/upload/v1/breeding_evidence/uploaded-loss.jpg",
    public_id: "breeding_evidence/uploaded-loss",
  });
  cloudinary.uploader.destroy = async () => ({ result: "ok" });
};

beforeEach(installHarness);

after(() => {
  mongoose.startSession = originals.startSession;
  Animal.findOne = originals.animalFindOne;
  AnimalTimelineEvent.create = originals.timelineCreate;
  Calving.findOne = originals.calvingFindOne;
  Insemination.findOne = originals.inseminationFindOne;
  Pregnancy.findOne = originals.pregnancyFindOne;
  PregnancyLossReport.findOne = originals.reportFindOne;
  PregnancyLossReport.findById = originals.reportFindById;
  PregnancyLossReport.create = originals.reportCreate;
  PregnancyLossReport.findOneAndUpdate = originals.reportFindOneAndUpdate;
  Task.findOne = originals.taskFindOne;
  Task.create = originals.taskCreate;
  Task.findOneAndUpdate = originals.taskFindOneAndUpdate;
  Task.updateOne = originals.taskUpdateOne;
  User.findOne = originals.userFindOne;
  Notification.create = originals.notificationCreate;
  Notification.findOneAndUpdate = originals.notificationFindOneAndUpdate;
  cloudinary.uploader.upload = originals.cloudinaryUpload;
  cloudinary.uploader.destroy = originals.cloudinaryDestroy;
});

const submitReport = () =>
  submitPregnancyLossReport({
    animalId: ids.animal,
    farmer: { _id: ids.farmer, role: "farmer" },
    observationDate: "2026-07-01T00:00:00.000Z",
    notes: "Observed signs that may indicate pregnancy loss.",
    evidencePhotos: [
      "https://res.cloudinary.com/demo/image/upload/v1/breeding_evidence/loss.jpg",
    ],
  });

test("Farmer authoritative abortion is blocked before canonical Calving writes", async () => {
  const req = {
    user: { _id: ids.farmer, role: "farmer" },
    body: {
      animalId: ids.animal,
      pregnancyId: ids.pregnancy,
      outcome: "abortion",
    },
  };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await recordCalving(req, res);

  assert.equal(res.statusCode, 422);
  assert.equal(res.body.code, "PREGNANCY_LOSS_REQUIRES_REVIEW");
  assert.equal(state.calving, null);
});

test("Farmer report creates one pending review task without changing canonical pregnancy state", async () => {
  const result = await submitReport();

  assert.equal(result.alreadyReported, false);
  assert.equal(result.report.status, "pending_review");
  assert.deepEqual(result.report.evidencePhotos, [
    "https://res.cloudinary.com/demo/image/upload/v1/breeding_evidence/loss.jpg",
  ]);
  assert.equal(result.task.taskType, "BreedingFollowUp");
  assert.equal(result.task.sourceType, "farmer_pregnancy_loss_report");
  assert.equal(result.task.category, "Follow-up");
  assert.equal(result.task.priority, 2);
  assert.equal(result.task.technicianId, ids.technician);
  assert.equal(result.task.status, "Pending");
  assert.equal(result.task.metadata.reportId, ids.report);
  assert.equal(state.pregnancy.cycleStatus, "active");
  assert.equal(state.animal.reproductiveStatus, "Pregnant");
  assert.ok(state.animal.expectedCalvingDate);
  assert.equal(state.animal.parity, 2);
  assert.equal(state.calving, null);
  assert.equal(state.timelines[0].title, "Pregnancy loss reported");
  assert.match(state.timelines[0].summary, /Awaiting Technician review/);
});

test("Farmer report uploads base64 evidence and persists only the Cloudinary URL", async () => {
  const result = await submitPregnancyLossReport({
    animalId: ids.animal,
    farmer: { _id: ids.farmer, role: "farmer" },
    observationDate: "2026-07-01T00:00:00.000Z",
    evidencePhotos: ["data:image/jpeg;base64,YWJj"],
  });

  assert.deepEqual(result.report.evidencePhotos, [
    "https://res.cloudinary.com/demo/image/upload/v1/breeding_evidence/uploaded-loss.jpg",
  ]);
  assert.equal(result.report.evidencePhotos[0].startsWith("data:"), false);
});
test("Sequential duplicate report reuses the active report and task", async () => {
  const first = await submitReport();
  const second = await submitReport();

  assert.equal(second.alreadyReported, true);
  assert.equal(second.report, first.report);
  assert.equal(second.task, first.task);
  assert.equal(second.task.technicianId, ids.technician);
  assert.equal(state.timelines.length, 1);
});

test("Missing or invalid confirming Technician safely leaves the review unassigned", async () => {
  state.pregnancy.confirmation.confirmedBy = null;
  const missing = await submitReport();
  assert.equal(missing.task.technicianId, null);

  installHarness();
  state.confirmingTechnician.role = "farmer";
  const invalidRole = await submitReport();
  assert.equal(invalidRole.task.technicianId, null);

  installHarness();
  state.confirmingTechnician.status = "suspended";
  const suspended = await submitReport();
  assert.equal(suspended.task.technicianId, null);
});

test("Duplicate reuse assigns an unowned task when the valid confirmer becomes resolvable", async () => {
  state.confirmingTechnician = null;
  const first = await submitReport();
  assert.equal(first.task.technicianId, null);

  state.confirmingTechnician = {
    _id: ids.technician,
    role: "technician",
    status: "active",
    deletedAt: null,
  };
  const reused = await submitReport();

  assert.equal(reused.alreadyReported, true);
  assert.equal(reused.report, first.report);
  assert.equal(reused.task, first.task);
  assert.equal(reused.task.technicianId, ids.technician);
});

test("Duplicate reuse never steals a task already owned by another Technician", async () => {
  state.confirmingTechnician = null;
  const first = await submitReport();
  first.task.technicianId = ids.otherTechnician;

  state.confirmingTechnician = {
    _id: ids.technician,
    role: "technician",
    status: "active",
    deletedAt: null,
  };
  const reused = await submitReport();

  assert.equal(reused.alreadyReported, true);
  assert.equal(reused.task.technicianId, ids.otherTechnician);
});

test("Not Confirmed resolves review while pregnancy monitoring remains active", async () => {
  await submitReport();

  const result = await reviewPregnancyLossReport({
    reportId: ids.report,
    technician: { _id: ids.technician, role: "technician" },
    outcome: PREGNANCY_LOSS_REVIEW_OUTCOME.NOT_CONFIRMED,
    reviewNotes: "Pregnancy remains clinically active.",
    persistCalvingImpl: async () => {
      throw new Error("Canonical Calving must not run");
    },
  });

  assert.equal(result.report.status, "not_confirmed");
  assert.equal(state.task.status, "Completed");
  assert.equal(state.pregnancy.cycleStatus, "active");
  assert.equal(state.animal.reproductiveStatus, "Pregnant");
  assert.ok(state.animal.expectedCalvingDate);
  assert.equal(state.calving, null);
  assert.equal(state.timelines.at(-1).title, "Pregnancy loss not confirmed");
});

test("Needs Visit keeps report actionable without scheduling or lifecycle mutation", async () => {
  await submitReport();

  const result = await reviewPregnancyLossReport({
    reportId: ids.report,
    technician: { _id: ids.technician, role: "technician" },
    outcome: PREGNANCY_LOSS_REVIEW_OUTCOME.NEEDS_VISIT,
    persistCalvingImpl: async () => {
      throw new Error("Canonical Calving must not run");
    },
  });

  assert.equal(result.report.status, "needs_visit");
  assert.equal(state.task.status, "In Progress");
  assert.equal(state.task.technicianId, ids.technician);
  assert.equal(state.task.metadata.reviewOutcome, "needs_visit");
  assert.equal(state.task.metadata.visitId, undefined);
  assert.equal(state.pregnancy.cycleStatus, "active");
  assert.equal(state.animal.reproductiveStatus, "Pregnant");
  assert.ok(state.animal.expectedCalvingDate);
  assert.equal(state.calving, null);
  assert.match(state.timelines.at(-1).summary, /No visit has been scheduled/);
});

test("Confirm Loss delegates to canonical abortion persistence and links the review", async () => {
  await submitReport();
  let canonicalInput;

  const result = await reviewPregnancyLossReport({
    reportId: ids.report,
    technician: { _id: ids.technician, role: "technician" },
    outcome: PREGNANCY_LOSS_REVIEW_OUTCOME.CONFIRM_LOSS,
    reviewNotes: "Loss confirmed during Technician review.",
    persistCalvingImpl: async (input) => {
      canonicalInput = input;
      state.calving = {
        _id: ids.calving,
        pregnancyId: ids.pregnancy,
        outcome: "abortion",
        technicianId: ids.technician,
      };
      state.pregnancy.cycleStatus = "lost";
      state.insemination.breedingCycleStatus = "lost";
      state.animal.reproductiveStatus = "Post-partum";
      state.animal.expectedCalvingDate = undefined;
      state.animal.lastPregnancyLossDate = input.date;
      return { calving: state.calving, offspring: [], outcome: "abortion" };
    },
  });

  assert.equal(canonicalInput.outcome, "abortion");
  assert.equal(canonicalInput.calvingEase, undefined);
  assert.deepEqual(canonicalInput.calves, []);
  assert.equal(canonicalInput.numberOfCalves, 0);
  assert.equal(canonicalInput.actor._id, ids.technician);
  assert.equal(result.report.status, "confirmed");
  assert.equal(result.report.confirmedCalvingId, ids.calving);
  assert.equal(result.calving.technicianId, ids.technician);
  assert.equal(result.calving.calvingEase, undefined);
  assert.equal(state.task.status, "Completed");
  assert.equal(state.task.relatedRecordId, ids.calving);
  assert.equal(state.pregnancy.cycleStatus, "lost");
  assert.equal(state.insemination.breedingCycleStatus, "lost");
  assert.equal(state.animal.reproductiveStatus, "Post-partum");
  assert.equal(state.animal.expectedCalvingDate, undefined);
  assert.equal(state.animal.parity, 2);
  assert.equal(state.timelines.at(-1).title, "Pregnancy loss confirmed");

  const lossNotification = state.notifications.find(
    (n) => n.metadata?.eventType === "pregnancy_loss_confirmed" || n.eventType === "pregnancy_loss_confirmed",
  );
  assert.ok(lossNotification, "Farmer notification for pregnancy_loss_confirmed must be created");
  assert.equal(String(lossNotification.recipientId), String(ids.farmer));
});
