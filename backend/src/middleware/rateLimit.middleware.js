import { rateLimit } from "express-rate-limit";

// Stricter rate limiter for creating requests: 5 requests per 1 minute
export const requestLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many requests. Please wait a minute before submitting again." }
});
