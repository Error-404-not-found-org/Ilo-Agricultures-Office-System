import assert from "node:assert/strict";
import test from "node:test";

import {
  getPhoneOtpErrorPresentation,
  resolvePhoneOtpTiming,
} from "./phoneOtpPresentation.ts";

test("phone OTP timing uses server expiry and cooldown timestamps", () => {
  const timing = resolvePhoneOtpTiming({
    nowMs: Date.parse("2026-09-13T10:00:30.000Z"),
    expiresAt: "2026-09-13T10:05:00.000Z",
    lastOtpSentAt: "2026-09-13T10:00:00.000Z",
    retryAfterSeconds: 60,
  });

  assert.equal(timing.remainingSeconds, 270);
  assert.equal(timing.cooldownSeconds, 30);
  assert.equal(timing.isActive, true);
});

test("phone OTP errors have distinct Farmer-facing titles", () => {
  assert.equal(getPhoneOtpErrorPresentation("OTP_COOLDOWN").title, "Please wait before sending another code");
  assert.equal(getPhoneOtpErrorPresentation("OTP_INVALID").title, "Incorrect verification code");
  assert.equal(getPhoneOtpErrorPresentation("OTP_EXPIRED").title, "Verification code expired");
  assert.equal(getPhoneOtpErrorPresentation("OTP_SEND_FAILED").title, "Could not send verification code");
});
