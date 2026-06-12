import { Inngest } from "inngest";
import { connectDB } from "./db.js";
import { User } from "../models/user.model.js";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Notification } from "../models/notification.model.js";
import { Config } from "../models/config.model.js";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { sendPushNotification } from "../lib/push-notifications.js";

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
    const role = (email && process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase()) ? "admin" : "farmer";
    user = await User.create({
      clerkId,
      email,
      name: name || "New User",
      imageUrl: image_url || "",
      role, 
      isVerified,
    });
    console.log(`Created new ${role} from Clerk signup: ${email}`);
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
        const title = "🔥 Heat Detection Reminder";
        const body = `It has been 18 days since the insemination of ${animal?.earTag || 'your animal'}. Please observe for signs of heat (estrus) over the next 3 days.`;

        await Notification.create({
          recipientId: farmerId,
          senderId: "000000000000000000000000",
          type: "system",
          relatedId: animalId,
          title,
          message: body,
        });

        const farmer = await User.findById(farmerId);
        if (farmer?.pushToken) {
          await sendPushNotification(farmer.pushToken, title, body);
        }
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
        const title = "🐮 AI Outcome Confirmation";
        const body = `It has been 21 days since the insemination of ${animal?.earTag || 'your animal'}. Is she still in heat, or do you think she conceived? Click to confirm.`;

        await Notification.create({
          recipientId: farmerId,
          senderId: "000000000000000000000000",
          type: "ai-request",
          relatedId: inseminationId,
          title,
          message: body,
        });

        const farmer = await User.findById(farmerId);
        if (farmer?.pushToken) {
          await sendPushNotification(farmer.pushToken, title, body);
        }
      });
    }

    // --- STEP 3: DAY 25 (TECHNICIAN NUDGE) ---
    await step.sleep("wait-for-tech-nudge", "4 days"); // Day 21 + 4 = Day 25

    if (stillRelevant21) {
      await step.run("nudge-technician", async () => {
        const ins = await Insemination.findById(inseminationId).populate("farmerId", "name");
        const technicians = await User.find({ role: "technician" });
        const title = "📞 Follow-up Required";
        const body = `Farmer ${ins.farmerId?.name} has not confirmed the outcome for AI attempt #${ins.attemptNumber}. Please contact them for an update.`;
        
        await Promise.all(technicians.map(async (tech) => {
          await Notification.create({
            recipientId: tech._id,
            senderId: "000000000000000000000000",
            type: "system",
            relatedId: inseminationId,
            title,
            message: body,
          });
          if (tech.pushToken) {
            await sendPushNotification(tech.pushToken, title, body);
          }
        }));
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
        const title = "🧪 Pregnancy Diagnosis Due";
        const body = `Animal ${ins.animalId?.earTag || 'the animal'} is now at Day 60 post-AI. Rectal palpation or PD is recommended.`;

        await Promise.all(technicians.map(async (tech) => {
          await Notification.create({
            recipientId: tech._id,
            senderId: "000000000000000000000000",
            type: "system",
            relatedId: inseminationId,
            title,
            message: body,
          });
          if (tech.pushToken) {
            await sendPushNotification(tech.pushToken, title, body);
          }
        }));
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

      const farmerTitle = "🍼 Calving Imminent";
      const farmerBody = `Reminder: ${animal?.earTag || 'Your animal'} is approaching the 280-day gestation mark. Please prepare the calving area.`;

      // Notify Farmer (In-app)
      await Notification.create({
        recipientId: farmerId,
        senderId: "000000000000000000000000",
        type: "system",
        relatedId: animalId,
        title: farmerTitle,
        message: farmerBody,
      });

      // Notify Farmer (Push)
      if (farmer?.pushToken) {
        await sendPushNotification(farmer.pushToken, farmerTitle, farmerBody);
      }

      // Notify all technicians
      const technicians = await User.find({ role: "technician" });
      const techTitle = "⚠️ Upcoming Calving";
      const techBody = `Farmer ${farmer?.name || 'Farmer'}'s animal (${animal?.earTag || 'animal'}) is due for calving soon.`;

      await Promise.all(technicians.map(async (tech) => {
        await Notification.create({
          recipientId: tech._id,
          senderId: "000000000000000000000000",
          type: "system",
          relatedId: animalId,
          title: techTitle,
          message: techBody,
        });
        if (tech.pushToken) {
          await sendPushNotification(tech.pushToken, techTitle, techBody);
        }
      }));
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

      const technicians = await User.find({ role: "technician" });
      const title = "⏱️ Pregnancy Diagnosis Due";

      for (const animal of animals) {
        animal.reproductiveStatus = "Likely Pregnant";
        await animal.save();

        const body = `Animal ${animal.earTag || 'the animal'} was inseminated 60+ days ago. PD is now due.`;

        // Notify technicians
        await Promise.all(technicians.map(async (tech) => {
          await Notification.create({
            recipientId: tech._id,
            senderId: "000000000000000000000000",
            type: "system",
            relatedId: animal._id,
            title,
            message: body,
          });
          if (tech.pushToken) {
            await sendPushNotification(tech.pushToken, title, body);
          }
        }));
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
      }).populate("farmerId");

      const technicians = await User.find({ role: "technician" });

      for (const animal of animals) {
        const farmer = animal.farmerId;
        const farmerTitle = "🍼 Calving within 7 days";
        const farmerBody = `Your animal (${animal.earTag || 'your animal'}) is expected to calve around ${new Date(animal.expectedCalvingDate).toLocaleDateString()}.`;

        if (farmer) {
          // Notify Farmer (In-app)
          await Notification.create({
            recipientId: farmer._id,
            senderId: "000000000000000000000000",
            type: "system",
            relatedId: animal._id,
            title: farmerTitle,
            message: farmerBody,
          });

          // Notify Farmer (Push)
          if (farmer.pushToken) {
            await sendPushNotification(farmer.pushToken, farmerTitle, farmerBody);
          }
        }

        // Notify Technicians (In-app & Push)
        const techTitle = "⚠️ Upcoming Calving";
        const techBody = `Farmer ${farmer?.name || 'Farmer'}'s cow (${animal.earTag || 'animal'}) is expected to calve around ${new Date(animal.expectedCalvingDate).toLocaleDateString()}.`;
        
        for (const tech of technicians) {
          await Notification.create({
            recipientId: tech._id,
            senderId: "000000000000000000000000",
            type: "system",
            relatedId: animal._id,
            title: techTitle,
            message: techBody,
          });
          if (tech.pushToken) {
            await sendPushNotification(tech.pushToken, techTitle, techBody);
          }
        }
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

/**
 * Daily job at 4:00 PM to remind technicians of pending scheduled visits.
 */
const remindPendingServices = inngest.createFunction(
  { id: "livestock/pending-service-reminder" },
  { cron: "0 16 * * *" }, // Run at 4:00 PM daily
  async ({ step }) => {
    await connectDB();

    await step.run("remind-technicians", async () => {
      // Find all AI/Health requests scheduled for today or earlier that are not done/resolved/cancelled
      const pendingAI = await Insemination.find({
        status: { $in: ["approved", "in-progress"] },
        scheduledDate: { $lte: new Date() }
      }).populate("farmerId", "name").populate("animalId", "earTag animalId").populate("approvedBy");

      const pendingHealth = await HealthRequest.find({
        status: { $in: ["approved", "in-progress"] },
        scheduledDate: { $lte: new Date() }
      }).populate("farmerId", "name").populate("animalId", "earTag animalId").populate("handledBy");

      // Notify Technicians for pending AI
      for (const request of pendingAI) {
        const tech = request.approvedBy;
        if (tech) {
          const title = "⏰ Pending AI Service Log";
          const body = `Your AI visit today for Mr. ${request.farmerId?.name || 'Farmer'}'s cow (${request.animalId?.earTag || request.animalId?.animalId}) is pending. Please log the results.`;
          
          await Notification.create({
            recipientId: tech._id,
            senderId: "000000000000000000000000",
            type: "ai-request",
            relatedId: request._id,
            title,
            message: body,
          });

          if (tech.pushToken) {
            await sendPushNotification(tech.pushToken, title, body);
          }
        }
      }

      // Notify Technicians for pending Health
      for (const request of pendingHealth) {
        const tech = request.handledBy;
        if (tech) {
          const title = "⏰ Pending Health Visit Log";
          const body = `Your health visit today for Mr. ${request.farmerId?.name || 'Farmer'}'s cow (${request.animalId?.earTag || request.animalId?.animalId}) is pending. Please log the results.`;
          
          await Notification.create({
            recipientId: tech._id,
            senderId: "000000000000000000000000",
            type: "health-request",
            relatedId: request._id,
            title,
            message: body,
          });

          if (tech.pushToken) {
            await sendPushNotification(tech.pushToken, title, body);
          }
        }
      }

      return { AI_reminded: pendingAI.length, Health_reminded: pendingHealth.length };
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
  automatedGestationLifecycle,
  remindPendingServices
];
