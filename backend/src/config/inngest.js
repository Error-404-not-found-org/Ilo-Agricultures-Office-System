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
    const { id, email_address, first_name, last_name } = event.data;

    const newUser = {
      clerkId: id,
      email: email_address,
      name: `${first_name || ""} ${last_name || ""}` || "User",
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
