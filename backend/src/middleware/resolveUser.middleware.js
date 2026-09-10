import {
  getClerkUserId,
  resolveOrSyncUser,
} from "../services/auth-user.service.js";

export const resolveUserMiddleware = async (req, res, next) => {
  const requestPath = String(req.originalUrl || req.path || "")
    .split("?")[0]
    .replace(/\/+$/, "")
    .toLowerCase();
  if (req.method === "POST" && requestPath === "/api/user/staff-bootstrap") {
    return next();
  }

  try {
    const clerkId = getClerkUserId(req);
    if (clerkId) {
      req.user = await resolveOrSyncUser(clerkId);
    }
  } catch (err) {
    req.userResolutionError = err;
    console.error("[resolveUserMiddleware ERROR]", err.message);
  }
  next();
};
