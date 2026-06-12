import { requireAuth } from "@clerk/express";
import { User } from "../models/user.model.js";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { ENV } from "../config/env.js";

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

      let user = await User.findOne({ clerkId }).maxTimeMS(3000);
      if (!user) {
        console.log(`[AUTH-TRACE] User not found in MongoDB for ClerkID: ${clerkId}. Attempting auto-sync.`);
        
        try {
          // Fetch user details from Clerk Client
          const clerkUser = await clerkClient.users.getUser(clerkId);
          const emailObj = clerkUser.emailAddresses?.[0];
          const email = emailObj?.emailAddress;
          const username = clerkUser.username;
          const name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || username || "New User";
          const isVerified = emailObj?.verification?.status === "verified" || !!username;

          // Search by Email
          if (email) {
            user = await User.findOne({ email });
          }

          // Search by Name (offline profiles only)
          if (!user && name && name !== "New User") {
            user = await User.findOne({
              name: { $regex: new RegExp(`^${name}$`, 'i') },
              clerkId: { $exists: false }
            });
          }

          if (user) {
            console.log(`[AUTH-TRACE] Auto-sync linked existing user ${user.name} (${user.email}) to ClerkID: ${clerkId}`);
            user.clerkId = clerkId;
            if (email && !user.email) user.email = email;
            user.imageUrl = clerkUser.imageUrl || user.imageUrl;
            user.isVerified = true;
            await user.save();
          } else {
            console.log(`[AUTH-TRACE] Auto-sync creating new user account for ${name} (${email})`);
            
            // Check if this email matches the configured administrator email
            const role = (email && ENV.ADMIN_EMAIL && email.toLowerCase() === ENV.ADMIN_EMAIL.toLowerCase()) ? "admin" : "farmer";
            
            user = await User.create({
              clerkId,
              name,
              email: email || undefined,
              imageUrl: clerkUser.imageUrl || "",
              isVerified,
              role,
            });
          }

          // Sync role from metadata if present and mismatched
          if (clerkUser.publicMetadata?.role && user.role !== clerkUser.publicMetadata.role) {
            user.role = clerkUser.publicMetadata.role;
            await user.save();
          }
        } catch (syncError) {
          console.error("[AUTH-TRACE] Auto-sync failed:", syncError);
          return res.status(401).json({ message: "User not found and sync failed" });
        }
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

