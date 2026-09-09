import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import cloudinary from "../src/config/cloudinary.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Animal } from "../src/models/animal.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Task } from "../src/models/task.model.js";
import { User } from "../src/models/user.model.js";
import { AnimalTimelineEvent } from "../src/models/animal-timeline-event.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import { createAIRequest } from "../src/controllers/ai-request.controllers.js";
import { createAIRequestWithGuard } from "../src/services/ai-request-creation.service.js";

const originalInseminationFindOne = Insemination.findOne;
const originalInseminationCreate = Insemination.create;
const originalAnimalFindOne = Animal.findOne;
const originalPregnancyFindOne = Pregnancy.findOne;
const originalTaskFind = Task.find;
const originalUserFind = User.find;
const originalUserFindOne = User.findOne;
const originalTimelineCreate = AnimalTimelineEvent.create;
const originalAuditLogCreate = AuditLog.create;
const originalUpload = cloudinary.uploader.upload;
const originalDestroy = cloudinary.uploader.destroy;

const farmerId = new mongoose.Types.ObjectId();
const animalId = new mongoose.Types.ObjectId();

const mockAnimal = {
  _id: animalId,
  farmerId,
  animalId: "ANM-001",
  earTag: "TAG-001",
  gender: "Female",
  species: "Cattle",
  birthDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000 * 3), // 3 years old
  reproductiveStatus: "Open",
};

const validBase64Image = (n = 1) =>
  `data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk${n}A8AAQUBAScY42YAAAAASUVORK5CYII=`;

const mockReqRes = (body = {}) => {
  const req = {
    user: {
      _id: farmerId,
      role: "farmer",
      address: { barangay: "Balabag", municipality: "Pavilion" },
    },
    body: {
      animalId: animalId.toString(),
      heatSigns: ["standing_heat", "mucus_discharge"],
      comment: "Observed in standing heat",
      ...body,
    },
    app: {
      get: (key) => {
        if (key === "io") {
          return { emit: () => {} };
        }
        return null;
      },
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
  Animal.findOne = async () => mockAnimal;

  const nullQuery = () => {
    const p = Promise.resolve(null);
    p.sort = () => {
      const sp = Promise.resolve(null);
      sp.session = () => Promise.resolve(null);
      sp.lean = () => Promise.resolve(null);
      return sp;
    };
    p.lean = () => Promise.resolve(null);
    p.session = () => Promise.resolve(null);
    return p;
  };

  const emptyArrayQuery = () => {
    const p = Promise.resolve([]);
    p.sort = () => {
      const sp = Promise.resolve([]);
      sp.lean = () => Promise.resolve([]);
      return sp;
    };
    p.lean = () => Promise.resolve([]);
    return p;
  };

  Insemination.findOne = () => nullQuery();
  Pregnancy.findOne = () => nullQuery();
  Task.find = () => emptyArrayQuery();
  User.find = () => ({
    lean: async () => [],
    select: () => ({ lean: async () => [] }),
  });
  User.findOne = async () => null;
  AnimalTimelineEvent.create = async () => ({});
  AuditLog.create = async () => ({});
});

test.afterEach(() => {
  Insemination.findOne = originalInseminationFindOne;
  Insemination.create = originalInseminationCreate;
  Animal.findOne = originalAnimalFindOne;
  Pregnancy.findOne = originalPregnancyFindOne;
  Task.find = originalTaskFind;
  User.find = originalUserFind;
  User.findOne = originalUserFindOne;
  AnimalTimelineEvent.create = originalTimelineCreate;
  AuditLog.create = originalAuditLogCreate;
  cloudinary.uploader.upload = originalUpload;
  cloudinary.uploader.destroy = originalDestroy;
});

test("1. AI request with 0 photos still works", async () => {
  let createdPayload = null;
  Insemination.create = async (payload) => {
    createdPayload = payload;
    return { _id: "ai-0", attemptNumber: 1, ...payload };
  };

  const { req, res } = mockReqRes({ photos: [] });
  await createAIRequest(req, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body.request.photos, []);
  assert.equal(res.body.request.imageUrl, "");
  assert.deepEqual(createdPayload.photos, []);
  assert.equal(createdPayload.imageUrl, "");
});

test("2. AI request with 1 base64 photo uploads to ai_requests folder and persists HTTPS", async () => {
  let createdPayload = null;
  const uploadedFolders = [];

  cloudinary.uploader.upload = async (dataUri, options) => {
    uploadedFolders.push(options.folder);
    const secure_url =
      "https://res.cloudinary.com/demo/image/upload/v1/ai_requests/img-1.jpg";
    return {
      secure_url,
      public_id: "ai_requests/img-1",
    };
  };

  Insemination.create = async (payload) => {
    createdPayload = payload;
    return { _id: "ai-1", attemptNumber: 1, ...payload };
  };

  const { req, res } = mockReqRes({
    photos: [validBase64Image(1)],
  });
  await createAIRequest(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(uploadedFolders.length, 1);
  assert.equal(uploadedFolders[0], "ai_requests");
  assert.deepEqual(createdPayload.photos, [
    "https://res.cloudinary.com/demo/image/upload/v1/ai_requests/img-1.jpg",
  ]);
  assert.equal(
    createdPayload.imageUrl,
    "https://res.cloudinary.com/demo/image/upload/v1/ai_requests/img-1.jpg",
  );
});

test("3. maximum supported AI photos (5) upload successfully and preserve order", async () => {
  let uploadCount = 0;
  cloudinary.uploader.upload = async (dataUri, options) => {
    assert.equal(options.folder, "ai_requests");
    uploadCount += 1;
    return {
      secure_url: `https://res.cloudinary.com/demo/image/upload/v1/ai_requests/photo-${uploadCount}.jpg`,
      public_id: `ai_requests/photo-${uploadCount}`,
    };
  };

  let createdPayload = null;
  Insemination.create = async (payload) => {
    createdPayload = payload;
    return { _id: "ai-5", attemptNumber: 1, ...payload };
  };

  const photosInput = [1, 2, 3, 4, 5].map((i) => validBase64Image(i));
  const { req, res } = mockReqRes({ photos: photosInput });
  await createAIRequest(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(uploadCount, 5);
  assert.equal(createdPayload.photos.length, 5);
  for (let i = 0; i < 5; i++) {
    assert.equal(
      createdPayload.photos[i],
      `https://res.cloudinary.com/demo/image/upload/v1/ai_requests/photo-${i + 1}.jpg`,
    );
  }
  assert.equal(
    createdPayload.imageUrl,
    "https://res.cloudinary.com/demo/image/upload/v1/ai_requests/photo-1.jpg",
  );
});

test("4. over-limit photo count is rejected before unnecessary uploads", async () => {
  let uploadCalled = false;
  cloudinary.uploader.upload = async () => {
    uploadCalled = true;
    return {};
  };

  const photosInput = [1, 2, 3, 4, 5, 6].map((i) => validBase64Image(i));
  const { req, res } = mockReqRes({ photos: photosInput });
  await createAIRequest(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "TOO_MANY_PHOTOS");
  assert.equal(uploadCalled, false);
});

test("5. malformed data URI is rejected without creating Insemination", async () => {
  let created = false;
  Insemination.create = async () => {
    created = true;
    return {};
  };

  const { req, res } = mockReqRes({
    photos: ["data:image/jpeg;base64,invalid-payload-characters!?*"],
  });
  await createAIRequest(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "MALFORMED_IMAGE");
  assert.equal(created, false);
});

test("6. persisted photos contain HTTPS URLs and 7. persisted imageUrl equals first URL", async () => {
  cloudinary.uploader.upload = async () => ({
    secure_url:
      "https://res.cloudinary.com/demo/image/upload/v1/ai_requests/secure.jpg",
    public_id: "ai_requests/secure",
  });

  let persisted = null;
  Insemination.create = async (payload) => {
    persisted = payload;
    return { _id: "ai-test", attemptNumber: 1, ...payload };
  };

  const { req, res } = mockReqRes({ photos: [validBase64Image()] });
  await createAIRequest(req, res);

  assert.equal(res.statusCode, 201);
  assert.ok(persisted.photos[0].startsWith("https://"));
  assert.equal(persisted.imageUrl, persisted.photos[0]);
});

test("8. no new AI request photo field starts with data:image/", async () => {
  // Directly calling createAIRequestWithGuard with base64 must be rejected
  await assert.rejects(
    createAIRequestWithGuard({
      farmerId,
      animalId,
      status: "pending",
      photos: [validBase64Image()],
    }),
    (err) => err.code === "BASE64_PERSISTENCE_FORBIDDEN",
  );

  await assert.rejects(
    createAIRequestWithGuard({
      farmerId,
      animalId,
      status: "pending",
      imageUrl: validBase64Image(),
      photos: [],
    }),
    (err) => err.code === "BASE64_PERSISTENCE_FORBIDDEN",
  );
});

test("9. upload failure does not create Insemination", async () => {
  cloudinary.uploader.upload = async () => {
    throw new Error("Cloudinary upload failed");
  };

  let created = false;
  Insemination.create = async () => {
    created = true;
    return {};
  };

  const { req, res } = mockReqRes({ photos: [validBase64Image()] });
  await createAIRequest(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(created, false);
});

test("10. partial upload failure cleans newly uploaded assets", async () => {
  const destroyedIds = [];
  cloudinary.uploader.destroy = async (publicId) => {
    destroyedIds.push(publicId);
    return { result: "ok" };
  };

  let call = 0;
  cloudinary.uploader.upload = async () => {
    call += 1;
    if (call === 2) {
      throw new Error("Network failure on 2nd upload");
    }
    return {
      secure_url: `https://res.cloudinary.com/demo/image/upload/v1/ai_requests/img-${call}.jpg`,
      public_id: `ai_requests/img-${call}`,
    };
  };

  const photosInput = [1, 2].map((i) => validBase64Image(i));
  const { req, res } = mockReqRes({ photos: photosInput });
  await createAIRequest(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(destroyedIds, ["ai_requests/img-1"]);
});

test("11. existing Cloudinary URL is not re-uploaded", async () => {
  let uploadCalls = 0;
  cloudinary.uploader.upload = async () => {
    uploadCalls += 1;
    return {};
  };

  let createdPayload = null;
  Insemination.create = async (payload) => {
    createdPayload = payload;
    return { _id: "ai-cloud", attemptNumber: 1, ...payload };
  };

  const existingUrl =
    "https://res.cloudinary.com/demo/image/upload/v12345/ai_requests/existing.jpg";
  const { req, res } = mockReqRes({
    photos: [existingUrl],
  });
  await createAIRequest(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(uploadCalls, 0);
  assert.deepEqual(createdPayload.photos, [existingUrl]);
  assert.equal(createdPayload.imageUrl, existingUrl);
});

test("12. persistence/duplicate-guard failure cleans newly uploaded assets", async () => {
  const destroyedIds = [];
  cloudinary.uploader.upload = async () => ({
    secure_url:
      "https://res.cloudinary.com/demo/image/upload/v1/ai_requests/temp.jpg",
    public_id: "ai_requests/temp-id",
  });
  cloudinary.uploader.destroy = async (publicId) => {
    destroyedIds.push(publicId);
    return { result: "ok" };
  };

  Insemination.create = async () => {
    throw new Error("MongoDB duplicate activeRequestKey collision");
  };

  const { req, res } = mockReqRes({ photos: [validBase64Image()] });
  await createAIRequest(req, res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(destroyedIds, ["ai_requests/temp-id"]);
});

test("13. early duplicate check rejects before Cloudinary upload", async () => {
  let uploadCalled = false;
  cloudinary.uploader.upload = async () => {
    uploadCalled = true;
    return {};
  };

  Insemination.findOne = () => ({
    sort: () => ({
      lean: async () => ({ _id: "active-existing", status: "pending" }),
      session: () => ({ _id: "active-existing", status: "pending" }),
      exec: async () => ({ _id: "active-existing", status: "pending" }),
    }),
    lean: async () => ({ _id: "active-existing", status: "pending" }),
    then: (resolve) => resolve({ _id: "active-existing", status: "pending" }),
  });

  const { req, res } = mockReqRes({ photos: [validBase64Image()] });
  await createAIRequest(req, res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "ACTIVE_AI_REQUEST_EXISTS");
  assert.equal(uploadCalled, false);
});

test("14. Post-persistence cleanup boundary: later non-persistence failure does NOT clean up assets", async () => {
  const destroyedIds = [];
  cloudinary.uploader.upload = async () => ({
    secure_url:
      "https://res.cloudinary.com/demo/image/upload/v1/ai_requests/persisted.jpg",
    public_id: "ai_requests/persisted-id",
  });
  cloudinary.uploader.destroy = async (publicId) => {
    destroyedIds.push(publicId);
    return { result: "ok" };
  };

  Insemination.create = async (payload) => ({
    _id: "persisted-ai-1",
    attemptNumber: 1,
    ...payload,
  });

  // Timeline event failure simulates a post-create side effect error
  AnimalTimelineEvent.create = async () => {
    throw new Error("Timeline side effect failed");
  };

  const { req, res } = mockReqRes({ photos: [validBase64Image()] });
  await createAIRequest(req, res);

  // Since Insemination was successfully created, the Cloudinary asset is NOT destroyed
  assert.deepEqual(destroyedIds, []);
});

test("imageUrl fallback: photos: [] does not discard valid imageUrl", async () => {
  cloudinary.uploader.upload = async () => ({
    secure_url:
      "https://res.cloudinary.com/demo/image/upload/v1/ai_requests/from-img-url.jpg",
    public_id: "ai_requests/from-img-url",
  });

  let createdPayload = null;
  Insemination.create = async (payload) => {
    createdPayload = payload;
    return { _id: "ai-fallback", attemptNumber: 1, ...payload };
  };

  const { req, res } = mockReqRes({
    photos: [],
    imageUrl: validBase64Image(),
  });
  await createAIRequest(req, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(createdPayload.photos, [
    "https://res.cloudinary.com/demo/image/upload/v1/ai_requests/from-img-url.jpg",
  ]);
  assert.equal(
    createdPayload.imageUrl,
    "https://res.cloudinary.com/demo/image/upload/v1/ai_requests/from-img-url.jpg",
  );
});
