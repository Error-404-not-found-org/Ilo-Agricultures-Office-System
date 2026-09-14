import assert from "node:assert/strict";
import test from "node:test";

import {
  assessOtpAttempt,
  buildPendingPhoneVerification,
  buildSafePhoneVerification,
  buildSafeUserPayload,
  hashOtpCode,
  parseProviderOtpPayload,
  verifyOtpHash,
} from "../src/services/phone-otp.service.js";
import { User } from "../src/models/user.model.js";

const secret = "test-only-secret-with-enough-entropy";

test("phone OTP: provider response yields an internal code and authoritative expiry", () => {
  const result = parseProviderOtpPayload({
    data: {
      otp_code: "123456",
      otp_code_expires_at: "2026-09-13T10:05:00.000Z",
      phone_number: "639171234567",
    },
  });

  assert.equal(result.otpCode, "123456");
  assert.equal(result.otpExpiresAt.toISOString(), "2026-09-13T10:05:00.000Z");
});

test("phone OTP: HMAC persistence never stores the plaintext and supports timing-safe verification", () => {
  const hash = hashOtpCode("123456", secret);

  assert.notEqual(hash, "123456");
  assert.equal(hash.includes("123456"), false);
  assert.equal(verifyOtpHash("123456", hash, secret), true);
  assert.equal(verifyOtpHash("654321", hash, secret), false);
});

test("phone OTP: resending replaces validation authority", () => {
  const oldHash = hashOtpCode("111111", secret);
  const newHash = hashOtpCode("222222", secret);

  assert.equal(verifyOtpHash("111111", newHash, secret), false);
  assert.equal(verifyOtpHash("222222", newHash, secret), true);
  assert.notEqual(oldHash, newHash);
});

test("phone OTP: successful send state stores a hash and never plaintext", () => {
  const pending = buildPendingPhoneVerification({
    currentVerification: { isVerified: false, failedAttempts: 4 },
    phoneNumber: "09171234567",
    normalizedPhoneNumber: "+639171234567",
    otpCode: "123456",
    otpExpiresAt: new Date("2026-09-13T10:05:00.000Z"),
    sentAt: new Date("2026-09-13T10:00:00.000Z"),
    secret,
  });

  assert.equal(pending.otpHash, hashOtpCode("123456", secret));
  assert.equal(pending.failedAttempts, 0);
  assert.equal(pending.otpCode, undefined);
  assert.equal(Object.values(pending).includes("123456"), false);
});

test("phone OTP: safe pending metadata excludes hashes and normalized phone values", () => {
  const safe = buildSafePhoneVerification({
    pendingPhoneNumber: "09171234567",
    pendingNormalizedPhoneNumber: "+639171234567",
    otpHash: "secret-hash",
    otpExpiresAt: new Date("2026-09-13T10:05:00.000Z"),
    lastOtpSentAt: new Date("2026-09-13T10:00:00.000Z"),
    failedAttempts: 2,
    isVerified: false,
    verifiedAt: null,
  });

  assert.deepEqual(safe, {
    pendingPhoneNumber: "09171234567",
    otpExpiresAt: new Date("2026-09-13T10:05:00.000Z"),
    lastOtpSentAt: new Date("2026-09-13T10:00:00.000Z"),
    failedAttempts: 2,
    isVerified: false,
    verifiedAt: null,
    retryAfterSeconds: 60,
  });
  assert.equal(JSON.stringify(safe).includes("secret-hash"), false);
  assert.equal(JSON.stringify(safe).includes("+639171234567"), false);
});

test("phone OTP: schema excludes the OTP hash from normal queries", () => {
  assert.equal(User.schema.path("phoneVerification.otpHash").options.select, false);
});

test("phone OTP: user serialization used by me and bootstrap never exposes the hash", () => {
  const payload = buildSafeUserPayload({
    toObject: () => ({
      name: "Farmer",
      password: "hidden",
      pushToken: "hidden-token",
      phoneVerification: {
        pendingPhoneNumber: "09171234567",
        pendingNormalizedPhoneNumber: "+639171234567",
        otpHash: "secret-hash",
        otpExpiresAt: new Date("2026-09-13T10:05:00.000Z"),
      },
    }),
  });

  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes("secret-hash"), false);
  assert.equal(serialized.includes("hidden-token"), false);
  assert.equal(serialized.includes('"password"'), false);
  assert.equal(payload.phoneVerification.pendingPhoneNumber, "09171234567");
});

test("phone OTP: an expired code does not request a failed-attempt increment", () => {
  const result = assessOtpAttempt({
    verification: {
      pendingNormalizedPhoneNumber: "+639171234567",
      otpHash: hashOtpCode("123456", secret),
      otpExpiresAt: new Date("2026-09-13T10:00:00.000Z"),
      failedAttempts: 2,
    },
    normalizedPhoneNumber: "+639171234567",
    otpCode: "123456",
    secret,
    now: new Date("2026-09-13T10:00:01.000Z"),
  });

  assert.equal(result.code, "OTP_EXPIRED");
  assert.equal(result.incrementFailedAttempts, false);
});

test("phone OTP: wrong codes increment attempts while missing and mismatched challenges do not", () => {
  const verification = {
    pendingNormalizedPhoneNumber: "+639171234567",
    otpHash: hashOtpCode("123456", secret),
    otpExpiresAt: new Date("2026-09-13T10:05:00.000Z"),
    failedAttempts: 0,
  };
  const wrong = assessOtpAttempt({
    verification,
    normalizedPhoneNumber: "+639171234567",
    otpCode: "654321",
    secret,
    now: new Date("2026-09-13T10:00:00.000Z"),
  });
  const mismatch = assessOtpAttempt({
    verification,
    normalizedPhoneNumber: "+639189999999",
    otpCode: "123456",
    secret,
    now: new Date("2026-09-13T10:00:00.000Z"),
  });

  assert.equal(wrong.code, "OTP_INVALID");
  assert.equal(wrong.incrementFailedAttempts, true);
  assert.equal(mismatch.code, "OTP_PHONE_MISMATCH");
  assert.equal(mismatch.incrementFailedAttempts, false);
});

test("phone OTP: maximum attempts blocks even a correct code", () => {
  const result = assessOtpAttempt({
    verification: {
      pendingNormalizedPhoneNumber: "+639171234567",
      otpHash: hashOtpCode("123456", secret),
      otpExpiresAt: new Date("2026-09-13T10:05:00.000Z"),
      failedAttempts: 5,
    },
    normalizedPhoneNumber: "+639171234567",
    otpCode: "123456",
    secret,
    now: new Date("2026-09-13T10:00:00.000Z"),
  });

  assert.equal(result.code, "OTP_TOO_MANY_ATTEMPTS");
  assert.equal(result.incrementFailedAttempts, false);
});
