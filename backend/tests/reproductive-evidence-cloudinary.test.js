import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import cloudinary from "../src/config/cloudinary.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Animal } from "../src/models/animal.model.js";
import { Task } from "../src/models/task.model.js";
import { User } from "../src/models/user.model.js";
import { AnimalTimelineEvent } from "../src/models/animal-timeline-event.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import { Config } from "../src/models/config.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Notification } from "../src/models/notification.model.js";
import {
  submitFarmerBreedingObservation,
  verifyFarmerBreedingObservation,
  submitFarmerPregnancyReport,
  recordTechnicianBreedingObservation,
} from "../src/controllers/ai-request.controllers.js";
import { persistBreedingObservationVerification } from "../src/services/livestock-transaction.service.js";
import { inngest } from "../src/config/inngest.js";

const originalMongooseStartSession = mongoose.startSession;
const originalInseminationFindOne = Insemination.findOne;
const originalInseminationFindById = Insemination.findById;
const originalInseminationFindOneAndUpdate = Insemination.findOneAndUpdate;
const originalAnimalFindById = Animal.findById;
const originalAnimalFindOne = Animal.findOne;
const originalAnimalFindByIdAndUpdate = Animal.findByIdAndUpdate;
const originalTaskFindOne = Task.findOne;
const originalTaskFind = Task.find;
const originalTaskUpdateOne = Task.updateOne;
const originalTaskFindOneAndUpdate = Task.findOneAndUpdate;
const originalUserFindById = User.findById;
const originalUserFindOne = User.findOne;
const originalTimelineCreate = AnimalTimelineEvent.create;
const originalAuditLogCreate = AuditLog.create;
const originalInngestSend = inngest.send;
const originalUpload = cloudinary.uploader.upload;
const originalDestroy = cloudinary.uploader.destroy;
const originalConfigFindOne = Config.findOne;
const originalPregnancyFindOne = Pregnancy.findOne;
const originalPregnancyCreate = Pregnancy.create;
const originalNotificationFindOneAndUpdate = Notification.findOneAndUpdate;

const farmerId = new mongoose.Types.ObjectId();
const technicianId = new mongoose.Types.ObjectId();
const animalId = new mongoose.Types.ObjectId();
const inseminationId = new mongoose.Types.ObjectId();
const taskId = new mongoose.Types.ObjectId();

const validBase64Image = (n = 1) =>
  `data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk${n}A8AAQUBAScY42YAAAAASUVORK5CYII=`;

const mockAnimal = {
  _id: animalId,
  farmerId,
  animalId: "ANM-001",
  earTag: "TAG-001",
  gender: "Female",
  species: "Cattle",
  birthDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000 * 3),
  reproductiveStatus: "Inseminated",
  activityLogs: [],
  save: async function () {
    return this;
  },
};

const createMockInsemination = (overrides = {}) => ({
  _id: inseminationId,
  farmerId,
  technicianId,
  animalId: mockAnimal,
  status: "done",
  inseminationDate: new Date("2026-08-01"),
  outcome: null,
  isSuccess: null,
  evidencePhotos: [],
  farmerPregnancyPhotos: [],
  verificationStatus: "pending",
  verificationRequested: false,
  statusHistory: [],
  save: async function () {
    return this;
  },
  ...overrides,
});

const mockReqRes = (params, body, userRole = "farmer") => {
  const req = {
    params: { id: inseminationId.toString(), ...params },
    body: { ...body },
    user: {
      _id: userRole === "farmer" ? farmerId : technicianId,
      role: userRole,
      address: { barangay: "Balabag", municipality: "Pavilion" },
    },
    app: {
      get: (key) => (key === "io" ? { emit: () => {} } : null),
    },
  };

  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };

  return { req, res };
};

test.beforeEach(() => {
  mongoose.startSession = async () => ({
    withTransaction: async (work) => work(),
    endSession: async () => {},
  });
  Config.findOne = async () => null;
  Pregnancy.findOne = () => ({
    session: async () => null,
  });
  Pregnancy.create = async ([data]) => [
    { _id: new mongoose.Types.ObjectId(), ...data },
  ];
  Animal.findById = async () => ({ ...mockAnimal, activityLogs: [] });
  Animal.findOne = async () => ({ ...mockAnimal, activityLogs: [] });
  Animal.findByIdAndUpdate = async (_id, update) => ({
    ...mockAnimal,
    activityLogs: [],
  });
  Insemination.findById = async () => createMockInsemination();
  Insemination.findOne = () => ({
    populate: async () => createMockInsemination(),
    sort: () => ({ lean: async () => null }),
    lean: async () => null,
  });
  Task.findOne = () => ({
    sort: async () => ({
      _id: taskId,
      technicianId,
      farmerId,
      animalIds: [animalId],
      taskType: "BreedingFollowUp",
      status: "Pending",
    }),
    session: () => ({
      _id: taskId,
      technicianId,
      farmerId,
      animalIds: [animalId],
      taskType: "BreedingFollowUp",
      status: "Pending",
    }),
  });
  Task.find = () => ({
    session: () => [],
    lean: async () => [],
  });
  Task.updateOne = async () => ({ modifiedCount: 1 });
  Task.findOneAndUpdate = () => ({
    session: async () => ({
      _id: taskId,
      technicianId,
      farmerId,
      animalIds: [animalId],
      taskType: "BreedingFollowUp",
      status: "Completed",
    }),
  });
  User.findById = async () => ({
    _id: farmerId,
    name: "Farmer Juan",
    phoneNumber: "09123456789",
  });
  User.findOne = () => ({
    select: () => ({
      lean: async () => null,
    }),
    lean: async () => null,
  });
  Notification.findOneAndUpdate = async () => null;
  AnimalTimelineEvent.create = async () => ({});
  AuditLog.create = async () => ({});
  inngest.send = async () => ({});
});

test.afterEach(() => {
  mongoose.startSession = originalMongooseStartSession;
  Config.findOne = originalConfigFindOne;
  Pregnancy.findOne = originalPregnancyFindOne;
  Pregnancy.create = originalPregnancyCreate;
  Insemination.findOne = originalInseminationFindOne;
  Insemination.findById = originalInseminationFindById;
  Insemination.findOneAndUpdate = originalInseminationFindOneAndUpdate;
  Animal.findById = originalAnimalFindById;
  Animal.findOne = originalAnimalFindOne;
  Animal.findByIdAndUpdate = originalAnimalFindByIdAndUpdate;
  Task.findOne = originalTaskFindOne;
  Task.find = originalTaskFind;
  Task.updateOne = originalTaskUpdateOne;
  Task.findOneAndUpdate = originalTaskFindOneAndUpdate;
  User.findById = originalUserFindById;
  User.findOne = originalUserFindOne;
  Notification.findOneAndUpdate = originalNotificationFindOneAndUpdate;
  AnimalTimelineEvent.create = originalTimelineCreate;
  AuditLog.create = originalAuditLogCreate;
  inngest.send = originalInngestSend;
  cloudinary.uploader.upload = originalUpload;
  cloudinary.uploader.destroy = originalDestroy;
});

// ============================================================================
// A. FARMER BREEDING / RETURN-TO-HEAT EVIDENCE
// ============================================================================

test("1. Farmer observation with 0 evidence photos succeeds", async () => {
  const mockInsem = createMockInsemination();
  Insemination.findOne = () => ({ populate: async () => mockInsem });

  const { req, res } = mockReqRes({}, {
    reportType: "possible_pregnancy",
    signs: ["no_heat"],
    notes: "No signs of heat observed",
    evidencePhotos: [],
  }, "farmer");

  await submitFarmerBreedingObservation(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(mockInsem.evidencePhotos, []);
});

test("2. Farmer observation: 1 base64 evidence photo uploads to breeding_evidence folder and persists HTTPS", async () => {
  const uploadedFolders = [];
  cloudinary.uploader.upload = async (dataUri, options) => {
    uploadedFolders.push(options.folder);
    return {
      secure_url: "https://res.cloudinary.com/demo/image/upload/v1/breeding_evidence/obs-1.jpg",
      public_id: "breeding_evidence/obs-1",
    };
  };

  const mockInsem = createMockInsemination();
  Insemination.findOne = () => ({ populate: async () => mockInsem });

  const { req, res } = mockReqRes({}, {
    reportType: "return_to_heat",
    signs: ["standing_heat"],
    notes: "Observed standing heat with evidence",
    evidencePhotos: [validBase64Image(1)],
  }, "farmer");

  await submitFarmerBreedingObservation(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(uploadedFolders.length, 1);
  assert.equal(uploadedFolders[0], "breeding_evidence");
  assert.deepEqual(mockInsem.evidencePhotos, [
    "https://res.cloudinary.com/demo/image/upload/v1/breeding_evidence/obs-1.jpg",
  ]);
});

test("3. Farmer observation: max allowed evidence photos (3) upload successfully and preserve order", async () => {
  let uploadCount = 0;
  cloudinary.uploader.upload = async (dataUri, options) => {
    assert.equal(options.folder, "breeding_evidence");
    uploadCount += 1;
    return {
      secure_url: `https://res.cloudinary.com/demo/image/upload/v1/breeding_evidence/photo-${uploadCount}.jpg`,
      public_id: `breeding_evidence/photo-${uploadCount}`,
    };
  };

  const mockInsem = createMockInsemination();
  Insemination.findOne = () => ({ populate: async () => mockInsem });

  const photosInput = [1, 2, 3].map((i) => validBase64Image(i));
  const { req, res } = mockReqRes({}, {
    reportType: "return_to_heat",
    evidencePhotos: photosInput,
  }, "farmer");

  await submitFarmerBreedingObservation(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(uploadCount, 3);
  assert.equal(mockInsem.evidencePhotos.length, 3);
  for (let i = 0; i < 3; i++) {
    assert.equal(
      mockInsem.evidencePhotos[i],
      `https://res.cloudinary.com/demo/image/upload/v1/breeding_evidence/photo-${i + 1}.jpg`,
    );
  }
});

test("4. Farmer observation: over-limit (>3) evidence photos rejected before unnecessary uploads", async () => {
  let uploadCalled = false;
  cloudinary.uploader.upload = async () => {
    uploadCalled = true;
    return {};
  };

  const mockInsem = createMockInsemination();
  Insemination.findOne = () => ({ populate: async () => mockInsem });

  const photosInput = [1, 2, 3, 4].map((i) => validBase64Image(i));
  const { req, res } = mockReqRes({}, {
    reportType: "return_to_heat",
    evidencePhotos: photosInput,
  }, "farmer");

  await submitFarmerBreedingObservation(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "TOO_MANY_PHOTOS");
  assert.equal(uploadCalled, false);
});

test("5. Farmer observation: malformed evidence rejected without updating Insemination", async () => {
  const mockInsem = createMockInsemination({ evidencePhotos: ["existing-untouched.jpg"] });
  Insemination.findOne = () => ({ populate: async () => mockInsem });

  const { req, res } = mockReqRes({}, {
    reportType: "return_to_heat",
    evidencePhotos: ["data:image/jpeg;base64,invalid-payload!?*"],
  }, "farmer");

  await submitFarmerBreedingObservation(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "MALFORMED_IMAGE");
  assert.deepEqual(mockInsem.evidencePhotos, ["existing-untouched.jpg"]);
});

test("6. Farmer observation: Timeline receives the SAME normalized HTTPS URL without re-uploading", async () => {
  let uploadCalls = 0;
  cloudinary.uploader.upload = async () => {
    uploadCalls += 1;
    return {
      secure_url: "https://res.cloudinary.com/demo/image/upload/v1/breeding_evidence/shared.jpg",
      public_id: "breeding_evidence/shared",
    };
  };

  let timelineAttachments = null;
  AnimalTimelineEvent.create = async (payload) => {
    timelineAttachments = payload.attachments;
    return {};
  };

  const mockInsem = createMockInsemination();
  Insemination.findOne = () => ({ populate: async () => mockInsem });

  const { req, res } = mockReqRes({}, {
    reportType: "possible_pregnancy",
    evidencePhotos: [validBase64Image(1)],
  }, "farmer");

  await submitFarmerBreedingObservation(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(uploadCalls, 1); // Uploaded only ONCE
  assert.deepEqual(mockInsem.evidencePhotos, [
    "https://res.cloudinary.com/demo/image/upload/v1/breeding_evidence/shared.jpg",
  ]);
  assert.deepEqual(timelineAttachments, mockInsem.evidencePhotos); // Exact same array value
});

test("7. Farmer observation: upload failure does not persist evidence or mutate status", async () => {
  cloudinary.uploader.upload = async () => {
    throw new Error("Cloudinary connection failed");
  };

  let saved = false;
  const mockInsem = createMockInsemination({
    save: async function () {
      saved = true;
      return this;
    },
  });
  Insemination.findOne = () => ({ populate: async () => mockInsem });

  const { req, res } = mockReqRes({}, {
    reportType: "return_to_heat",
    evidencePhotos: [validBase64Image(1)],
  }, "farmer");

  await submitFarmerBreedingObservation(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(saved, false);
});

test("8. Farmer observation: remains non-authoritative and CANNOT mark animal Pregnant", async () => {
  cloudinary.uploader.upload = async () => ({
    secure_url: "https://res.cloudinary.com/demo/image/upload/v1/breeding_evidence/obs.jpg",
    public_id: "breeding_evidence/obs",
  });

  const animalRecord = { ...mockAnimal, reproductiveStatus: "Inseminated" };
  Animal.findById = async () => animalRecord;

  const mockInsem = createMockInsemination();
  Insemination.findOne = () => ({ populate: async () => mockInsem });

  const { req, res } = mockReqRes({}, {
    reportType: "possible_pregnancy",
    signs: ["no_heat"],
    evidencePhotos: [validBase64Image(1)],
  }, "farmer");

  await submitFarmerBreedingObservation(req, res);

  assert.equal(res.statusCode, 200);
  // Animal reproductiveStatus MUST NOT be Pregnant
  assert.notEqual(animalRecord.reproductiveStatus, "Pregnant");
  assert.notEqual(mockInsem.outcome, "Pregnant");
});

// ============================================================================
// B. TECHNICIAN BREEDING VERIFICATION EVIDENCE
// ============================================================================

test("9. Technician verification: base64 evidence uploads to Cloudinary and appends to evidencePhotos", async () => {
  cloudinary.uploader.upload = async () => ({
    secure_url: "https://res.cloudinary.com/demo/image/upload/v1/breeding_evidence/tech-verify.jpg",
    public_id: "breeding_evidence/tech-verify",
  });

  let appendedPhotos = null;
  Insemination.findOneAndUpdate = async (query, update) => {
    appendedPhotos = update.$push?.evidencePhotos?.$each;
    return createMockInsemination({
      status: "done",
      outcome: "Failed (Re-heat)",
      evidencePhotos: [
        "https://example.com/farmer-old.jpg",
        ...(appendedPhotos || []),
      ],
    });
  };

  const mockInsem = createMockInsemination({
    farmerOutcomeReport: "return_to_heat",
    evidencePhotos: ["https://example.com/farmer-old.jpg"],
  });
  Insemination.findOne = () => ({ populate: async () => mockInsem });

  let timelineAttachments = null;
  AnimalTimelineEvent.create = async (payload) => {
    timelineAttachments = payload.attachments;
    return {};
  };

  const { req, res } = mockReqRes({}, {
    verificationResult: "return_to_heat",
    checkMethod: "clinical_examination",
    checkedAt: new Date().toISOString(),
    technicianNotes: "Verified standing heat in person",
    evidencePhotos: [validBase64Image(2)],
  }, "technician");

  await verifyFarmerBreedingObservation(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(appendedPhotos, [
    "https://res.cloudinary.com/demo/image/upload/v1/breeding_evidence/tech-verify.jpg",
  ]);
  // Timeline uses the exact same new evidence URL
  assert.deepEqual(timelineAttachments, [
    "https://res.cloudinary.com/demo/image/upload/v1/breeding_evidence/tech-verify.jpg",
  ]);
});

test("10. Technician verification service: direct call with base64 throws BASE64_PERSISTENCE_FORBIDDEN", async () => {
  const insem = createMockInsemination();
  await assert.rejects(
    persistBreedingObservationVerification({
      animal: mockAnimal,
      insemination: insem,
      verificationResult: "return_to_heat",
      checkMethod: "clinical_examination",
      checkedAt: new Date(),
      evidencePhotos: [validBase64Image(1)],
      actor: { _id: technicianId, role: "technician" },
    }),
    (err) => err.code === "BASE64_PERSISTENCE_FORBIDDEN",
  );
});

// ============================================================================
// C. FARMER PREGNANCY REPORT
// ============================================================================

test("11. Farmer pregnancy report: base64 evidence uploads to breeding_evidence and stores in farmerPregnancyPhotos", async () => {
  cloudinary.uploader.upload = async () => ({
    secure_url: "https://res.cloudinary.com/demo/image/upload/v1/breeding_evidence/preg-report.jpg",
    public_id: "breeding_evidence/preg-report",
  });

  const mockInsem = createMockInsemination({
    evidencePhotos: ["https://example.com/initial-observation.jpg"],
    farmerPregnancyPhotos: [],
  });
  Insemination.findOne = () => ({ populate: async () => mockInsem });

  let timelineAttachments = null;
  AnimalTimelineEvent.create = async (payload) => {
    timelineAttachments = payload.attachments;
    return {};
  };

  const { req, res } = mockReqRes({}, {
    notes: "Abdominal swelling and positive behavior",
    evidencePhotos: [validBase64Image(3)],
  }, "farmer");

  await submitFarmerPregnancyReport(req, res);

  assert.equal(res.statusCode, 200);
  // Stored strictly in farmerPregnancyPhotos
  assert.deepEqual(mockInsem.farmerPregnancyPhotos, [
    "https://res.cloudinary.com/demo/image/upload/v1/breeding_evidence/preg-report.jpg",
  ]);
  // Did NOT overwrite evidencePhotos
  assert.deepEqual(mockInsem.evidencePhotos, [
    "https://example.com/initial-observation.jpg",
  ]);
  // Timeline reuses the exact same URL
  assert.deepEqual(timelineAttachments, mockInsem.farmerPregnancyPhotos);
});

test("12. Farmer pregnancy report: over-limit (>3) evidence photos rejected before unnecessary uploads", async () => {
  let uploadCalled = false;
  cloudinary.uploader.upload = async () => {
    uploadCalled = true;
    return {};
  };

  const mockInsem = createMockInsemination();
  Insemination.findOne = () => ({ populate: async () => mockInsem });

  const photosInput = [1, 2, 3, 4].map((i) => validBase64Image(i));
  const { req, res } = mockReqRes({}, {
    notes: "Too many photos test",
    evidencePhotos: photosInput,
  }, "farmer");

  await submitFarmerPregnancyReport(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "TOO_MANY_PHOTOS");
  assert.equal(uploadCalled, false);
});

test("13. Farmer pregnancy report: remains non-authoritative and does NOT confirm pregnancy", async () => {
  cloudinary.uploader.upload = async () => ({
    secure_url: "https://res.cloudinary.com/demo/image/upload/v1/breeding_evidence/preg.jpg",
    public_id: "breeding_evidence/preg",
  });

  const animalRecord = { ...mockAnimal, reproductiveStatus: "Inseminated" };
  Animal.findById = async () => animalRecord;

  const mockInsem = createMockInsemination();
  Insemination.findOne = () => ({ populate: async () => mockInsem });

  const { req, res } = mockReqRes({}, {
    notes: "Farmer claims animal is pregnant",
    evidencePhotos: [validBase64Image(1)],
  }, "farmer");

  await submitFarmerPregnancyReport(req, res);

  assert.equal(res.statusCode, 200);
  assert.notEqual(animalRecord.reproductiveStatus, "Pregnant");
  assert.equal(mockInsem.pregnancyReportVerificationStatus, "pending");
});

// ============================================================================
// D. CLEANUP BOUNDARIES & FAILURE SAFETY
// ============================================================================

test("14. Partial Cloudinary upload failure cleans up only newly uploaded assets", async () => {
  const destroyedIds = [];
  cloudinary.uploader.destroy = async (publicId) => {
    destroyedIds.push(publicId);
    return { result: "ok" };
  };

  let call = 0;
  cloudinary.uploader.upload = async () => {
    call += 1;
    if (call === 2) {
      throw new Error("Network timeout during 2nd image upload");
    }
    return {
      secure_url: `https://res.cloudinary.com/demo/image/upload/v1/breeding_evidence/img-${call}.jpg`,
      public_id: `breeding_evidence/img-${call}`,
    };
  };

  const mockInsem = createMockInsemination();
  Insemination.findOne = () => ({ populate: async () => mockInsem });

  const photosInput = [1, 2].map((i) => validBase64Image(i));
  const { req, res } = mockReqRes({}, {
    reportType: "return_to_heat",
    evidencePhotos: photosInput,
  }, "farmer");

  await submitFarmerBreedingObservation(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(destroyedIds, ["breeding_evidence/img-1"]);
});

test("15. DB persistence failure cleans newly uploaded Cloudinary assets", async () => {
  const destroyedIds = [];
  cloudinary.uploader.upload = async () => ({
    secure_url: "https://res.cloudinary.com/demo/image/upload/v1/breeding_evidence/orphan.jpg",
    public_id: "breeding_evidence/orphan-id",
  });
  cloudinary.uploader.destroy = async (publicId) => {
    destroyedIds.push(publicId);
    return { result: "ok" };
  };

  const mockInsem = createMockInsemination({
    save: async () => {
      throw new Error("MongoDB write connection dropped");
    },
  });
  Insemination.findOne = () => ({ populate: async () => mockInsem });

  const { req, res } = mockReqRes({}, {
    reportType: "return_to_heat",
    evidencePhotos: [validBase64Image(1)],
  }, "farmer");

  await submitFarmerBreedingObservation(req, res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(destroyedIds, ["breeding_evidence/orphan-id"]);
});

test("16. Non-transactional cleanup boundary: timeline failure does NOT delete persisted evidence", async () => {
  const destroyedIds = [];
  cloudinary.uploader.upload = async () => ({
    secure_url: "https://res.cloudinary.com/demo/image/upload/v1/breeding_evidence/persisted.jpg",
    public_id: "breeding_evidence/persisted-id",
  });
  cloudinary.uploader.destroy = async (publicId) => {
    destroyedIds.push(publicId);
    return { result: "ok" };
  };

  let insemSaved = false;
  const mockInsem = createMockInsemination({
    save: async function () {
      insemSaved = true;
      return this;
    },
  });
  Insemination.findOne = () => ({ populate: async () => mockInsem });

  // Timeline event failure simulates downstream non-authoritative failure
  AnimalTimelineEvent.create = async () => {
    throw new Error("Timeline service error");
  };

  const { req, res } = mockReqRes({}, {
    reportType: "return_to_heat",
    evidencePhotos: [validBase64Image(1)],
  }, "farmer");

  await submitFarmerBreedingObservation(req, res);

  // Persistence succeeded, so asset belongs to Insemination and is NOT destroyed!
  assert.equal(insemSaved, true);
  assert.deepEqual(destroyedIds, []);
});

test("17. Non-transactional cleanup boundary: animal.save failure does NOT delete persisted Insemination evidence", async () => {
  const destroyedIds = [];
  cloudinary.uploader.upload = async () => ({
    secure_url: "https://res.cloudinary.com/demo/image/upload/v1/breeding_evidence/persisted-animal.jpg",
    public_id: "breeding_evidence/persisted-animal-id",
  });
  cloudinary.uploader.destroy = async (publicId) => {
    destroyedIds.push(publicId);
    return { result: "ok" };
  };

  let insemSaved = false;
  const mockInsem = createMockInsemination({
    save: async function () {
      insemSaved = true;
      return this;
    },
  });
  Insemination.findOne = () => ({ populate: async () => mockInsem });

  Animal.findById = async () => ({
    ...mockAnimal,
    save: async () => {
      throw new Error("Animal collection lock timeout");
    },
  });

  const { req, res } = mockReqRes({}, {
    reportType: "possible_pregnancy",
    evidencePhotos: [validBase64Image(1)],
  }, "farmer");

  await submitFarmerBreedingObservation(req, res);

  assert.equal(insemSaved, true);
  // Assets must NOT be destroyed because Insemination already holds them
  assert.deepEqual(destroyedIds, []);
});
