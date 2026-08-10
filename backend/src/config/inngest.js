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
import { getLegacyPregnancyReminderRelevance } from "../services/pregnancy-reminder-relevance.service.js";
import { ENV } from "./env.js";

export const inngest = new Inngest({
  id: "ilo-agricultures-office-system-backend",
  eventKey: ENV.INNGEST_EVENT_KEY,
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
        const title = "Watch for signs of heat";
        const body = `It has been 18 days since the AI service for ${animal?.earTag || 'your animal'}. For the next 3 days, watch for standing heat, mounting behavior, or unusual restlessness.`;

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
        const title = "Share a breeding observation";
        const body = `It has been 21 days since the AI service for ${animal?.earTag || 'your animal'}. Report any signs of heat or possible pregnancy for technician review.`;

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
        const title = "Farmer observation follow-up";
        const body = `${ins.farmerId?.name || "A farmer"} has not yet submitted an observation for AI attempt ${ins.attemptNumber}. Contact the farmer if an update is needed.`;
        
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
      const relevance = await getLegacyPregnancyReminderRelevance({ inseminationId });
      return relevance.isRelevant;
    });

    if (stillRelevant60) {
      await step.run("send-pd-reminder", async () => {
        const ins = await Insemination.findById(inseminationId).populate("animalId", "earTag");
        const technicians = await User.find({ role: "technician" });
        const title = "Pregnancy diagnosis is due";
        const body = `${ins.animalId?.earTag || 'The animal'} reached 60 days after AI service. Schedule an appropriate pregnancy diagnosis.`;

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

    // --- STEP 5: DAY 75 (MISSED PD DIAGNOSIS NUDGE) ---
    await step.sleep("wait-for-missed-pd-window", "15 days"); // Day 60 + 15 = Day 75

    const stillRelevant75 = await step.run("check-relevance-75", async () => {
      const relevance = await getLegacyPregnancyReminderRelevance({ inseminationId });
      return relevance.isRelevant;
    });

    if (stillRelevant75) {
      await step.run("send-missed-pd-nudge", async () => {
        const ins = await Insemination.findById(inseminationId).populate("animalId", "earTag");
        const title = "Pregnancy diagnosis is overdue";
        const body = `${ins.animalId?.earTag || 'Your animal'} reached 75 days after AI service without an official pregnancy diagnosis. Please arrange a technician visit.`;

        // Notify Farmer
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

        // Notify all technicians
        const technicians = await User.find({ role: "technician" });
        await Promise.all(technicians.map(async (tech) => {
          await Notification.create({
            recipientId: tech._id,
            senderId: "000000000000000000000000",
            type: "system",
            relatedId: inseminationId,
            title,
            message: `${farmer?.name || 'A farmer'}'s animal (${ins.animalId?.earTag || 'tag not recorded'}) reached 75 days after AI service without an official pregnancy diagnosis.`,
          });
          if (tech.pushToken) {
            await sendPushNotification(tech.pushToken, title, `${farmer?.name || 'A farmer'}'s animal (${ins.animalId?.earTag || 'tag not recorded'}) reached 75 days after AI service without an official pregnancy diagnosis.`);
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

      const farmerTitle = "Prepare for expected calving";
      const farmerBody = `${animal?.earTag || 'Your animal'} is approaching the expected calving period. Prepare a clean, safe calving area and monitor the animal closely.`;

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
      const techTitle = "Expected calving approaching";
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

    // Step 3: Wait for calving overdue (approx 20 days later / Day 290 total)
    await step.sleep("wait-for-calving-overdue", "20 days");

    // Step 4: Check if animal is still marked as Pregnant (meaning no calving recorded yet)
    const stillPregnant = await step.run("check-pregnant-status", async () => {
      const animal = await Animal.findById(animalId);
      return animal && animal.reproductiveStatus === "Pregnant";
    });

    if (stillPregnant) {
      await step.run("send-overdue-calving-alert", async () => {
        const animal = await Animal.findById(animalId);
        const farmer = await User.findById(farmerId);
        const title = "Expected calving date has passed";
        const body = `${animal?.earTag || 'Your animal'} is more than 10 days past the expected calving date. Check for distress or difficulty giving birth and contact a technician promptly.`;

        // Notify Farmer
        await Notification.create({
          recipientId: farmerId,
          senderId: "000000000000000000000000",
          type: "system",
          relatedId: animalId,
          title,
          message: body,
        });

        if (farmer?.pushToken) {
          await sendPushNotification(farmer.pushToken, title, body);
        }

        // Notify all technicians
        const technicians = await User.find({ role: "technician" });
        await Promise.all(technicians.map(async (tech) => {
          await Notification.create({
            recipientId: tech._id,
            senderId: "000000000000000000000000",
            type: "system",
            relatedId: animalId,
            title,
            message: `${farmer?.name || 'A farmer'}'s animal (${animal?.earTag || 'tag not recorded'}) is past the expected calving date and may need assistance.`,
          });
          if (tech.pushToken) {
            await sendPushNotification(tech.pushToken, title, `${farmer?.name || 'A farmer'}'s animal (${animal?.earTag || 'tag not recorded'}) is past the expected calving date and may need assistance.`);
          }
        }));
      });
    }
  }
);

/**
 * Triggered when a calving event is recorded.
 * Waits for the Voluntary Waiting Period (VWP, e.g. 60 days) to recommend re-breeding.
 */
const onCalvingRecorded = inngest.createFunction(
  { id: "livestock/vwp-reminder" },
  { event: "livestock/calving-recorded" },
  async ({ event, step }) => {
    await connectDB();
    const {
      animalId,
      farmerId,
      calvingId,
      outcome = "live_birth",
    } = event.data;

    await step.run("send-calving-recorded-push", async () => {
      const [animal, farmer] = await Promise.all([
        Animal.findById(animalId),
        User.findById(farmerId),
      ]);
      if (!farmer?.pushToken) return;

      const animalTag = animal?.earTag || animal?.animalId || "the animal";
      const eventType = outcome === "abortion" ? "pregnancy_loss" : "calving_recorded";
      const outcomeSummary =
        outcome === "abortion"
          ? `A pregnancy loss was recorded for ${animalTag}. Open the record for follow-up details.`
          : outcome === "stillbirth"
            ? `A stillbirth was recorded for ${animalTag}. Open the record for details and follow-up guidance.`
            : `A calving outcome was recorded for ${animalTag}. Open the record to review the delivery details.`;

      await sendPushNotification(
        farmer.pushToken,
        outcome === "abortion" ? "Pregnancy loss recorded" : "Calving recorded",
        outcomeSummary,
        {
          type: "system",
          eventType,
          relatedId: calvingId || animalId,
          linkType: calvingId ? "record" : "animal",
          recordId: calvingId,
          animalId,
          animalTag,
          outcomeSummary,
        },
      );
    });

    // Wait for VWP period (typically 60 days)
    await step.sleep("wait-for-vwp-window", "60 days");

    // Check if the animal is still Open (reproductiveStatus is 'Open' or not Pregnant/Inseminated)
    const readyForBreeding = await step.run("check-breeding-readiness", async () => {
      const animal = await Animal.findById(animalId);
      return (
        animal &&
        animal.reproductiveStatus !== "Pregnant" &&
        animal.reproductiveStatus !== "Inseminated" &&
        animal.reproductiveStatus !== "Likely Pregnant"
      );
    });

    if (readyForBreeding) {
      await step.run("send-vwp-reminder", async () => {
        const animal = await Animal.findById(animalId);
        const title = "Breeding review is available";
        const recoveryEvent = outcome === "abortion"
          ? "pregnancy loss"
          : outcome === "stillbirth"
            ? "stillbirth"
            : "calving";
        const body = `Your animal Tag #${animal?.earTag || 'your animal'} has completed the 60-day recovery period following ${recoveryEvent} and may be evaluated for re-breeding.`;

        // Notify Farmer (In-app)
        await Notification.create({
          recipientId: farmerId,
          senderId: "000000000000000000000000",
          type: "system",
          relatedId: animalId,
          title,
          message: body,
        });

        // Notify Farmer (Push)
        const farmer = await User.findById(farmerId);
        if (farmer?.pushToken) {
          await sendPushNotification(farmer.pushToken, title, body);
        }
      });
    }
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
      const title = "Pregnancy diagnosis is due";

      let reminders = 0;
      for (const animal of animals) {
        const insemination = await Insemination.findOne({
          animalId: animal._id,
          status: "done",
          deletedAt: null,
        }).sort({ inseminationDate: -1, createdAt: -1 });
        if (!insemination) continue;
        const relevance = await getLegacyPregnancyReminderRelevance({
          inseminationId: insemination._id,
        });
        if (!relevance.isRelevant) continue;

        const body = `${animal.earTag || 'The animal'} reached 60 days after AI service. Schedule an appropriate pregnancy diagnosis.`;

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
        reminders += 1;
      }
      return { reminders };
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
        const farmerTitle = "Expected calving within 7 days";
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
        const techTitle = "Expected calving approaching";
        const techBody = `${farmer?.name || 'A farmer'}'s animal (${animal.earTag || 'tag not recorded'}) is expected to calve around ${new Date(animal.expectedCalvingDate).toLocaleDateString()}.`;
        
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
          const title = "AI service record needed";
          const body = `Today's AI visit for ${request.farmerId?.name || 'the farmer'} and ${request.animalId?.earTag || request.animalId?.animalId || 'the animal'} does not have a completed service record. Open the visit to finish it.`;
          
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
          const title = "Health service record needed";
          const body = `Today's health visit for ${request.farmerId?.name || 'the farmer'} and ${request.animalId?.earTag || request.animalId?.animalId || 'the animal'} does not have a completed service record. Open the visit to finish it.`;
          
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
  onCalvingRecorded,
  dailyStatsAggregation,
  automatedGestationLifecycle,
  remindPendingServices
];
