import { AppError } from "../utils/app-error.js";

const idOf = (value) =>
  value?._id?.toString?.() || value?.toString?.() || null;

const rejectOtherOwner = () => {
  throw new AppError(
    "This pregnancy work is assigned to another technician.",
    { status: 403, code: "PREGNANCY_WORK_ASSIGNED_TO_OTHER" },
  );
};

const rejectUnresolvedOwner = () => {
  throw new AppError(
    "Claim the assigned pregnancy work before recording a clinical result.",
    { status: 409, code: "PREGNANCY_WORK_CLAIM_REQUIRED" },
  );
};

const resolveConsistentOwner = (values) => {
  const ownerIds = [...new Set(values.map(idOf).filter(Boolean))];
  if (ownerIds.length > 1) rejectOtherOwner();
  return ownerIds[0] || null;
};

export const assertPregnancyClinicalActor = (actor) => {
  if (!actor?._id || actor.role !== "technician") {
    throw new AppError(
      "Pregnancy clinical results must be recorded by a technician.",
      { status: 403, code: "UNAUTHORIZED_PREGNANCY_CONFIRMATION" },
    );
  }
};

export const assertNoConflictingPregnancyTaskOwners = ({ actor, tasks = [] }) => {
  assertPregnancyClinicalActor(actor);
  const actorId = idOf(actor._id);
  if (tasks.some((task) => {
    const ownerId = idOf(task?.technicianId);
    return ownerId && ownerId !== actorId;
  })) {
    rejectOtherOwner();
  }
};

/**
 * Authorizes a pregnancy/reproductive mutation using the existing workflow
 * hierarchy. An explicitly linked Task is authoritative because Admin may
 * reassign follow-up work independently of the Technician who performed AI.
 * Existing Pregnancy confirmation ownership is the next fallback, followed by
 * the originating Insemination ownership fields.
 */
export const assertPregnancyMutationAuthority = ({
  actor,
  task = null,
  pregnancy = null,
  insemination = null,
  allowUnassignedTaskClaim = false,
}) => {
  assertPregnancyClinicalActor(actor);
  const actorId = idOf(actor._id);

  if (task) {
    const taskOwnerId = idOf(task.technicianId);
    if (taskOwnerId && taskOwnerId !== actorId) rejectOtherOwner();
    if (!taskOwnerId && !allowUnassignedTaskClaim) rejectUnresolvedOwner();
    return { source: "task", ownerId: taskOwnerId || actorId };
  }

  const pregnancyOwnerId = resolveConsistentOwner([
    pregnancy?.confirmation?.confirmedBy,
  ]);
  if (pregnancyOwnerId) {
    if (pregnancyOwnerId !== actorId) rejectOtherOwner();
    return { source: "pregnancy", ownerId: pregnancyOwnerId };
  }

  const inseminationOwnerId = resolveConsistentOwner([
    insemination?.approvedBy,
    insemination?.technicianId,
  ]);
  if (!inseminationOwnerId) rejectUnresolvedOwner();
  if (inseminationOwnerId !== actorId) rejectOtherOwner();
  return { source: "insemination", ownerId: inseminationOwnerId };
};
