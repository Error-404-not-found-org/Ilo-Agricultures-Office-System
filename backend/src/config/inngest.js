import { Inngest } from "inngest";
import { connectDB } from "./db.js";
import { User } from "../models/user.model.js";
import { clerkClient } from "@clerk/clerk-sdk-node";

export const inngest = new Inngest({
  id: "ilo-agricultures-office-system-backend",
});

const syncUser = inngest.createFunction(
  { id: "sync/user" },
  { event: ["clerk/user.created", "clerk/user.updated"] },
  async ({ event }) => {
    await connectDB();

    const {
      id: clerkId,
      first_name,
      last_name,
      image_url,
      email_addresses,
      external_accounts,
      unsafe_metadata, // This might contain role logic if needed, but we prefer DB role
    } = event.data;

    const emailObj = email_addresses?.[0];
    const email =
      emailObj?.email_address || external_accounts?.[0]?.email_address;

    if (!email) {
      console.warn(`Skipping user sync: no email for clerkId ${clerkId}`);
      return;
    }

    const isVerified = emailObj?.verification?.status === "verified";
    const name = `${first_name || ""} ${last_name || ""}`.trim();

    // 🔎 Find existing user (technician-created or just existing)
    let user = await User.findOne({ email });

    if (user) {
      // ✅ UPDATE EXISTING USER / ACCEPT INVITE FLOW
      user.clerkId = clerkId;
      user.isVerified = isVerified;
      user.imageUrl = image_url || user.imageUrl;
      user.name = name || user.name;
      await user.save();
    } else {
      // ✅ DIRECT SIGNUP (mobile app or web without invite)
      // Default to farmer unless metadata says otherwise (though frontend shouldn't dictate role)
      
      user = await User.create({
        clerkId,
        email,
        name: name || "New User",
        imageUrl: image_url || "",
        role: "farmer", 
        isVerified,
      });
      console.log(`Created new farmer from Clerk signup: ${email}`);
    }

    // 🔄 SYNC ROLE TO CLERK METADATA (Critical for Frontend RBAC)
    // Check if role is already set in metadata to avoid infinite loop
    const currentRole = event.data.public_metadata?.role;
    if (currentRole !== user.role) {
      await clerkClient.users.updateUser(clerkId, {
        publicMetadata: { role: user.role }
      });
      console.log(`Synced role '${user.role}' to Clerk metadata for ${email}`);
    }
  },
);

const deleteUserFromDB = inngest.createFunction(
  { id: "delete/user" },
  { event: "clerk/user.deleted" },
  async ({ event }) => {
    await connectDB();
    const { id: clerkId } = event.data;
    await User.deleteOne({ clerkId });
  },
);

export const functions = [syncUser, deleteUserFromDB];
