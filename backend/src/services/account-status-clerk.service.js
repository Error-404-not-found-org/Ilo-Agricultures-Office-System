import "../config/env.js";
import { clerkClient } from "@clerk/express";

// Resolve the compatible Clerk Users API once so account transitions and
// their regression tests exercise the same runtime client.
export const accountStatusClerkUsers = clerkClient.users;
