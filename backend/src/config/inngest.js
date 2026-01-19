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
    const { id, first_name, last_name, image_url } = event.data;

    const email =
      event.data.email_addresses?.[0]?.email_address ||
      event.data.external_accounts?.[0]?.email_address;

    if (!email) {
      console.warn(`Skipping user creation: no email found for clerkId ${id}`);
      return;
    }

    const newUser = {
      clerkId: id,
      email,
      name: `${first_name || ""} ${last_name || ""}` || "User",
      imageUrl: image_url,
      address: null,
    };
    await User.create(newUser);
  },
);

const deleteUserFromDB = inngest.createFunction(
  { id: "delete/user" },
  { event: "clerk/user.deleted" },
  async ({ event }) => {
    await connectDB();
    const { id } = event.data;
    await User.deleteOne({ clerkId: id });
  },
);

export const functions = [syncUser, deleteUserFromDB];
