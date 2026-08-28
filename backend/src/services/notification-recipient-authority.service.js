import { User } from "../models/user.model.js";
import { Task } from "../models/task.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Calving } from "../models/calving.model.js";
import { resolveDispatchRecipients } from "./dispatch-recipient.service.js";
import { DISPATCH_NOTIFICATION_MODES } from "../domain/geographic/dispatchMode.js";

const idText = (value) =>
  value?._id?.toString?.() || value?.toString?.() || "";

const uniqueIds = (values) =>
  [...new Set(values.map(idText).filter(Boolean))];

const activeTaskStatuses = ["Pending", "In Progress"];

const loadOperationalTechnician = async (ownerValues) => {
  const ownerIds = uniqueIds(ownerValues);
  // Conflicting ownership is ambiguous. Notification targeting must fail closed.
  if (ownerIds.length !== 1) return [];

  const technician = await User.findOne({
    _id: ownerIds[0],
    role: "technician",
    status: { $ne: "suspended" },
    deletedAt: null,
  }).select("_id name pushToken role status deletedAt");

  return technician ? [technician] : [];
};

export const resolveRequestNotificationTechnicians = async ({
  requestType,
  request,
  allowUnassignedDispatch = false,
}) => {
  if (!request) return [];

  const ownerValues =
    requestType === "HEALTH"
      ? [request.handledBy, request.assignedTechnicianId]
      : [request.approvedBy, request.technicianId];
  const ownerIds = uniqueIds(ownerValues);

  if (ownerIds.length > 0) {
    return loadOperationalTechnician(ownerValues);
  }

  if (!allowUnassignedDispatch || request.status !== "pending") return [];

  const resolution = await resolveDispatchRecipients({
    requestType,
    dispatchLocation: request.dispatch?.location || {},
    dispatchStage: request.dispatch?.stage || "local",
    notificationMode: DISPATCH_NOTIFICATION_MODES.TARGETED,
  });
  return resolution.selectedRecipients;
};

const findLinkedPregnancyTask = async ({ pregnancyId, inseminationId }) => {
  const matches = [];
  if (pregnancyId) {
    matches.push(
      { "metadata.pregnancyId": pregnancyId },
      { relatedRecordType: "pregnancy", relatedRecordId: pregnancyId },
    );
  }
  if (inseminationId) {
    matches.push(
      { "metadata.inseminationId": inseminationId },
      { relatedRecordType: "insemination", relatedRecordId: inseminationId },
    );
  }
  if (matches.length === 0) return null;

  return Task.findOne({
    taskType: { $in: ["PD", "CD", "Calving", "BreedingFollowUp"] },
    technicianId: { $ne: null },
    status: { $in: activeTaskStatuses },
    $or: matches,
  }).sort({ updatedAt: -1, createdAt: -1 });
};

/**
 * Resolves the current legitimate Technician for pregnancy/calving continuity.
 * Explicit linked Task ownership wins over historical clinical actors. When no
 * durable relationship exists, the result is empty rather than role-wide.
 */
export const resolveReproductiveNotificationTechnicians = async ({
  task = null,
  pregnancy = null,
  insemination = null,
  calving = null,
  pregnancyId = null,
  inseminationId = null,
  calvingId = null,
} = {}) => {
  const resolvedCalving =
    calving || (calvingId ? await Calving.findById(calvingId) : null);
  const resolvedPregnancyId =
    pregnancyId || resolvedCalving?.pregnancyId || null;
  const resolvedInseminationId =
    inseminationId || resolvedCalving?.inseminationId || null;
  const resolvedPregnancy =
    pregnancy ||
    (resolvedPregnancyId
      ? await Pregnancy.findById(resolvedPregnancyId)
      : resolvedInseminationId
        ? await Pregnancy.findOne({ inseminationId: resolvedInseminationId })
        : null);
  const canonicalInseminationId =
    resolvedInseminationId || resolvedPregnancy?.inseminationId || null;
  const resolvedInsemination =
    insemination ||
    (canonicalInseminationId
      ? await Insemination.findById(canonicalInseminationId)
      : null);
  const linkedTask =
    task ||
    (await findLinkedPregnancyTask({
      pregnancyId: resolvedPregnancy?._id || resolvedPregnancyId,
      inseminationId: resolvedInsemination?._id || canonicalInseminationId,
    }));

  if (linkedTask?.technicianId) {
    return loadOperationalTechnician([linkedTask.technicianId]);
  }

  if (resolvedPregnancy?.confirmation?.confirmedBy) {
    return loadOperationalTechnician([
      resolvedPregnancy.confirmation.confirmedBy,
    ]);
  }

  if (resolvedCalving?.technicianId) {
    return loadOperationalTechnician([resolvedCalving.technicianId]);
  }

  return loadOperationalTechnician([
    resolvedInsemination?.approvedBy,
    resolvedInsemination?.technicianId,
  ]);
};

export const resolveBreedingObservationTechnicians = async ({
  task,
  insemination,
  technicianActionRequired,
}) => {
  if (task?.technicianId) {
    return loadOperationalTechnician([task.technicianId]);
  }

  const ownerValues = [
    insemination?.approvedBy,
    insemination?.technicianId,
  ];
  if (uniqueIds(ownerValues).length > 0) {
    return loadOperationalTechnician(ownerValues);
  }

  if (!technicianActionRequired || !task) return [];
  return resolveRequestNotificationTechnicians({
    requestType: "AI",
    request: {
      status: "pending",
      dispatch: insemination?.dispatch,
    },
    allowUnassignedDispatch: true,
  });
};

export const notificationAuthorityId = idText;
