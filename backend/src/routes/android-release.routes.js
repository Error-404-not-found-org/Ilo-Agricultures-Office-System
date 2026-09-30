import { Router } from "express";
import { ENV } from "../config/env.js";

const VERSION = /^\d+\.\d+\.\d+$/;

function parseBuildCode(value) {
  if (value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : NaN;
}

function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

export function getAndroidReleaseMetadata(config, track) {
  const prefix = track === "preview" ? "ANDROID_RELEASE_PREVIEW_" :
    track === "production" ? "ANDROID_RELEASE_PRODUCTION_" : null;
  if (!prefix) return null;
  const latestVersion = config[`${prefix}LATEST_VERSION`];
  const minimumVersion = config[`${prefix}MINIMUM_VERSION`];
  const latestBuildCode = parseBuildCode(config[`${prefix}LATEST_BUILD_CODE`]);
  const minimumBuildCode = parseBuildCode(config[`${prefix}MINIMUM_BUILD_CODE`]);
  let downloadUrl;
  try { downloadUrl = new URL(config[`${prefix}DOWNLOAD_URL`]); } catch { return null; }
  if (!VERSION.test(latestVersion || "") || !VERSION.test(minimumVersion || "") ||
      compareVersions(minimumVersion, latestVersion) > 0 ||
      Number.isNaN(latestBuildCode) || Number.isNaN(minimumBuildCode) ||
      (latestBuildCode !== null && minimumBuildCode !== null && minimumBuildCode > latestBuildCode) ||
      downloadUrl.protocol !== "https:" || !downloadUrl.hostname ||
      downloadUrl.username || downloadUrl.password) return null;

  return {
    platform: "android",
    track,
    latestVersion,
    latestBuildCode,
    minimumVersion,
    minimumBuildCode,
    downloadUrl: downloadUrl.href,
    message: String(config[`${prefix}MESSAGE`] || "").slice(0, 240),
  };
}

export function createAndroidReleaseRouter(getConfig = () => ENV) {
  const router = Router();
  router.get("/android", (_req, res) => {
    const metadata = getAndroidReleaseMetadata(getConfig(), _req.query.track);
    if (!metadata) return res.status(503).json({ available: false });
    return res.set("Cache-Control", "no-store").json(metadata);
  });
  return router;
}
