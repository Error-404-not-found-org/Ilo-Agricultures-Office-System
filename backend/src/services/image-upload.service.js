import cloudinary from "../config/cloudinary.js";
import { AppError } from "../utils/app-error.js";

/**
 * Checks if a value looks like a data URI string.
 */
export const isDataUri = (val) =>
  typeof val === "string" && val.trim().startsWith("data:");

/**
 * Validates whether a value is a legitimate image data URI (base64 encoded).
 * E.g.: data:image/jpeg;base64,... or data:image/png;base64,...
 */
export const isValidImageDataUri = (val) => {
  if (typeof val !== "string") return false;
  const trimmed = val.trim();
  if (!trimmed.startsWith("data:image/")) return false;

  const commaIdx = trimmed.indexOf(",");
  if (commaIdx === -1) return false;

  const meta = trimmed.slice(0, commaIdx);
  const data = trimmed.slice(commaIdx + 1);

  if (!meta.includes(";base64")) return false;
  if (!data || data.length === 0) return false;

  // Verify only valid base64 characters (strip internal whitespace/newlines)
  const cleanData = data.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/=_-]+$/.test(cleanData)) return false;

  return cleanData.length > 0;
};

/**
 * Checks whether a value is an existing Cloudinary HTTPS URL.
 */
export const isCloudinaryUrl = (val) => {
  if (typeof val !== "string") return false;
  const trimmed = val.trim();
  try {
    const parsed = new URL(trimmed);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname.endsWith("cloudinary.com") ||
        parsed.hostname === "res.cloudinary.com")
    );
  } catch {
    return false;
  }
};

/**
 * Checks whether a value is a valid HTTP or HTTPS URL.
 */
export const isHttpUrl = (val) => {
  if (typeof val !== "string") return false;
  const trimmed = val.trim();
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Destroys newly uploaded assets from Cloudinary.
 * Pre-existing assets (newlyUploaded: false) are never destroyed.
 */
export const cleanupUploadedAssets = async (assets = []) => {
  if (!Array.isArray(assets) || assets.length === 0) return;
  const toClean = assets.filter(
    (asset) => asset && asset.newlyUploaded && asset.publicId,
  );
  if (toClean.length === 0) return;

  await Promise.allSettled(
    toClean.map(async (asset) => {
      try {
        await cloudinary.uploader.destroy(asset.publicId);
      } catch (err) {
        console.error(
          `[Cloudinary Cleanup Error] Failed to destroy ${asset.publicId}:`,
          err.message,
        );
      }
    }),
  );
};

/**
 * Uploads or normalizes a list of images to Cloudinary.
 *
 * Rules:
 * 1. Blank values -> filtered safely.
 * 2. Existing Cloudinary HTTPS URL -> preserved without re-uploading.
 * 3. Valid base64 image data URI -> uploaded to Cloudinary.
 * 4. External HTTP/HTTPS URL -> normalized through Cloudinary upload.
 * 5. Malformed data URI -> rejects with 400 error.
 * 6. Invalid image format string -> rejects with 400 error.
 *
 * If any upload fails, all newly uploaded assets from this batch are destroyed.
 */
export const uploadImages = async (items = [], options = {}) => {
  const folder = options.folder || "health_requests";
  const cleanItems = (Array.isArray(items) ? items : [])
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  const results = [];
  try {
    for (const item of cleanItems) {
      if (isCloudinaryUrl(item)) {
        results.push({
          url: item,
          publicId: null,
          newlyUploaded: false,
        });
      } else if (isValidImageDataUri(item)) {
        const uploadResult = await cloudinary.uploader.upload(item, {
          folder,
          resource_type: "image",
          ...(options.uploadOptions || {}),
        });
        results.push({
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          newlyUploaded: true,
        });
      } else if (isHttpUrl(item)) {
        // Normalize external HTTP/HTTPS through Cloudinary to maintain Cloudinary-backed storage
        const uploadResult = await cloudinary.uploader.upload(item, {
          folder,
          resource_type: "image",
          ...(options.uploadOptions || {}),
        });
        results.push({
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          newlyUploaded: true,
        });
      } else if (isDataUri(item)) {
        throw new AppError("Malformed or unsupported image data URI.", {
          status: 400,
          code: "MALFORMED_IMAGE",
        });
      } else {
        throw new AppError(
          "Invalid image format provided. Must be a valid HTTPS URL or base64 image data URI.",
          {
            status: 400,
            code: "INVALID_IMAGE",
          },
        );
      }
    }
    return results;
  } catch (error) {
    // Partial upload failure cleanup: destroy all assets uploaded in this batch
    await cleanupUploadedAssets(results);
    throw error;
  }
};
