import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import cloudinary from "../src/config/cloudinary.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { Animal } from "../src/models/animal.model.js";
import { User } from "../src/models/user.model.js";
import { createHealthRequest } from "../src/controllers/health-request.controllers.js";
import { createHealthRequestWithGuard } from "../src/services/health-request-creation.service.js";
import {
  isCloudinaryUrl,
  isValidImageDataUri,
  uploadImages,
  cleanupUploadedAssets,
} from "../src/services/image-upload.service.js";

const originalFindOne = HealthRequest.findOne;
const originalCreate = HealthRequest.create;
const originalAnimalFindOne = Animal.findOne;
const originalUserFind = User.find;
const originalUserFindOne = User.findOne;
const originalUpload = cloudinary.uploader.upload;
const originalDestroy = cloudinary.uploader.destroy;

const farmerId = new mongoose.Types.ObjectId();
const animalId = new mongoose.Types.ObjectId();

const mockAnimal = {
  _id: animalId,
  farmerId,
  animalId: "ANM-001",
  earTag: "TAG-001",
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
      symptoms: "Fever and loss of appetite",
      urgency: "medium",
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
  HealthRequest.findOne = () => ({
    sort: async () => null,
  });
  User.find = () => ({
    lean: async () => [],
    select: () => ({ lean: async () => [] }),
  });
  User.findOne = async () => null;
});

test.afterEach(() => {
  HealthRequest.findOne = originalFindOne;
  HealthRequest.create = originalCreate;
  Animal.findOne = originalAnimalFindOne;
  User.find = originalUserFind;
  User.findOne = originalUserFindOne;
  cloudinary.uploader.upload = originalUpload;
  cloudinary.uploader.destroy = originalDestroy;
});

test("1. Health Request with 0 photos still works", async () => {
  let createdPayload = null;
  HealthRequest.create = async (payload) => {
    createdPayload = payload;
    return { _id: "health-0", ...payload };
  };

  const { req, res } = mockReqRes({ photos: [] });
  await createHealthRequest(req, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body.request.photos, []);
  assert.equal(res.body.request.imageUrl, "");
  assert.deepEqual(createdPayload.photos, []);
  assert.equal(createdPayload.imageUrl, "");
});

test("2. 1 base64 photo uploads to Cloudinary", async () => {
  let createdPayload = null;
  const uploadedUrls = [];

  cloudinary.uploader.upload = async (dataUri, options) => {
    assert.equal(options.folder, "health_requests");
    const secure_url = "https://res.cloudinary.com/demo/image/upload/v1/health_requests/img-1.jpg";
    uploadedUrls.push(secure_url);
    return {
      secure_url,
      public_id: "health_requests/img-1",
    };
  };

  HealthRequest.create = async (payload) => {
    createdPayload = payload;
    return { _id: "health-1", ...payload };
  };

  const { req, res } = mockReqRes({
    photos: [validBase64Image(1)],
  });
  await createHealthRequest(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(uploadedUrls.length, 1);
  assert.deepEqual(createdPayload.photos, [
    "https://res.cloudinary.com/demo/image/upload/v1/health_requests/img-1.jpg",
  ]);
  assert.equal(
    createdPayload.imageUrl,
    "https://res.cloudinary.com/demo/image/upload/v1/health_requests/img-1.jpg",
  );
});

test("3. 5 base64 photos upload successfully and preserve order", async () => {
  let uploadCount = 0;
  cloudinary.uploader.upload = async (dataUri, options) => {
    uploadCount += 1;
    return {
      secure_url: `https://res.cloudinary.com/demo/image/upload/v1/health_requests/photo-${uploadCount}.jpg`,
      public_id: `health_requests/photo-${uploadCount}`,
    };
  };

  let createdPayload = null;
  HealthRequest.create = async (payload) => {
    createdPayload = payload;
    return { _id: "health-5", ...payload };
  };

  const photosInput = [1, 2, 3, 4, 5].map((i) => validBase64Image(i));
  const { req, res } = mockReqRes({ photos: photosInput });
  await createHealthRequest(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(uploadCount, 5);
  assert.equal(createdPayload.photos.length, 5);
  for (let i = 0; i < 5; i++) {
    assert.equal(
      createdPayload.photos[i],
      `https://res.cloudinary.com/demo/image/upload/v1/health_requests/photo-${i + 1}.jpg`,
    );
  }
  assert.equal(
    createdPayload.imageUrl,
    "https://res.cloudinary.com/demo/image/upload/v1/health_requests/photo-1.jpg",
  );
});

test("4. >5 photos still rejected", async () => {
  let uploadCalled = false;
  cloudinary.uploader.upload = async () => {
    uploadCalled = true;
    return {};
  };

  const photosInput = [1, 2, 3, 4, 5, 6].map((i) => validBase64Image(i));
  const { req, res } = mockReqRes({ photos: photosInput });
  await createHealthRequest(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "TOO_MANY_PHOTOS");
  assert.equal(uploadCalled, false);
});

test("5. malformed data URI rejected without creating record", async () => {
  let created = false;
  HealthRequest.create = async () => {
    created = true;
    return {};
  };

  const { req, res } = mockReqRes({
    photos: ["data:image/jpeg;base64,not-valid-base64-content!?*"],
  });
  await createHealthRequest(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "MALFORMED_IMAGE");
  assert.equal(created, false);
});

test("6. persisted photos contain HTTPS URLs and 7. persisted imageUrl equals first HTTPS URL", async () => {
  cloudinary.uploader.upload = async () => ({
    secure_url: "https://res.cloudinary.com/demo/image/upload/v1/health_requests/persisted.jpg",
    public_id: "health_requests/persisted",
  });

  let persisted = null;
  HealthRequest.create = async (payload) => {
    persisted = payload;
    return { _id: "health-test", ...payload };
  };

  const { req, res } = mockReqRes({ photos: [validBase64Image()] });
  await createHealthRequest(req, res);

  assert.equal(res.statusCode, 201);
  assert.ok(persisted.photos[0].startsWith("https://"));
  assert.equal(persisted.imageUrl, persisted.photos[0]);
});

test("8. no new persisted photo starts with data:image/", async () => {
  // Directly invoking createHealthRequestWithGuard with base64 must be rejected
  await assert.rejects(
    createHealthRequestWithGuard({
      farmerId,
      animalId,
      requestType: "disease",
      symptoms: "Test symptoms",
      photos: [validBase64Image()],
    }),
    (err) => err.code === "BASE64_PERSISTENCE_FORBIDDEN",
  );

  await assert.rejects(
    createHealthRequestWithGuard({
      farmerId,
      animalId,
      requestType: "disease",
      symptoms: "Test symptoms",
      imageUrl: validBase64Image(),
      photos: [],
    }),
    (err) => err.code === "BASE64_PERSISTENCE_FORBIDDEN",
  );
});

test("9. upload failure does not create HealthRequest", async () => {
  cloudinary.uploader.upload = async () => {
    throw new Error("Cloudinary network timeout");
  };

  let created = false;
  HealthRequest.create = async () => {
    created = true;
    return {};
  };

  const { req, res } = mockReqRes({ photos: [validBase64Image()] });
  await createHealthRequest(req, res);

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
    if (call === 3) {
      throw new Error("Cloudinary error on 3rd image");
    }
    return {
      secure_url: `https://res.cloudinary.com/demo/image/upload/v1/health_requests/img-${call}.jpg`,
      public_id: `health_requests/img-${call}`,
    };
  };

  const photosInput = [1, 2, 3].map((i) => validBase64Image(i));
  const { req, res } = mockReqRes({ photos: photosInput });
  await createHealthRequest(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(destroyedIds, [
    "health_requests/img-1",
    "health_requests/img-2",
  ]);
});

test("11. existing Cloudinary URL is not re-uploaded unnecessarily", async () => {
  let uploadCalls = 0;
  cloudinary.uploader.upload = async () => {
    uploadCalls += 1;
    return {};
  };

  let createdPayload = null;
  HealthRequest.create = async (payload) => {
    createdPayload = payload;
    return { _id: "health-cloud", ...payload };
  };

  const existingUrl =
    "https://res.cloudinary.com/mycloud/image/upload/v12345/health_requests/existing.jpg";
  const { req, res } = mockReqRes({
    photos: [existingUrl],
  });
  await createHealthRequest(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(uploadCalls, 0); // Preserved without calling upload
  assert.deepEqual(createdPayload.photos, [existingUrl]);
  assert.equal(createdPayload.imageUrl, existingUrl);
});

test("12. persistence failure cleans all newly uploaded Cloudinary assets", async () => {
  const destroyedIds = [];
  cloudinary.uploader.upload = async () => ({
    secure_url: "https://res.cloudinary.com/demo/image/upload/v1/health_requests/temp.jpg",
    public_id: "health_requests/temp-id",
  });
  cloudinary.uploader.destroy = async (publicId) => {
    destroyedIds.push(publicId);
    return { result: "ok" };
  };

  HealthRequest.create = async () => {
    throw new Error("Database connection dropped during write");
  };

  const { req, res } = mockReqRes({ photos: [validBase64Image()] });
  await createHealthRequest(req, res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(destroyedIds, ["health_requests/temp-id"]);
});

test("imageUrl fallback: photos: [] does not discard valid imageUrl", async () => {
  cloudinary.uploader.upload = async () => ({
    secure_url: "https://res.cloudinary.com/demo/image/upload/v1/health_requests/from-img-url.jpg",
    public_id: "health_requests/from-img-url",
  });

  let createdPayload = null;
  HealthRequest.create = async (payload) => {
    createdPayload = payload;
    return { _id: "health-fallback", ...payload };
  };

  const { req, res } = mockReqRes({
    photos: [],
    imageUrl: validBase64Image(),
  });
  await createHealthRequest(req, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(createdPayload.photos, [
    "https://res.cloudinary.com/demo/image/upload/v1/health_requests/from-img-url.jpg",
  ]);
  assert.equal(
    createdPayload.imageUrl,
    "https://res.cloudinary.com/demo/image/upload/v1/health_requests/from-img-url.jpg",
  );
});
