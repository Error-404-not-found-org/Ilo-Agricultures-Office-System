import {
  getClerkUserId,
  resolveOrSyncUser,
} from "../services/auth-user.service.js";

export { getClerkUserId } from "../services/auth-user.service.js";

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
      return res.status(503).json({
        message: "Your account could not be loaded. Please try again.",
        code: "USER_RESOLUTION_FAILED",
        retryable: true,
      });
    }

    let user = req.user || (await resolveOrSyncUser(clerkId));
    if (user && (user.deletedAt || user.status === "suspended")) {
      const isSuspended = user.status === "suspended";
      console.warn(
        `[AUTH] Blocked ${isSuspended ? "suspended" : "deactivated"} account.`,
      );
      return res.status(403).json({
        message: isSuspended
          ? "Account has been suspended."
          : "Account has been deactivated.",
        code: isSuspended ? "ACCOUNT_SUSPENDED" : "ACCOUNT_DEACTIVATED",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("[AUTH ERROR]", error.message);
    res.status(500).json({
      message: "Internal server error",
      code: "AUTH_RESOLUTION_ERROR",
      retryable: true,
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
