import { Inngest } from "inngest";
import { connectDB } from "./db.js";
import { User } from "../models/user.model.js";

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

      console.log(`Synced Clerk user with existing user: ${email} (${user.role})`);
    } else {
      // ✅ DIRECT SIGNUP (mobile app or web without invite)
      // Default to farmer unless metadata says otherwise (though frontend shouldn't dictate role)
      
      await User.create({
        clerkId,
        email,
        name: name || "New User",
        imageUrl: image_url || "",
        role: "farmer", 
        isVerified,
      });

      console.log(`Created new farmer from Clerk signup: ${email}`);
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
