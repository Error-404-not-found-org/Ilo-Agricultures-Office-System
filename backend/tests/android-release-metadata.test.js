import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createAndroidReleaseRouter } from "../src/routes/android-release.routes.js";

const valid = {
  ANDROID_RELEASE_PREVIEW_LATEST_VERSION: "1.10.0",
  ANDROID_RELEASE_PREVIEW_LATEST_BUILD_CODE: "110",
  ANDROID_RELEASE_PREVIEW_MINIMUM_VERSION: "1.9.0",
  ANDROID_RELEASE_PREVIEW_MINIMUM_BUILD_CODE: "109",
  ANDROID_RELEASE_PREVIEW_DOWNLOAD_URL: "https://example.com/preview.apk",
  ANDROID_RELEASE_PREVIEW_MESSAGE: "Preview release.",
  ANDROID_RELEASE_PRODUCTION_LATEST_VERSION: "1.8.0",
  ANDROID_RELEASE_PRODUCTION_LATEST_BUILD_CODE: "108",
  ANDROID_RELEASE_PRODUCTION_MINIMUM_VERSION: "1.7.0",
  ANDROID_RELEASE_PRODUCTION_MINIMUM_BUILD_CODE: "107",
  ANDROID_RELEASE_PRODUCTION_DOWNLOAD_URL: "https://example.com/production.apk",
  ANDROID_RELEASE_PRODUCTION_MESSAGE: "Production release.",
};

async function request(config, track = "preview") {
  const app = express();
  app.use("/api/app-release", createAndroidReleaseRouter(() => config));
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  try {
    const address = server.address();
    const query = track === null ? "" : `?track=${encodeURIComponent(track)}`;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/app-release/android${query}`);
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("public release endpoint returns only validated Android release information", async () => {
  const result = await request({ ...valid, CLERK_SECRET_KEY: "never-expose" });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    platform: "android",
    track: "preview",
    latestVersion: "1.10.0",
    latestBuildCode: 110,
    minimumVersion: "1.9.0",
    minimumBuildCode: 109,
    downloadUrl: "https://example.com/preview.apk",
    message: "Preview release.",
  });
  assert.equal(JSON.stringify(result.body).includes("never-expose"), false);
});

test("missing or malformed release configuration fails closed without invented metadata", async () => {
  for (const config of [{}, { ...valid, ANDROID_RELEASE_PREVIEW_DOWNLOAD_URL: "http://example.com/a.apk" }, { ...valid, ANDROID_RELEASE_PREVIEW_LATEST_VERSION: "1.9" }, { ...valid, ANDROID_RELEASE_PREVIEW_MINIMUM_VERSION: "1.11.0" }]) {
    const result = await request(config);
    assert.equal(result.status, 503);
    assert.deepEqual(result.body, { available: false });
  }
});

test("production reads only production metadata and never preview metadata", async () => {
  const result = await request(valid, "production");
  assert.equal(result.status, 200);
  assert.equal(result.body.track, "production");
  assert.equal(result.body.latestVersion, "1.8.0");
  assert.equal(result.body.downloadUrl, "https://example.com/production.apk");
});

test("missing or unknown track and missing per-track config remain unavailable", async () => {
  for (const track of [null, "development", "staging"]) {
    assert.deepEqual(await request(valid, track), { status: 503, body: { available: false } });
  }
  assert.deepEqual(await request({ ...valid, ANDROID_RELEASE_PREVIEW_DOWNLOAD_URL: undefined }, "preview"),
    { status: 503, body: { available: false } });
});
