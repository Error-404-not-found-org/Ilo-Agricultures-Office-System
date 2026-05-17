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

const handleUserSync = async ({ event }) => {
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
    console.warn(`Skipping user sync: no email for clerkId ${clerkId}`);
    return;
  }

  const isVerified = emailObj?.verification?.status === "verified";
  const name = `${first_name || ""} ${last_name || ""}`.trim();

  let user = await User.findOne({ email });

  if (user) {
    user.clerkId = clerkId;
    user.isVerified = isVerified;
    user.imageUrl = image_url || user.imageUrl;
    user.name = name || user.name;
    await user.save();
  } else {
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

  const currentRole = event.data.public_metadata?.role;
  if (currentRole !== user.role) {
    await clerkClient.users.updateUser(clerkId, {
      publicMetadata: { role: user.role }
    });
    console.log(`Synced role '${user.role}' to Clerk metadata for ${email}`);
  }
};

const syncUserCreated = inngest.createFunction(
  { id: "sync/user-created" },
  { event: "clerk/user.created" },
  handleUserSync
);

const syncUserUpdated = inngest.createFunction(
  { id: "sync/user-updated" },
  { event: "clerk/user.updated" },
  handleUserSync
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

    // --- STEP 1: DAY 18 (HEAT DETECTION) ---
    await step.sleep("wait-for-heat-window", "18 days");

    const stillRelevant18 = await step.run("check-relevance-18", async () => {
      const ins = await Insemination.findById(inseminationId);
      return ins && ins.status === "done" && ins.isSuccess === null;
    });

    if (stillRelevant18) {
      await step.run("send-heat-reminder", async () => {
        const animal = await Animal.findById(animalId);
        await Notification.create({
          recipientId: farmerId,
          senderId: "000000000000000000000000",
          type: "system",
          relatedId: animalId,
          title: "🔥 Heat Detection Reminder",
          message: `It has been 18 days since the insemination of ${animal?.earTag || 'your animal'}. Please observe for signs of heat (estrus) over the next 3 days.`,
        });
      });
    }

    // --- STEP 2: DAY 21 (FARMER CONFIRMATION) ---
    await step.sleep("wait-for-confirmation", "3 days"); // Day 18 + 3 = Day 21

    const stillRelevant21 = await step.run("check-relevance-21", async () => {
      const ins = await Insemination.findById(inseminationId);
      return ins && ins.status === "done" && ins.isSuccess === null;
    });

    if (stillRelevant21) {
      await step.run("ask-farmer-success", async () => {
        const animal = await Animal.findById(animalId);
        await Notification.create({
          recipientId: farmerId,
          senderId: "000000000000000000000000",
          type: "ai-request",
          relatedId: inseminationId,
          title: "🐮 AI Outcome Confirmation",
          message: `It has been 21 days since the insemination of ${animal?.earTag}. Is she still in heat, or do you think she conceived? Click to confirm.`,
        });
      });
    }

    // --- STEP 3: DAY 25 (TECHNICIAN NUDGE) ---
    await step.sleep("wait-for-tech-nudge", "4 days"); // Day 21 + 4 = Day 25

    if (stillRelevant21) {
      await step.run("nudge-technician", async () => {
        const ins = await Insemination.findById(inseminationId).populate("farmerId", "name");
        const technicians = await User.find({ role: "technician" });
        
        await Promise.all(technicians.map(tech => 
          Notification.create({
            recipientId: tech._id,
            senderId: "000000000000000000000000",
            type: "system",
            relatedId: inseminationId,
            title: "📞 Follow-up Required",
            message: `Farmer ${ins.farmerId?.name} has not confirmed the outcome for AI attempt #${ins.attemptNumber}. Please contact them for an update.`,
          })
        ));
      });
    }

    // --- STEP 4: DAY 60 (PD DIAGNOSIS REMINDER) ---
    await step.sleep("wait-for-pd-window", "35 days"); // Day 25 + 35 = Day 60

    const stillRelevant60 = await step.run("check-relevance-60", async () => {
      const ins = await Insemination.findById(inseminationId);
      return ins && ins.status === "done" && ins.isSuccess === null;
    });

    if (stillRelevant60) {
      await step.run("send-pd-reminder", async () => {
        const ins = await Insemination.findById(inseminationId).populate("animalId", "earTag");
        const technicians = await User.find({ role: "technician" });

        await Promise.all(technicians.map(tech => 
          Notification.create({
            recipientId: tech._id,
            senderId: "000000000000000000000000",
            type: "system",
            relatedId: inseminationId,
            title: "🧪 Pregnancy Diagnosis Due",
            message: `Animal ${ins.animalId?.earTag} is now at Day 60 post-AI. Rectal palpation or PD is recommended.`,
          })
        ));
      });
    }
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
 * Nightly background job to update reproductive statuses based on time.
 */
const automatedGestationLifecycle = inngest.createFunction(
  { id: "livestock/gestation-lifecycle" },
  { cron: "0 1 * * *" }, // Run at 1:00 AM daily
  async ({ step }) => {
    await connectDB();

    // 1. Process Inseminated Animals (Flag for PD after 60 days)
    await step.run("flag-for-pregnancy-check", async () => {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const animals = await Animal.find({
        reproductiveStatus: "Inseminated",
        lastInseminationDate: { $lte: sixtyDaysAgo }
      });

      for (const animal of animals) {
        animal.reproductiveStatus = "Likely Pregnant";
        await animal.save();

        // Notify technician
        const technicians = await User.find({ role: "technician" });
        await Promise.all(technicians.map(tech => 
          Notification.create({
            recipientId: tech._id,
            senderId: "000000000000000000000000",
            type: "system",
            relatedId: animal._id,
            title: "⏱️ Pregnancy Diagnosis Due",
            message: `Animal ${animal.earTag} was inseminated 60+ days ago. PD is now due.`,
          })
        ));
      }
      return { flagged: animals.length };
    });

    // 2. Process Pregnant Animals (Notification before calving)
    await step.run("alert-upcoming-calving", async () => {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const animals = await Animal.find({
        reproductiveStatus: "Pregnant",
        expectedCalvingDate: { $lte: sevenDaysFromNow, $gt: new Date() }
      });

      for (const animal of animals) {
        await Notification.create({
          recipientId: animal.farmerId,
          senderId: "000000000000000000000000",
          type: "system",
          relatedId: animal._id,
          title: "🍼 Calving within 7 days",
          message: `Your animal (${animal.earTag}) is expected to calve around ${animal.expectedCalvingDate.toLocaleDateString()}.`,
        });
      }
      return { alertsSent: animals.length };
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

export const functions = [
  syncUserCreated,
  syncUserUpdated,
  deleteUserFromDB, 
  onInseminationApproved, 
  onPregnancyConfirmed, 
  dailyStatsAggregation,
  automatedGestationLifecycle
];
