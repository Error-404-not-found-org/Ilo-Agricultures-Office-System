import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import { ENV } from "../src/config/env.js";
import {
  createSendPhoneOtpController,
  verifyPhoneOtp,
} from "../src/controllers/user.controllers.js";
import { User } from "../src/models/user.model.js";
import { Animal } from "../src/models/animal.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Calving } from "../src/models/calving.model.js";
import { Task } from "../src/models/task.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import { hashOtpCode } from "../src/services/phone-otp.service.js";
import { otpSendLimiter, otpVerifyLimiter } from "../src/middleware/rateLimit.middleware.js";

const originalSecret = ENV.OTP_HASH_SECRET;
const secret = "controller-test-secret-with-enough-entropy";

afterEach(() => {
  mock.restoreAll();
  ENV.OTP_HASH_SECRET = originalSecret;
});

const responseRecorder = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const verificationUser = ({ expiresAt, failedAttempts = 0, otpCode = "123456" } = {}) => {
  const user = new User({
    _id: "507f1f77bcf86cd799439011",
    clerkId: "clerk_farmer",
    name: "Farmer",
    role: "farmer",
    phoneVerification: {
      pendingPhoneNumber: "09171234567",
      pendingNormalizedPhoneNumber: "+639171234567",
      otpHash: hashOtpCode(otpCode, secret),
      otpExpiresAt: expiresAt || new Date(Date.now() + 60_000),
      failedAttempts,
    },
  });
  user.save = mock.fn(async () => user);
  return user;
};

const mockUserLookup = (user) => {
  mock.method(User, "findById", () => ({ select: async () => user }));
};

test("phone OTP: correct local code verifies and clears pending secret state", async () => {
  ENV.OTP_HASH_SECRET = secret;
  const user = verificationUser();
  mockUserLookup(user);
  mock.method(User, "find", async () => []);
  const res = responseRecorder();

  await verifyPhoneOtp(
    { user: { _id: user._id }, body: { phoneNumber: "09171234567", otpCode: "123456" } },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(user.phoneVerification.otpHash, undefined);
  assert.equal(user.phoneVerification.otpExpiresAt, null);
  assert.equal(user.phoneVerification.isVerified, true);
});

test("phone OTP: wrong code increments attempts but an expired code does not", async () => {
  ENV.OTP_HASH_SECRET = secret;
  const wrongUser = verificationUser();
  mockUserLookup(wrongUser);
  const wrongRes = responseRecorder();
  await verifyPhoneOtp(
    { user: { _id: wrongUser._id }, body: { phoneNumber: "09171234567", otpCode: "654321" } },
    wrongRes,
  );
  assert.equal(wrongRes.body.code, "OTP_INVALID");
  assert.equal(wrongUser.phoneVerification.failedAttempts, 1);

  mock.restoreAll();
  const expiredUser = verificationUser({ expiresAt: new Date(Date.now() - 1_000), failedAttempts: 2 });
  mockUserLookup(expiredUser);
  const expiredRes = responseRecorder();
  await verifyPhoneOtp(
    { user: { _id: expiredUser._id }, body: { phoneNumber: "09171234567", otpCode: "123456" } },
    expiredRes,
  );
  assert.equal(expiredRes.body.code, "OTP_EXPIRED");
  assert.equal(expiredUser.phoneVerification.failedAttempts, 2);
});

test("phone OTP: missing challenge returns OTP_NOT_PENDING even without a phone input", async () => {
  ENV.OTP_HASH_SECRET = secret;
  const user = verificationUser();
  user.phoneVerification = {};
  mockUserLookup(user);
  const res = responseRecorder();

  await verifyPhoneOtp({ user: { _id: user._id }, body: { otpCode: "123456" } }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "OTP_NOT_PENDING");
});

test("phone OTP: send and verify use separate limiter instances", () => {
  assert.notEqual(otpSendLimiter, otpVerifyLimiter);
});

test("phone OTP: send stores only a hash and returns server timing without secrets", async () => {
  ENV.OTP_HASH_SECRET = secret;
  const user = verificationUser();
  user.phoneVerification = {};
  const now = new Date("2026-09-13T10:00:00.000Z");
  const controller = createSendPhoneOtpController({
    now: () => now,
    sendOtp: async () => ({
      otpCode: "123456",
      otpExpiresAt: new Date("2026-09-13T10:05:00.000Z"),
    }),
  });
  const res = responseRecorder();

  await controller({ user, body: { phoneNumber: "09171234567" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(user.phoneVerification.otpHash, hashOtpCode("123456", secret));
  assert.equal(user.phoneVerification.otpCode, undefined);
  assert.equal(res.body.data.expiresAt, "2026-09-13T10:05:00.000Z");
  assert.equal(res.body.data.retryAfterSeconds, 60);
  assert.equal(JSON.stringify(res.body).includes(user.phoneVerification.otpHash), false);
  assert.equal(JSON.stringify(res.body).includes("123456"), false);
});

test("phone OTP: provider send failure preserves the existing pending challenge", async () => {
  ENV.OTP_HASH_SECRET = secret;
  const user = verificationUser();
  const before = user.phoneVerification.toObject();
  const controller = createSendPhoneOtpController({
    now: () => new Date(Date.now() + 61_000),
    sendOtp: async () => {
      throw Object.assign(new Error("Provider unavailable"), { statusCode: 502 });
    },
  });
  const res = responseRecorder();

  await controller({ user, body: { phoneNumber: "09171234567" } }, res);

  assert.equal(res.statusCode, 502);
  assert.deepEqual(user.phoneVerification.toObject(), before);
  assert.equal(user.save.mock.callCount(), 0);
});

test("phone OTP: early resend returns a live retry delay without contacting provider", async () => {
  ENV.OTP_HASH_SECRET = secret;
  const now = new Date("2026-09-13T10:00:30.000Z");
  const user = verificationUser();
  user.phoneVerification.lastOtpSentAt = new Date("2026-09-13T10:00:00.000Z");
  const sendOtp = mock.fn(async () => {
    throw new Error("must not be called");
  });
  const controller = createSendPhoneOtpController({ now: () => now, sendOtp });
  const res = responseRecorder();

  await controller({ user, body: { phoneNumber: "09171234567" } }, res);

  assert.equal(res.statusCode, 429);
  assert.equal(res.body.code, "OTP_COOLDOWN");
  assert.equal(res.body.retryAfterSeconds, 30);
  assert.equal(sendOtp.mock.callCount(), 0);
});

test("phone OTP: resend makes only the latest issued code valid through the controllers", async () => {
  ENV.OTP_HASH_SECRET = secret;
  const user = verificationUser();
  user.phoneVerification = {};
  let now = new Date();
  const issuedCodes = ["111111", "222222"];
  let issueIndex = 0;
  const sendController = createSendPhoneOtpController({
    now: () => now,
    sendOtp: async () => ({
      otpCode: issuedCodes[issueIndex++],
      otpExpiresAt: new Date(now.getTime() + 5 * 60_000),
    }),
  });

  await sendController(
    { user, body: { phoneNumber: "09171234567" } },
    responseRecorder(),
  );
  const otp1 = issuedCodes[0];
  const firstHash = user.phoneVerification.otpHash;

  now = new Date(now.getTime() + 61_000);
  await sendController(
    { user, body: { phoneNumber: "09171234567" } },
    responseRecorder(),
  );
  const otp2 = issuedCodes[1];
  const secondHash = user.phoneVerification.otpHash;
  assert.notEqual(secondHash, firstHash);

  mockUserLookup(user);
  const staleResponse = responseRecorder();
  await verifyPhoneOtp(
    { user: { _id: user._id }, body: { phoneNumber: "09171234567", otpCode: otp1 } },
    staleResponse,
  );
  assert.equal(staleResponse.body.code, "OTP_INVALID");

  mock.method(User, "find", async () => []);
  const currentResponse = responseRecorder();
  await verifyPhoneOtp(
    { user: { _id: user._id }, body: { phoneNumber: "09171234567", otpCode: otp2 } },
    currentResponse,
  );
  assert.equal(currentResponse.statusCode, 200);
  assert.equal(currentResponse.body.data.isVerified, true);
});

test("phone OTP: local verification preserves eligible unclaimed Farmer profile linking", async () => {
  ENV.OTP_HASH_SECRET = secret;
  const currentUser = verificationUser({ otpCode: "864209" });
  const existingProfile = new User({
    _id: "507f1f77bcf86cd799439012",
    name: "Existing Farmer",
    role: "farmer",
    registeredByTechnician: true,
    profileClaimStatus: "unclaimed",
    phoneNumber: "09171234567",
    normalizedPhoneNumber: "+639171234567",
  });
  existingProfile.save = mock.fn(async () => existingProfile);

  mockUserLookup(currentUser);
  mock.method(User, "find", async () => [existingProfile]);
  for (const model of [Animal, Insemination, HealthRequest, Pregnancy, Calving, Task]) {
    mock.method(model, "countDocuments", async () => 0);
  }
  mock.method(AuditLog, "create", async (entry) => entry);
  const res = responseRecorder();

  await verifyPhoneOtp(
    {
      user: { _id: currentUser._id },
      body: { phoneNumber: "09171234567", otpCode: "864209" },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.linkedExistingProfile, true);
  assert.equal(existingProfile.profileClaimStatus, "claimed");
  assert.equal(existingProfile.phoneVerification.isVerified, true);
  assert.equal(existingProfile.phoneVerification.otpHash, undefined);
  assert.equal(existingProfile.phoneVerification.otpExpiresAt, null);
  const responseText = JSON.stringify(res.body);
  assert.equal(responseText.includes("864209"), false);
  assert.equal(
    responseText.includes(hashOtpCode("864209", secret)),
    false,
  );
  assert.equal(responseText.includes("otpHash"), false);
});
