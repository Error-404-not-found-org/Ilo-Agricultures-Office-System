import crypto from "node:crypto";
import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.model.js";
import { sendPushNotification } from "../lib/push-notifications.js";

const reportLabel = (reportType) =>
  ({
    possible_pregnancy: "possible pregnancy signs",
    return_to_heat: "a return to heat",
    unsure: "an uncertain breeding outcome",
  })[reportType] || String(reportType || "a breeding observation").replaceAll("_", " ");

const observationFingerprint = ({ reportType, signs, notes, technicianActionRequired }) =>
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        reportType,
        signs: [...(signs || [])].map(String).sort(),
        notes: String(notes || "").trim(),
        technicianActionRequired: Boolean(technicianActionRequired),
      }),
    )
    .digest("hex")
    .slice(0, 24);

export const notifyTechniciansOfBreedingObservation = async ({
  farmer,
  animal,
  insemination,
  task,
  reportType,
  signs = [],
  notes = "",
  reportedAt,
  technicianActionRequired = false,
}) => {
  const assignedTechnicianId =
    insemination?.technicianId?._id ||
    insemination?.technicianId ||
    insemination?.approvedBy?._id ||
    insemination?.approvedBy ||
    null;
  const technicianQuery = {
    role: { $in: ["technician"] },
    status: { $ne: "suspended" },
    deletedAt: null,
  };
  const assignedTechnicians = assignedTechnicianId
    ? await User.find({
        ...technicianQuery,
        _id: assignedTechnicianId,
      }).select("_id pushToken")
    : [];
  const technicians = assignedTechnicians.length
    ? assignedTechnicians
    : await User.find(technicianQuery).select("_id pushToken");
  const farmerName = farmer?.name || "A farmer";
  const animalTag = animal?.earTag || animal?.animalId || "an animal";
  const aiDate = insemination?.inseminationDate
    ? new Date(insemination.inseminationDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "the recorded AI service";
  const fingerprint = observationFingerprint({
    reportType,
    signs,
    notes,
    technicianActionRequired,
  });

  return Promise.all(
    technicians.map(async (technician) => {
      const recipientId = technician._id || technician;
      const dedupeKey = `breeding-observation:${recipientId}:${insemination._id}:${fingerprint}`;
      const actionTask = technicianActionRequired ? task : null;
      const eventType = technicianActionRequired
        ? "technician_review_required"
        : "farmer_observation_reported";
      const title = technicianActionRequired
        ? `Breeding observation needs verification: ${animalTag}`
        : `Breeding observation recorded: ${animalTag}`;
      const message = technicianActionRequired
        ? `${farmerName} reported ${reportLabel(reportType)} for ${animalTag} after the ${aiDate} insemination. Open the linked task to verify the outcome.`
        : `${farmerName} reported ${reportLabel(reportType)} for ${animalTag}. The observation was recorded; follow the existing breeding schedule when professional follow-up becomes due.`;
      const result = await Notification.findOneAndUpdate(
        { dedupeKey },
        {
          $setOnInsert: {
            recipientId,
            senderId: farmer._id,
            type: technicianActionRequired ? "ai-request" : "system",
            category: "observation",
            eventType,
            relatedId: actionTask?._id || animal._id,
            linkType: actionTask ? "task" : "animal",
            dedupeKey,
            title,
            message,
            metadata: {
              animalId: animal._id,
              animalTag,
              observationId: insemination._id,
              taskId: actionTask?._id || null,
              reportType,
              signs,
              notes,
              reportedAt,
              deepLinkTarget: actionTask?._id
                ? "/(technician)/task-details"
                : "/(technician)/animal-details",
            },
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          includeResultMetadata: true,
        },
      );
      const notification = result?.value || result;
      const wasInserted = result?.lastErrorObject
        ? !result.lastErrorObject.updatedExisting
        : Boolean(notification);

      if (wasInserted && technician.pushToken) {
        await sendPushNotification(technician.pushToken, title, message, {
          eventType,
          type: technicianActionRequired ? "ai" : "system",
          ...(technicianActionRequired
            ? { requestId: String(insemination._id) }
            : {}),
          animalId: String(animal._id),
          taskId: actionTask?._id ? String(actionTask._id) : null,
        });
      }

      return notification;
    }),
  );
};
