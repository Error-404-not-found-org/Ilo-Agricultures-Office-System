import { Inngest } from "inngest";
import { connectDB } from "./db.js";
import { User } from "../models/user.model.js";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Notification } from "../models/notification.model.js";
import { Config } from "../models/config.model.js";
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

// --- LIVESTOCK LIFECYCLE AUTOMATION ---

/**
 * Triggered when a technician records an insemination.
 * Automates the "Heat Detection" window reminder.
 */
const onInseminationApproved = inngest.createFunction(
  { id: "livestock/heat-reminder" },
  { event: "insemination/approved" },
  async ({ event, step }) => {
    await connectDB();
    const { inseminationId, animalId, farmerId } = event.data;

    // Step 1: Wait for the Heat Window (approx 21 days)
    // We wait 18 days to give the farmer a "pre-alert"
    await step.sleep("wait-for-heat-window", "18 days");

    // Step 2: Check if a new insemination was already recorded during the wait
    const latest = await step.run("check-latest-status", async () => {
      const recent = await Insemination.findOne({ animalId }).sort({ createdAt: -1 });
      return recent && recent._id.toString() !== inseminationId;
    });

    if (latest) return { message: "Animal already re-inseminated, cancelling reminder." };

    // Step 3: Send Notification
    await step.run("send-heat-reminder", async () => {
      const animal = await Animal.findById(animalId);
      await Notification.create({
        recipientId: farmerId,
        senderId: "000000000000000000000000", // System ID
        type: "system",
        relatedId: animalId,
        title: "🔥 Heat Detection Reminder",
        message: `It has been 18 days since the insemination of ${animal?.earTag || 'your animal'}. Please observe for signs of heat (estrus) over the next 3 days.`,
      });
    });
  }
);

/**
 * Triggered when a pregnancy check is marked as "Pregnant".
 * Automates the "Calving Imminent" reminder.
 */
const onPregnancyConfirmed = inngest.createFunction(
  { id: "livestock/calving-reminder" },
  { event: "pregnancy/confirmed" },
  async ({ event, step }) => {
    await connectDB();
    const { pregnancyId, animalId, farmerId } = event.data;

    // Step 1: Wait for late-term (approx 270 days for cattle)
    await step.sleep("wait-for-gestation", "270 days");

    // Step 2: Send Notification
    await step.run("send-calving-alert", async () => {
      const animal = await Animal.findById(animalId);
      const farmer = await User.findById(farmerId);

      // Notify Farmer
      await Notification.create({
        recipientId: farmerId,
        senderId: "000000000000000000000000",
        type: "system",
        relatedId: animalId,
        title: "🍼 Calving Imminent",
        message: `Reminder: ${animal?.earTag || 'Your animal'} is approaching the 280-day gestation mark. Please prepare the calving area.`,
      });

      // Notify all technicians
      const technicians = await User.find({ role: "technician" });
      await Promise.all(technicians.map(tech => 
        Notification.create({
          recipientId: tech._id,
          senderId: "000000000000000000000000",
          type: "system",
          relatedId: animalId,
          title: "⚠️ Upcoming Calving",
          message: `Farmer ${farmer?.name}'s animal (${animal?.earTag}) is due for calving soon.`,
        })
      ));
    });
  }
);

/**
 * Nightly aggregation for dashboard stats.
 * Runs at midnight to calculate the 90-day success rate.
 */
const dailyStatsAggregation = inngest.createFunction(
  { id: "maintenance/daily-stats" },
  { cron: "0 0 * * *" }, // Midnight daily
  async ({ step }) => {
    await connectDB();

    await step.run("calculate-and-cache-stats", async () => {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const [totalAI, totalPreg] = await Promise.all([
        Insemination.countDocuments({ createdAt: { $gte: ninetyDaysAgo }, status: "done" }),
        Pregnancy.countDocuments({ "pregnancyDiagnosis.result": "Pregnant", createdAt: { $gte: ninetyDaysAgo } })
      ]);

      const successRate = totalAI > 0 ? ((totalPreg / totalAI) * 100).toFixed(1) + "%" : "0%";

      // Save to Config collection
      await Config.findOneAndUpdate(
        { key: "dashboard_success_rate" },
        { value: successRate, updatedAt: new Date() },
        { returnDocument: 'after', upsert: true }
      );

      return { successRate };
    });
  }
);

export const functions = [syncUser, deleteUserFromDB, onInseminationApproved, onPregnancyConfirmed, dailyStatsAggregation];
