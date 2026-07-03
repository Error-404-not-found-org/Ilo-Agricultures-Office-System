import crypto from "crypto";
import { Idempotency } from "../models/idempotency.model.js";

export const idempotencyMiddleware = async (req, res, next) => {
  const key = req.headers["idempotency-key"];
  if (!key) {
    return next();
  }

  // Only apply idempotency to mutating methods
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return next();
  }

  // Run idempotency only after authentication has resolved the user
  if (!req.user || !req.user._id) {
    return next();
  }

  try {
    const normalizedPath = req.path.replace(/\/+$/, "").toLowerCase();
    
    // Generate request body hash
    const bodyStr = req.body ? JSON.stringify(req.body) : "";
    const requestHash = crypto.createHash("sha256").update(bodyStr).digest("hex");

    let record;
    let isNewRecord = false;
    try {
      // Replace find-then-create with an atomic MongoDB insert operation
      record = await Idempotency.create({
        key,
        userId: req.user._id,
        method: req.method,
        path: normalizedPath,
        requestHash,
        status: "pending",
      });
      isNewRecord = true;
    } catch (err) {
      if (err.code === 11000) {
        // Compound unique index duplicate key error: concurrent duplicate request
        // Fetch the existing record (scoped to authenticated user, key, method, and path)
        record = await Idempotency.findOne({
          key,
          userId: req.user._id,
          method: req.method,
          path: normalizedPath,
        });
      } else {
        throw err;
      }
    }

    if (!record) {
      // Fallback in case of race deletion
      return next();
    }

    if (!isNewRecord) {
      // Handle existing record
      if (record.status === "resolved") {
        // Validate request hashes
        if (record.requestHash !== requestHash) {
          return res.status(400).json({
            message: "Idempotency key body mismatch. The request payload differs from the initial request.",
            code: "IDEMPOTENCY_BODY_MISMATCH",
          });
        }

        // Return cached response
        return res.status(record.responseStatus).json(record.responseBody);
      }

      if (record.status === "pending") {
      // Handle stale pending records (older than 30s)
      const STALE_TIMEOUT_MS = 30000;
      const isStale = (Date.now() - new Date(record.createdAt).getTime()) > STALE_TIMEOUT_MS;

      if (isStale) {
        // Try to atomically reclaim the stale record by updating createdAt and requestHash
        const updated = await Idempotency.findOneAndUpdate(
          { _id: record._id, status: "pending" },
          { $set: { createdAt: new Date(), requestHash } },
          { new: true }
        );

        if (updated) {
          record = updated;
        } else {
          // If update fails (someone else updated it first), return retryable response
          return res.status(409).json({
            message: "Request is currently being processed. Please retry shortly.",
            code: "IDEMPOTENCY_IN_PROGRESS",
            retryable: true,
          });
        }
      } else {
        // Return a retryable contract for requests still processing
        return res.status(409).json({
          message: "Request is currently being processed. Please retry shortly.",
          code: "IDEMPOTENCY_IN_PROGRESS",
          retryable: true,
        });
      }
    }
    }

    // Intercept response methods to save outcomes
    const originalJson = res.json;
    const originalSend = res.send;
    let responseSent = false;

    const resolveRecord = async (status, body) => {
      if (responseSent) return;
      responseSent = true;

      // Do not permanently cache 401, 403, 409, or 5xx responses
      const nonCacheableStatuses = [401, 403, 409];
      const isCacheable = !nonCacheableStatuses.includes(status) && status < 500;

      if (isCacheable) {
        try {
          await Idempotency.updateOne(
            { _id: record._id },
            { $set: { status: "resolved", responseStatus: status, responseBody: body } }
          );
        } catch (err) {
          console.error("[Idempotency Middleware Resolve Error]", err);
        }
      } else {
        // Delete pending record on server failures or non-cacheable responses so they can retry
        try {
          await Idempotency.deleteOne({ _id: record._id });
        } catch (err) {
          console.error("[Idempotency Middleware Delete Error]", err);
        }
      }
    };

    res.send = function (body) {
      let parsedBody = body;
      if (typeof body === "string") {
        try {
          parsedBody = JSON.parse(body);
        } catch (e) {
          // Keep as string
        }
      }
      resolveRecord(res.statusCode, parsedBody).catch(console.error);
      return originalSend.apply(res, arguments);
    };

    res.json = function (body) {
      resolveRecord(res.statusCode, body).catch(console.error);
      return originalJson.apply(res, arguments);
    };

    next();
  } catch (error) {
    console.error("[Idempotency Middleware Error]", error);
    next();
  }
};
