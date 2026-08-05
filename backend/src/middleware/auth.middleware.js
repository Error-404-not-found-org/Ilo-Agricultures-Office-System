import {
  getClerkUserId,
  resolveOrSyncUser,
} from "../services/auth-user.service.js";

export { getClerkUserId } from "../services/auth-user.service.js";

// Middleware purely for checking Clerk authentication, bypassing MongoDB resolution errors
export const requireClerkAuthentication = (req, res, next) => {
  const clerkId = getClerkUserId(req);

  if (!clerkId) {
    return res.status(401).json({
      message: "Authentication is required.",
      code: "AUTH_REQUIRED",
      retryable: false,
    });
  }

  req.clerkId = clerkId;
  next();
};

// Protected route middleware returning JSON 401 instead of 302 Found redirect
export const protectedRoute = async (req, res, next) => {
  try {
    const clerkId = getClerkUserId(req);
    if (!clerkId) {
      return res.status(401).json({
        message: "Unauthorized - invalid token",
        code: "AUTH_REQUIRED",
      });
    }

    if (req.userResolutionError) {
      // Allow bootstrap requests to bypass this error by not using protectedRoute
      return res.status(503).json({
        message: "Your account could not be loaded. Please try again.",
        code: "USER_RESOLUTION_FAILED",
        retryable: true,
      });
    }

    let user = req.user || (await resolveOrSyncUser(clerkId));

    if (!user) {
      return res.status(503).json({
        message: "User profile could not be loaded.",
        code: "USER_PROFILE_UNAVAILABLE",
        retryable: true,
      });
    }

    if (user.deletedAt || user.status === "suspended" || user.status === "deleted") {
      const isSuspended = user.status === "suspended";
      console.warn(
        `[AUTH] Blocked ${isSuspended ? "suspended" : "deactivated"} account.`,
      );
      return res.status(403).json({
        message: isSuspended
          ? "Account has been suspended."
          : "Account has been deactivated.",
        code: isSuspended ? "ACCOUNT_SUSPENDED" : "ACCOUNT_DELETED",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("[AUTH ERROR]", error.message);
    const code = error.code || "AUTH_RESOLUTION_ERROR";
    const status = error.status || 500;
    res.status(status).json({
      message: error.message || "Internal server error",
      code: code,
      retryable: error.retryable !== false,
    });
  }
};

// Role-based middleware
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ message: "Unauthorized - user not found" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden - insufficient role" });
    }

    next();
  };
};

// Example: Admin-only route
export const AdminOnly = requireRole(["admin"]);

// Example: Technician-only route
export const TechnicianOnly = requireRole(["technician"]);
export const ClinicalOnly = requireRole(["technician", "veterinarian", "admin"]);
