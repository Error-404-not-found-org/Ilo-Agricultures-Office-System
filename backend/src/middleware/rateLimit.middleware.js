import { rateLimit } from "express-rate-limit";

// Stricter rate limiter for creating requests: 5 requests per 1 minute
export const requestLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Too many requests. Please wait a minute before submitting again.",
    code: "RATE_LIMITED",
    retryable: true,
  }
});

// Moowie chat API rate limiter: 15 requests per 1 minute
export const moowieLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Too many questions sent to Moowie. Please wait a minute.",
    code: "RATE_LIMITED",
    retryable: true,
  }
});

// Voiceflow unauthenticated connection rate limiter: 5 requests per 1 minute
export const voiceflowLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Too many connections from this client. Access restricted.",
    code: "RATE_LIMITED",
    retryable: true,
  }
});

// OTP limiter: protects paid SMS credits and reduces brute-force attempts
export const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Too many OTP attempts. Please wait before trying again.",
    code: "RATE_LIMITED",
    retryable: true,
  },
});
