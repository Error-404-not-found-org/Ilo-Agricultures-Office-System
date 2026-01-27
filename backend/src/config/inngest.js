import { Inngest } from "inngest";
import { connectDB } from "./db.js";
import { User } from "../models/user.model.js";

export const inngest = new Inngest({
  id: "ilo-agricultures-office-system-backend",
});

const syncUser = inngest.createFunction(
  { id: "sync/user" },
  { event: "clerk/user.created" },
  async ({ event }) => {
    await connectDB();

    const {
      id: clerkId,
      first_name,
      last_name,
      image_url,
      email_addresses,
      external_accounts,
    } = event.data;

    const emailObj = email_addresses?.[0];
    const email =
      emailObj?.email_address || external_accounts?.[0]?.email_address;

    if (!email) {
      console.warn(`Skipping user creation: no email for clerkId ${clerkId}`);
      return;
    }

    const isVerified = emailObj?.verification?.status === "verified";

    // 🔎 Find existing user (technician-created)
    let user = await User.findOne({ email });

    if (user) {
      // ✅ ACCEPT INVITE FLOW
      user.clerkId = clerkId;
      user.isVerified = isVerified;
      user.imageUrl = user.imageUrl || image_url;
      await user.save();

      console.log(`Linked Clerk user to existing farmer: ${email}`);
    } else {
      // ✅ DIRECT SIGNUP (mobile app)
      await User.create({
        clerkId,
        email,
        name: `${first_name || ""} ${last_name || ""}`.trim(),
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
