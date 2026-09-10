import { AppError } from "../utils/app-error.js";

export const MAX_AI_REQUEST_PHOTOS = 5;

const cleanPhoto = (value) =>
  typeof value === "string" ? value.trim() : "";

const uniquePhotos = (values) => [
  ...new Set(values.map(cleanPhoto).filter(Boolean)),
];

export const normalizeSubmittedAIRequestPhotos = (photos) => {
  if (photos === undefined) return [];
  if (!Array.isArray(photos) || !photos.every((photo) => typeof photo === "string")) {
    throw new AppError("Photos must be an array of strings.", {
      status: 400,
      code: "INVALID_PHOTOS",
    });
  }
  if (photos.length > MAX_AI_REQUEST_PHOTOS) {
    throw new AppError(`Maximum of ${MAX_AI_REQUEST_PHOTOS} photos allowed.`, {
      status: 400,
      code: "TOO_MANY_PHOTOS",
    });
  }
  return uniquePhotos(photos);
};

export const getAIRequestPhotos = (request = {}) =>
  uniquePhotos([
    ...(Array.isArray(request.photos) ? request.photos : []),
    request.imageUrl,
  ]);

export const getAIRequestPrimaryImage = (request = {}) =>
  getAIRequestPhotos(request)[0] || "";
