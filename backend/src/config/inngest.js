import { Inngest } from "inngest";
import { connectDB } from "./db.js";
import { User } from "../models/user.model.js";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Calving } from "../models/calving.model.js";
import { Config } from "../models/config.model.js";
import { clerkClient } from "@clerk/clerk-sdk-node";
import {
  notifyUserBestEffort,
  sendNotificationPush,
} from "../services/notification-delivery.service.js";
import { getLegacyPregnancyReminderRelevance } from "../services/pregnancy-reminder-relevance.service.js";
import {
  buildPendingServiceReminderQueries,
  buildReminderDedupeKey,
  getExpectedCalvingReminderDates,
  isExpectedCalvingReminderEligible,
} from "../services/background-reminder.service.js";
import { HEAT_RETURN_MONITORING_POLICY, isTerminalAIAttempt, getHeatReturnMonitoringDates } from "../domain/reproduction-policy.js";
import { ENV } from "./env.js";
import { resolveReproductiveNotificationTechnicians } from "../services/notification-recipient-authority.service.js";

export const inngest = new Inngest({
  id: "ilo-agricultures-office-system-backend",
  eventKey: ENV.INNGEST_EVENT_KEY,
});

const SYSTEM_SENDER_ID = "000000000000000000000000";

const sendBackgroundReminder = ({ context, ...payload }) =>
  notifyUserBestEffort(
    { senderId: SYSTEM_SENDER_ID, ...payload },
    context || "background-reminder",
  );

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

    const baseDate = await step.run("fetch-insemination-date", async () => {
      const ins = await Insemination.findById(inseminationId);
      if (!ins) return null;
      return ins.inseminationDate || ins.createdAt;
    });

    if (!baseDate) return;

    // Use canonical domain logic
    const dates = getHeatReturnMonitoringDates(baseDate);

    // --- STEP 1: DAY 18 (HEAT DETECTION) ---
    if (dates.observationWindowStartDate > new Date()) {
      await step.sleepUntil("wait-for-heat-window", dates.observationWindowStartDate);

      const stillRelevant18 = await step.run("check-relevance-18", async () => {
        const ins = await Insemination.findById(inseminationId);
        return ins && ins.status === "done" && !isTerminalAIAttempt(ins);
      });

      if (stillRelevant18) {
        await step.run("send-heat-reminder", async () => {
          const animal = await Animal.findById(animalId);
          const title = "Watch for signs of heat";
          const body = `It has been ${HEAT_RETURN_MONITORING_POLICY.observationWindowStartDays} days since the AI service for ${animal?.earTag || 'your animal'}. For the next 3 days, watch for standing heat, mounting behavior, or unusual restlessness.`;

          const farmer = await User.findById(farmerId);
          await sendBackgroundReminder({
            context: "ai-heat-window-reminder",
            recipient: farmer,
            recipientId: farmerId,
            type: "system",
            relatedId: animalId,
            eventType: "ai_heat_window_start",
            linkType: "animal",
            dedupeKey: buildReminderDedupeKey({
              eventType: "ai-heat-window-start",
              relatedId: inseminationId,
              recipientId: farmerId,
              milestoneDate: dates.observationWindowStartDate,
            }),
            title,
            message: body,
          });
        });
      }
    }

    // --- STEP 2: DAY 21 (FARMER CONFIRMATION) ---
    if (dates.expectedEstrousCycleDate > new Date()) {
      await step.sleepUntil("wait-for-confirmation", dates.expectedEstrousCycleDate);

      const stillRelevant21 = await step.run("check-relevance-21", async () => {
        const ins = await Insemination.findById(inseminationId);
        return ins && ins.status === "done" && !isTerminalAIAttempt(ins);
      });

      if (stillRelevant21) {
        await step.run("ask-farmer-success", async () => {
          const animal = await Animal.findById(animalId);
          const title = "Share a breeding observation";
          const body = `It has been ${HEAT_RETURN_MONITORING_POLICY.expectedEstrousCycleDays} days since the AI service for ${animal?.earTag || 'your animal'}. Report any signs of heat or possible pregnancy for technician review.`;

          const farmer = await User.findById(farmerId);
          await sendBackgroundReminder({
            context: "ai-farmer-follow-up-reminder",
            recipient: farmer,
            recipientId: farmerId,
            type: "ai-request",
            relatedId: inseminationId,
            eventType: "ai_farmer_follow_up",
            linkType: "request",
            dedupeKey: buildReminderDedupeKey({
              eventType: "ai-farmer-follow-up",
              relatedId: inseminationId,
              recipientId: farmerId,
              milestoneDate: dates.expectedEstrousCycleDate,
            }),
            title,
            message: body,
          });
        });
      }
    }

    // --- STEP 3: DAY 25 (TECHNICIAN NUDGE) ---
    if (dates.technicianFollowUpDate > new Date()) {
      await step.sleepUntil("wait-for-tech-nudge", dates.technicianFollowUpDate);

      const stillRelevant25 = await step.run("check-relevance-25", async () => {
        const ins = await Insemination.findById(inseminationId);
        return ins && ins.status === "done" && !isTerminalAIAttempt(ins);
      });

      if (stillRelevant25) {
        await step.run("nudge-technician", async () => {
          const ins = await Insemination.findById(inseminationId).populate("farmerId", "name");
          const technicians = await resolveReproductiveNotificationTechnicians({
            insemination: ins,
          });
          const title = "Farmer observation follow-up";
          const body = `${ins.farmerId?.name || "A farmer"} has not yet submitted an observation for AI attempt ${ins.attemptNumber}. Contact the farmer if an update is needed.`;

          await Promise.all(technicians.map(async (tech) => {
            await sendBackgroundReminder({
              context: "ai-technician-follow-up-reminder",
              recipient: tech,
              recipientId: tech._id,
              type: "system",
              relatedId: inseminationId,
              eventType: "ai_technician_follow_up",
              linkType: "request",
              dedupeKey: buildReminderDedupeKey({
                eventType: "ai-technician-follow-up",
                relatedId: inseminationId,
                recipientId: tech._id,
                milestoneDate: dates.technicianFollowUpDate,
              }),
              title,
              message: body,
            });
          }));
        });
      }
    }

    // --- STEP 4: DAY 60 (PD DIAGNOSIS REMINDER) ---
    if (dates.pregnancyDiagnosisDueDate > new Date()) {
      await step.sleepUntil(
        "wait-for-pd-window",
        dates.pregnancyDiagnosisDueDate,
      );
    }

    const stillRelevant60 = await step.run("check-relevance-60", async () => {
      const relevance = await getLegacyPregnancyReminderRelevance({ inseminationId });
      return relevance.isRelevant;
    });

    if (stillRelevant60) {
      await step.run("send-pd-reminder", async () => {
        const ins = await Insemination.findById(inseminationId).populate("animalId", "earTag");
        const technicians = await resolveReproductiveNotificationTechnicians({
          insemination: ins,
        });
        const title = "Pregnancy diagnosis is due";
        const body = `${ins.animalId?.earTag || 'The animal'} reached 60 days after AI service. Schedule an appropriate pregnancy diagnosis.`;

        await Promise.all(technicians.map(async (tech) => {
          await sendBackgroundReminder({
            context: "ai-pregnancy-diagnosis-due-reminder",
            recipient: tech,
            recipientId: tech._id,
            type: "system",
            relatedId: inseminationId,
            eventType: "pregnancy_diagnosis_due",
            linkType: "request",
            dedupeKey: buildReminderDedupeKey({
              eventType: "ai-pregnancy-diagnosis-due",
              relatedId: inseminationId,
              recipientId: tech._id,
              milestoneDate: dates.pregnancyDiagnosisDueDate,
            }),
            title,
            message: body,
          });
        }));
      });
    }

    // --- STEP 5: DAY 75 (MISSED PD DIAGNOSIS NUDGE) ---
    if (dates.pregnancyDiagnosisOverdueDate > new Date()) {
      await step.sleepUntil(
        "wait-for-missed-pd-window",
        dates.pregnancyDiagnosisOverdueDate,
      );
    }

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
        const farmer = await User.findById(farmerId);
        await sendBackgroundReminder({
          context: "ai-pregnancy-diagnosis-overdue-reminder",
          recipient: farmer,
          recipientId: farmerId,
          type: "system",
          relatedId: animalId,
          eventType: "pregnancy_diagnosis_overdue",
          linkType: "animal",
          dedupeKey: buildReminderDedupeKey({
            eventType: "ai-pregnancy-diagnosis-overdue",
            relatedId: inseminationId,
            recipientId: farmerId,
            milestoneDate: dates.pregnancyDiagnosisOverdueDate,
          }),
          title,
          message: body,
        });

        // Notify only the current reproductive-work owner.
        const technicians = await resolveReproductiveNotificationTechnicians({
          insemination: ins,
        });
        await Promise.all(technicians.map(async (tech) => {
          const technicianBody = `${farmer?.name || 'A farmer'}'s animal (${ins.animalId?.earTag || 'tag not recorded'}) reached 75 days after AI service without an official pregnancy diagnosis.`;
          await sendBackgroundReminder({
            context: "ai-pregnancy-diagnosis-overdue-technician-reminder",
            recipient: tech,
            recipientId: tech._id,
            type: "system",
            relatedId: inseminationId,
            eventType: "pregnancy_diagnosis_overdue",
            linkType: "request",
            dedupeKey: buildReminderDedupeKey({
              eventType: "ai-pregnancy-diagnosis-overdue",
              relatedId: inseminationId,
              recipientId: tech._id,
              milestoneDate: dates.pregnancyDiagnosisOverdueDate,
            }),
            title,
            message: technicianBody,
          });
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
    const { pregnancyId, inseminationId, animalId, farmerId } = event.data;

    const reminderContext = await step.run("resolve-calving-reminder-date", async () => {
      if (!pregnancyId && !inseminationId) return null;
      const pregnancy = pregnancyId
        ? await Pregnancy.findById(pregnancyId)
        : await Pregnancy.findOne({ inseminationId });
      const dates = getExpectedCalvingReminderDates(
        pregnancy?.targetCalvingDate,
      );
      if (!pregnancy || !dates) return null;
      return {
        pregnancyId: pregnancy._id,
        animalId: pregnancy.animalId || animalId,
        farmerId: pregnancy.farmerId || farmerId,
        ...dates,
      };
    });

    if (!reminderContext) return { skipped: "expected-calving-date-missing" };

    const upcomingReminderDate = new Date(reminderContext.upcoming);
    const overdueReminderDate = new Date(reminderContext.overdue);

    if (upcomingReminderDate > new Date()) {
      await step.sleepUntil(
        "wait-for-expected-calving-window",
        upcomingReminderDate,
      );
    }

    await step.run("send-calving-alert", async () => {
      const [pregnancy, animal, farmer] = await Promise.all([
        Pregnancy.findById(reminderContext.pregnancyId),
        Animal.findById(reminderContext.animalId),
        User.findById(reminderContext.farmerId),
      ]);
      if (!isExpectedCalvingReminderEligible({ pregnancy, animal })) return;
      if (new Date() >= new Date(pregnancy.targetCalvingDate)) return;
      const technicians = await resolveReproductiveNotificationTechnicians({
        pregnancy,
      });

      const farmerTitle = "Expected calving within 7 days";
      const farmerBody = `Your animal (${animal.earTag || 'your animal'}) is expected to calve around ${new Date(pregnancy.targetCalvingDate).toLocaleDateString()}.`;
      if (farmer) {
        await sendBackgroundReminder({
          context: "expected-calving-farmer-reminder",
          recipient: farmer,
          recipientId: farmer._id,
          type: "system",
          relatedId: animal._id,
          category: "calving",
          eventType: "expected_calving_7d",
          linkType: "animal",
          dedupeKey: buildReminderDedupeKey({
            eventType: "expected-calving-7d",
            relatedId: pregnancy._id,
            recipientId: farmer._id,
            milestoneDate: pregnancy.targetCalvingDate,
          }),
          title: farmerTitle,
          message: farmerBody,
          metadata: { pregnancyId: pregnancy._id, animalId: animal._id },
        });
      }

      const techTitle = "Expected calving approaching";
      const techBody = `${farmer?.name || 'A farmer'}'s animal (${animal.earTag || 'tag not recorded'}) is expected to calve around ${new Date(pregnancy.targetCalvingDate).toLocaleDateString()}.`;
      await Promise.all(technicians.map((tech) => sendBackgroundReminder({
        context: "expected-calving-technician-reminder",
        recipient: tech,
        recipientId: tech._id,
        type: "system",
        relatedId: animal._id,
        category: "calving",
        eventType: "expected_calving_7d",
        linkType: "animal",
        dedupeKey: buildReminderDedupeKey({
          eventType: "expected-calving-7d",
          relatedId: pregnancy._id,
          recipientId: tech._id,
          milestoneDate: pregnancy.targetCalvingDate,
        }),
        title: techTitle,
        message: techBody,
        metadata: { pregnancyId: pregnancy._id, animalId: animal._id },
      })));
    });

    if (overdueReminderDate > new Date()) {
      await step.sleepUntil(
        "wait-for-calving-overdue",
        overdueReminderDate,
      );
    }

    await step.run("send-overdue-calving-alert", async () => {
      const [pregnancy, animal, farmer] = await Promise.all([
        Pregnancy.findById(reminderContext.pregnancyId),
        Animal.findById(reminderContext.animalId),
        User.findById(reminderContext.farmerId),
      ]);
      if (!isExpectedCalvingReminderEligible({ pregnancy, animal })) return;
      const technicians = await resolveReproductiveNotificationTechnicians({
        pregnancy,
      });

      const title = "Expected calving date has passed";
      const body = `${animal.earTag || 'Your animal'} is more than 10 days past the expected calving date. Check for distress or difficulty giving birth and contact a technician promptly.`;
      if (farmer) {
        await sendBackgroundReminder({
          context: "overdue-calving-farmer-reminder",
          recipient: farmer,
          recipientId: farmer._id,
          type: "system",
          relatedId: animal._id,
          category: "calving",
          eventType: "expected_calving_overdue",
          linkType: "animal",
          dedupeKey: buildReminderDedupeKey({
            eventType: "expected-calving-overdue-10d",
            relatedId: pregnancy._id,
            recipientId: farmer._id,
            milestoneDate: pregnancy.targetCalvingDate,
          }),
          title,
          message: body,
          metadata: { pregnancyId: pregnancy._id, animalId: animal._id },
        });
      }

      await Promise.all(technicians.map((tech) => sendBackgroundReminder({
        context: "overdue-calving-technician-reminder",
        recipient: tech,
        recipientId: tech._id,
        type: "system",
        relatedId: animal._id,
        category: "calving",
        eventType: "expected_calving_overdue",
        linkType: "animal",
        dedupeKey: buildReminderDedupeKey({
          eventType: "expected-calving-overdue-10d",
          relatedId: pregnancy._id,
          recipientId: tech._id,
          milestoneDate: pregnancy.targetCalvingDate,
        }),
        title,
        message: `${farmer?.name || 'A farmer'}'s animal (${animal.earTag || 'tag not recorded'}) is past the expected calving date and may need assistance.`,
        metadata: { pregnancyId: pregnancy._id, animalId: animal._id },
      })));
    });
  }
);

/**
 * Triggered when a calving event is recorded.
 * Waits for the Voluntary Waiting Period (VWP, e.g. 60 days) to recommend re-breeding.
 */
export const onCalvingRecorded = inngest.createFunction(
  { id: "livestock/vwp-reminder" },
  { event: "livestock/calving-recorded" },
  async ({ event, step }) => {
    await connectDB();
    const {
      animalId,
      farmerId,
      calvingId,
      outcome = "live_birth",
      numberOfCalves = 0,
      actorRole,
    } = event.data;

    const calvingDateValue = await step.run("resolve-calving-date", async () => {
      const calving = calvingId ? await Calving.findById(calvingId) : null;
      return calving?.date || event.ts || new Date();
    });
    const calvingDate = new Date(calvingDateValue);

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

      await sendNotificationPush({
        recipient: farmer,
        title:
          outcome === "abortion"
            ? "Pregnancy loss recorded"
            : "Calving recorded",
        message: outcomeSummary,
        type: "system",
        eventType,
        relatedId: calvingId || animalId,
        linkType: calvingId ? "record" : "animal",
        metadata: {
          type: "system",
          recordId: calvingId,
          animalId,
          animalTag,
          outcomeSummary,
        },
      });
    });

    if (actorRole === "farmer") {
      await step.run("notify-technicians-calving", async () => {
        const animal = await Animal.findById(animalId);
        if (!animal) return;

        const animalTag = animal.earTag || animal.animalId || "an animal";
        const title = "Calving recorded";

        let message = `${animalTag} has a new calving record.`;
        if (outcome === "abortion") {
          message = `A pregnancy loss was recorded for ${animalTag}.`;
        } else if (outcome === "stillbirth") {
          message = `A stillbirth was recorded for ${animalTag}.`;
        } else if (outcome === "live_birth" || outcome === "mixed") {
          const calfWord = numberOfCalves === 1 ? "calf was" : "calves were";
          message = `${animalTag} has a new calving record. ${numberOfCalves} living ${calfWord} recorded.`;
        }

        const technicians = await resolveReproductiveNotificationTechnicians({
          calvingId,
        });

        await Promise.all(
          technicians.map((tech) =>
            notifyUserBestEffort(
              {
                recipient: tech,
                senderId: farmerId,
                type: "system",
                relatedId: animalId,
                linkType: "animal",
                category: "calving",
                eventType: "calving_recorded",
                dedupeKey: `farmer-calving-recorded:${calvingId}:${tech._id}`,
                title,
                message,
                metadata: { animalId, animalTag, calvingId },
              },
              "farmer-calving-recorded-notification",
            ),
          ),
        );
      });
    }

    // The Calving record date is canonical; event delivery time is only a
    // compatibility fallback for older events without a resolvable record.
    const vwpDueDate = new Date(calvingDate);
    vwpDueDate.setUTCDate(vwpDueDate.getUTCDate() + 60);
    if (vwpDueDate > new Date()) {
      await step.sleepUntil("wait-for-vwp-window", vwpDueDate);
    }

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

        const farmer = await User.findById(farmerId);
        await sendBackgroundReminder({
          context: "post-calving-breeding-review-reminder",
          recipient: farmer,
          recipientId: farmerId,
          type: "system",
          relatedId: animalId,
          eventType: "post_calving_breeding_review",
          linkType: "animal",
          dedupeKey: buildReminderDedupeKey({
            eventType: "post-calving-breeding-review-60d",
            relatedId: calvingId || animalId,
            recipientId: farmerId,
            milestoneDate: vwpDueDate,
          }),
          title,
          message: body,
          metadata: { animalId, recordId: calvingId },
        });
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
        const technicians = await resolveReproductiveNotificationTechnicians({
          insemination,
        });

        const body = `${animal.earTag || 'The animal'} reached 60 days after AI service. Schedule an appropriate pregnancy diagnosis.`;

        // Notify technicians
        const milestoneDate = new Date(insemination.inseminationDate || insemination.createdAt);
        milestoneDate.setUTCDate(
          milestoneDate.getUTCDate() +
            HEAT_RETURN_MONITORING_POLICY.pregnancyDiagnosisDueDays,
        );
        await Promise.all(technicians.map(async (tech) => {
          await sendBackgroundReminder({
            context: "daily-pregnancy-diagnosis-due-reminder",
            recipient: tech,
            recipientId: tech._id,
            type: "system",
            relatedId: insemination._id,
            eventType: "pregnancy_diagnosis_due",
            linkType: "request",
            dedupeKey: buildReminderDedupeKey({
              eventType: "ai-pregnancy-diagnosis-due",
              relatedId: insemination._id,
              recipientId: tech._id,
              milestoneDate,
            }),
            title,
            message: body,
          });
        }));
        reminders += 1;
      }
      return { reminders };
    });

    // 2. Process Pregnant Animals (Notification before calving)
    await step.run("alert-upcoming-calving", async () => {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const pregnancies = await Pregnancy.find({
        cycleStatus: "active",
        deletedAt: null,
        targetCalvingDate: { $lte: sevenDaysFromNow, $gt: new Date() },
      });

      let alertsSent = 0;
      for (const pregnancy of pregnancies) {
        const [animal, farmer] = await Promise.all([
          Animal.findById(pregnancy.animalId),
          User.findById(pregnancy.farmerId),
        ]);
        if (!isExpectedCalvingReminderEligible({ pregnancy, animal })) continue;
        const technicians = await resolveReproductiveNotificationTechnicians({
          pregnancy,
        });
        const farmerTitle = "Expected calving within 7 days";
        const farmerBody = `Your animal (${animal.earTag || 'your animal'}) is expected to calve around ${new Date(pregnancy.targetCalvingDate).toLocaleDateString()}.`;

        if (farmer) {
          await sendBackgroundReminder({
            context: "daily-expected-calving-farmer-reminder",
            recipient: farmer,
            recipientId: farmer._id,
            type: "system",
            relatedId: animal._id,
            category: "calving",
            eventType: "expected_calving_7d",
            linkType: "animal",
            dedupeKey: buildReminderDedupeKey({
              eventType: "expected-calving-7d",
              relatedId: pregnancy._id,
              recipientId: farmer._id,
              milestoneDate: pregnancy.targetCalvingDate,
            }),
            title: farmerTitle,
            message: farmerBody,
            metadata: { pregnancyId: pregnancy._id, animalId: animal._id },
          });
        }

        const techTitle = "Expected calving approaching";
        const techBody = `${farmer?.name || 'A farmer'}'s animal (${animal.earTag || 'tag not recorded'}) is expected to calve around ${new Date(pregnancy.targetCalvingDate).toLocaleDateString()}.`;

        for (const tech of technicians) {
          await sendBackgroundReminder({
            context: "daily-expected-calving-technician-reminder",
            recipient: tech,
            recipientId: tech._id,
            type: "system",
            relatedId: animal._id,
            category: "calving",
            eventType: "expected_calving_7d",
            linkType: "animal",
            dedupeKey: buildReminderDedupeKey({
              eventType: "expected-calving-7d",
              relatedId: pregnancy._id,
              recipientId: tech._id,
              milestoneDate: pregnancy.targetCalvingDate,
            }),
            title: techTitle,
            message: techBody,
            metadata: { pregnancyId: pregnancy._id, animalId: animal._id },
          });
        }
        alertsSent += 1;
      }
      return { alertsSent };
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
      const reminderQueries = buildPendingServiceReminderQueries(new Date());
      const pendingAI = await Insemination.find(reminderQueries.ai)
        .populate("farmerId", "name")
        .populate("animalId", "earTag animalId")
        .populate("approvedBy");

      const pendingHealth = await HealthRequest.find(reminderQueries.health)
        .populate("farmerId", "name")
        .populate("animalId", "earTag animalId")
        .populate("handledBy");

      // Notify Technicians for pending AI
      for (const request of pendingAI) {
        const tech = request.approvedBy;
        if (tech) {
          const title = "AI service record needed";
          const body = `Today's AI visit for ${request.farmerId?.name || 'the farmer'} and ${request.animalId?.earTag || request.animalId?.animalId || 'the animal'} does not have a completed service record. Open the visit to finish it.`;

          await sendBackgroundReminder({
            context: "pending-ai-service-reminder",
            recipient: tech,
            recipientId: tech._id,
            type: "ai-request",
            relatedId: request._id,
            eventType: "ai_scheduled_service_due",
            linkType: "request",
            dedupeKey: buildReminderDedupeKey({
              eventType: "ai-scheduled-service-due",
              relatedId: request._id,
              recipientId: tech._id,
              milestoneDate: request.scheduledDate,
              period: request.visitPeriod,
            }),
            title,
            message: body,
            metadata: {
              scheduledDate: request.scheduledDate,
              visitPeriod: request.visitPeriod,
            },
          });
        }
      }

      // Notify Technicians for pending Health
      for (const request of pendingHealth) {
        const tech = request.handledBy;
        if (tech) {
          const title = "Health service record needed";
          const body = `Today's health visit for ${request.farmerId?.name || 'the farmer'} and ${request.animalId?.earTag || request.animalId?.animalId || 'the animal'} does not have a completed service record. Open the visit to finish it.`;

          await sendBackgroundReminder({
            context: "pending-health-visit-reminder",
            recipient: tech,
            recipientId: tech._id,
            type: "health-request",
            relatedId: request._id,
            eventType: "health_scheduled_visit_due",
            linkType: "request",
            dedupeKey: buildReminderDedupeKey({
              eventType: "health-scheduled-visit-due",
              relatedId: request._id,
              recipientId: tech._id,
              milestoneDate: request.scheduledDate,
              period: request.visitPeriod,
            }),
            title,
            message: body,
            metadata: {
              scheduledDate: request.scheduledDate,
              visitPeriod: request.visitPeriod,
            },
          });
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
