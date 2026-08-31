import assert from "node:assert/strict";
import test from "node:test";

import {
  getAIRequestPhotos,
  normalizeSubmittedAIRequestPhotos,
} from "../src/domain/ai-request-attachments.js";
import { buildFarmerAIRequest } from "../src/domain/ai-request-presentation.js";
import { buildCandidateAIDetail } from "../src/controllers/ai-request.controllers.js";
import { createAIRequestWithGuard } from "../src/services/ai-request-creation.service.js";
import { Insemination } from "../src/models/insemination.model.js";

const originalFindOne = Insemination.findOne;
const originalCreate = Insemination.create;

test.afterEach(() => {
  Insemination.findOne = originalFindOne;
  Insemination.create = originalCreate;
});

test("canonical Insemination schema stores Farmer AI request photos", () => {
  const photosPath = Insemination.schema.path("photos");
  assert.ok(photosPath);
  assert.equal(photosPath.instance, "Array");
  assert.equal(photosPath.embeddedSchemaType.instance, "String");
});

test("AI submission normalization preserves all accepted unique photos", () => {
  assert.deepEqual(
    normalizeSubmittedAIRequestPhotos([
      " photo-1 ",
      "photo-2",
      "photo-1",
      "photo-3",
    ]),
    ["photo-1", "photo-2", "photo-3"],
  );
});

test("AI submission normalization preserves the five-photo validation contract", () => {
  assert.throws(
    () => normalizeSubmittedAIRequestPhotos(["1", "2", "3", "4", "5", "6"]),
    (error) => error.status === 400 && error.code === "TOO_MANY_PHOTOS",
  );
  assert.throws(
    () => normalizeSubmittedAIRequestPhotos(["photo", 2]),
    (error) => error.status === 400 && error.code === "INVALID_PHOTOS",
  );
});

test("creating a canonical AI request persists every photo and the primary imageUrl", async () => {
  const photos = normalizeSubmittedAIRequestPhotos([
    "photo-1",
    "photo-2",
    "photo-3",
  ]);
  let persistedPayload;

  Insemination.findOne = () => ({ sort: async () => null });
  Insemination.create = async (payload) => {
    persistedPayload = payload;
    return { _id: "request-1", ...payload };
  };

  const created = await createAIRequestWithGuard({
    animalId: "animal-1",
    farmerId: "farmer-1",
    status: "pending",
    photos,
    imageUrl: photos[0],
  });

  assert.deepEqual(persistedPayload.photos, ["photo-1", "photo-2", "photo-3"]);
  assert.equal(persistedPayload.imageUrl, "photo-1");
  assert.deepEqual(created.photos, ["photo-1", "photo-2", "photo-3"]);
});

test("authorized candidate detail exposes all unique AI request photos", () => {
  const candidate = buildCandidateAIDetail({
    _id: "request-1",
    photos: ["photo-1", "photo-2"],
    imageUrl: "photo-1",
    farmerId: { name: "Farmer" },
  });

  assert.deepEqual(candidate.photos, ["photo-1", "photo-2"]);
  assert.equal(candidate.imageUrl, "photo-1");
});

test("historical imageUrl-only AI records present as one request photo", () => {
  assert.deepEqual(getAIRequestPhotos({ imageUrl: " historical-photo " }), [
    "historical-photo",
  ]);
  const farmerView = buildFarmerAIRequest({ imageUrl: "historical-photo" });
  assert.deepEqual(farmerView.photos, ["historical-photo"]);
  assert.equal(farmerView.imageUrl, "historical-photo");
});

test("AI photo presentation is safe when no image exists", () => {
  assert.deepEqual(getAIRequestPhotos({}), []);
  assert.deepEqual(getAIRequestPhotos({ photos: [], imageUrl: "" }), []);
});
