import { ENV } from "../config/env.js";
import { User } from "../models/user.model.js";
import crypto from "crypto";

export const voiceflowAuth = async (req, res, next) => {
  try {
    // 1. Verify service credential API key
    const authHeader = req.headers["authorization"] || req.headers["x-voiceflow-key"];
    const expectedKey = ENV.VOICEFLOW_API_KEY;
    
    // Fail closed when VOICEFLOW_API_KEY is missing
    if (!expectedKey) {
      console.error("[Voiceflow Auth] Missing VOICEFLOW_API_KEY in server environment.");
      return res.status(500).json({ error: "Voiceflow integration is not configured" });
    }
    
    let token = "";
    if (authHeader) {
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      } else {
        token = authHeader;
      }
    }

    if (!token || token !== expectedKey) {
      return res.status(401).json({ error: "Unauthorized - Invalid Voiceflow Key" });
    }

    // 2. Identify the user by verifying cryptographic session token
    // Never trust raw userId, email, or clerkId supplied by end user in req.body
    const userToken = req.body.userToken || req.headers["x-voiceflow-user-token"];
    if (!userToken) {
      return res.status(401).json({ error: "Unauthorized - Missing session token" });
    }

    const parts = userToken.split(":");
    if (parts.length !== 3) {
      return res.status(401).json({ error: "Unauthorized - Invalid session token format" });
    }

    const [userId, expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);

    // Verify token expiration
    if (Number.isNaN(expiresAt) || Date.now() > expiresAt) {
      return res.status(401).json({ error: "Unauthorized - Session token expired" });
    }

    // Verify token signature using VOICEFLOW_API_KEY as the secret
    const expectedSignature = crypto.createHmac("sha256", expectedKey)
      .update(`${userId}:${expiresAtStr}`)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.warn(`[Voiceflow Auth] Signature mismatch for userId: ${userId}`);
      return res.status(401).json({ error: "Unauthorized - Session token signature mismatch" });
    }

    // 3. Derive role and authorization directly from the database
    const user = await User.findOne({ _id: userId, deletedAt: null });
    if (!user) {
      return res.status(404).json({ error: "User not found or account deactivated" });
    }

    // Attach derived user to request so controllers can use it
    req.voiceflowUser = user;
    next();
  } catch (error) {
    console.error("[Voiceflow Auth Middleware Error]", error);
    res.status(500).json({ error: "Internal server error during authentication" });
  }
};
