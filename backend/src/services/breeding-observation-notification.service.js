import crypto from "node:crypto";
import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.model.js";

const reportLabel = (reportType) =>
  ({
    possible_pregnancy: "possible pregnancy signs",
    return_to_heat: "a return to heat",
    unsure: "an uncertain breeding outcome",
  })[reportType] || String(reportType || "a breeding observation").replaceAll("_", " ");

const observationFingerprint = ({ reportType, signs, notes, verificationRequested }) =>
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        reportType,
        signs: [...(signs || [])].map(String).sort(),
        notes: String(notes || "").trim(),
        verificationRequested: Boolean(verificationRequested),
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
  verificationRequested = false,
}) => {
  const technicians = await User.find({
    role: { $in: ["technician", "veterinarian"] },
    status: { $ne: "suspended" },
    deletedAt: null,
  }).select("_id");
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
    verificationRequested,
  });

  return Promise.all(
    technicians.map((technician) => {
      const recipientId = technician._id || technician;
      const dedupeKey = `breeding-observation:${recipientId}:${insemination._id}:${fingerprint}`;
      return Notification.findOneAndUpdate(
        { dedupeKey },
        {
          $setOnInsert: {
            recipientId,
            senderId: farmer._id,
            type: "ai-request",
            relatedId: insemination._id,
            linkType: "request",
            dedupeKey,
            title: `Breeding observation: ${animalTag}`,
            message: `${farmerName} reported ${reportLabel(reportType)} for ${animalTag} after the ${aiDate} insemination. Review the observation and decide the appropriate technician follow-up.`,
            metadata: {
              animalId: animal._id,
              observationId: insemination._id,
              taskId: task?._id || null,
              reportType,
              signs,
              notes,
              reportedAt,
              deepLinkTarget: task?._id
                ? "/(technician)/task-details"
                : "/(technician)/request-details",
            },
          },
        },
        { upsert: true, returnDocument: "after" },
      );
    }),
  );
};
