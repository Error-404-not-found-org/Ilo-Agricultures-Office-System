import {
  getClerkUserId,
  resolveOrSyncUser,
} from "../services/auth-user.service.js";

export const resolveUserMiddleware = async (req, res, next) => {
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
