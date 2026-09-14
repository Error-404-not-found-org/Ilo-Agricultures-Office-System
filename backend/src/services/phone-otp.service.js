import crypto from "node:crypto";
import { ENV } from "../config/env.js";

export const OTP_SEND_COOLDOWN_SECONDS = 60;

const requireOtpHashSecret = (secret = ENV.OTP_HASH_SECRET) => {
  if (!secret) {
    throw Object.assign(new Error("OTP hashing is not configured."), {
      statusCode: 503,
      code: "OTP_NOT_CONFIGURED",
    });
  }
  return secret;
};

export const assertOtpHashConfigured = () => requireOtpHashSecret();

export const hashOtpCode = (otpCode, secret) =>
  crypto
    .createHmac("sha256", requireOtpHashSecret(secret))
    .update(String(otpCode || "").trim(), "utf8")
    .digest("hex");

export const buildPendingPhoneVerification = ({
  currentVerification = {},
  phoneNumber,
  normalizedPhoneNumber,
  otpCode,
  otpExpiresAt,
  sentAt = new Date(),
  secret,
}) => ({
  ...(currentVerification.toObject?.() || currentVerification),
  pendingPhoneNumber: phoneNumber,
  pendingNormalizedPhoneNumber: normalizedPhoneNumber,
  otpHash: hashOtpCode(otpCode, secret),
  otpExpiresAt,
  lastOtpSentAt: sentAt,
  failedAttempts: 0,
});

export const verifyOtpHash = (otpCode, expectedHash, secret) => {
  if (!expectedHash || !/^[a-f\d]{64}$/i.test(expectedHash)) return false;
  const actual = Buffer.from(hashOtpCode(otpCode, secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

export const assessOtpAttempt = ({
  verification = {},
  normalizedPhoneNumber,
  otpCode,
  secret,
  now = new Date(),
  maxFailedAttempts = 5,
}) => {
  if (
    !verification.pendingNormalizedPhoneNumber ||
    !verification.otpHash ||
    !verification.otpExpiresAt
  ) {
    return { ok: false, code: "OTP_NOT_PENDING", incrementFailedAttempts: false };
  }
  if (verification.pendingNormalizedPhoneNumber !== normalizedPhoneNumber) {
    return { ok: false, code: "OTP_PHONE_MISMATCH", incrementFailedAttempts: false };
  }
  if ((verification.failedAttempts || 0) >= maxFailedAttempts) {
    return { ok: false, code: "OTP_TOO_MANY_ATTEMPTS", incrementFailedAttempts: false };
  }
  if (new Date(verification.otpExpiresAt).getTime() <= now.getTime()) {
    return { ok: false, code: "OTP_EXPIRED", incrementFailedAttempts: false };
  }
  const valid =
    /^\d{4,8}$/.test(String(otpCode || "").trim()) &&
    verifyOtpHash(otpCode, verification.otpHash, secret);
  return valid
    ? { ok: true, code: null, incrementFailedAttempts: false }
    : { ok: false, code: "OTP_INVALID", incrementFailedAttempts: true };
};

export const parseProviderOtpPayload = (payload) => {
  const data = payload?.data || payload;
  const otpCode = String(data?.otp_code || "").trim();
  const otpExpiresAt = new Date(data?.otp_code_expires_at);

  if (!/^\d{4,8}$/.test(otpCode) || Number.isNaN(otpExpiresAt.getTime())) {
    throw Object.assign(
      new Error("SMS provider returned an incomplete OTP response."),
      { statusCode: 502, code: "OTP_PROVIDER_INVALID_RESPONSE" },
    );
  }

  return { otpCode, otpExpiresAt };
};

export const buildSafePhoneVerification = (verification = {}) => ({
  pendingPhoneNumber: verification.pendingPhoneNumber || "",
  otpExpiresAt: verification.otpExpiresAt || null,
  lastOtpSentAt: verification.lastOtpSentAt || null,
  failedAttempts: verification.failedAttempts || 0,
  isVerified: Boolean(verification.isVerified),
  verifiedAt: verification.verifiedAt || null,
  retryAfterSeconds: OTP_SEND_COOLDOWN_SECONDS,
});

export const buildSafeUserPayload = (user) => {
  const payload = user?.toObject ? user.toObject() : { ...(user || {}) };
  delete payload.password;
  delete payload.pushToken;
  payload.phoneVerification = buildSafePhoneVerification(
    payload.phoneVerification,
  );
  return payload;
};
