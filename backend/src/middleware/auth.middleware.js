import { requireAuth } from "@clerk/express";
import { User } from "../models/user.model.js";

// Protected route middleware
export const protectedRoute = [
  requireAuth(), // Clerk auth
  async (req, res, next) => {
    try {
      console.log(`[AUTH-TRACE] Request received for: ${req.path}`);
      
      const { userId: clerkId } = req.auth();
      if (!clerkId) {
        console.log("[AUTH-TRACE] Clerk verify failed - No UserId");
        return res.status(401).json({ message: "Unauthorized - invalid token" });
      }

      const user = await User.findOne({ clerkId }).maxTimeMS(3000);
      if (!user) {
        console.log(`[AUTH-TRACE] User not found in MongoDB for ClerkID: ${clerkId}`);
        return res.status(401).json({ message: "User not found" });
      }

      console.log(`[AUTH-TRACE] Success! User ${user.name} identified.`);
      req.user = user;
      next();
    } catch (error) {
      console.error("[AUTH-TRACE ERROR]", error);
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
