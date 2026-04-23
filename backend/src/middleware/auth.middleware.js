import { requireAuth } from "@clerk/express";
import { User } from "../models/user.model.js";

// Protected route middleware
export const protectedRoute = [
  requireAuth(), // Clerk auth
  async (req, res, next) => {
    try {
      const clerkId = req.auth().userId;
      if (!clerkId) {
        return res
          .status(401)
          .json({ message: "Unauthorized - invalid token" });
      }

      const user = await User.findOne({ clerkId });
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Attach user to request
      req.user = user;
      next();
    } catch (error) {
      console.error("Error in protectedRoute middleware:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
];

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
