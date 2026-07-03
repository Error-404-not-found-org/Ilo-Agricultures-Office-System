import { User } from "../models/user.model.js";
import { getClerkUserId } from "./auth.middleware.js";

export const resolveUserMiddleware = async (req, res, next) => {
  try {
    const clerkId = getClerkUserId(req);
    if (clerkId) {
      const user = await User.findOne({ clerkId });
      if (user && !user.deletedAt) {
        req.user = user;
      }
    }
  } catch (err) {
    console.error("[resolveUserMiddleware ERROR]", err);
  }
  next();
};
