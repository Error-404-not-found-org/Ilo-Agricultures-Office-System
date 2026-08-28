import { PREGNANCY_TASK_STAGE } from "../domain/pregnancy-task-workflow.js";
import { Task } from "../models/task.model.js";
import mongoose from "mongoose";

/**
 * Builds a query match for metadata.inseminationId that supports both
 * String and ObjectId types for backward compatibility and resilience.
 */
export const buildInseminationIdMatch = (inseminationId) => {
  if (!inseminationId) return null;
  const idStr = inseminationId.toString();
  try {
    const idObj = new mongoose.Types.ObjectId(idStr);
    return { $in: [idStr, idObj] };
  } catch (error) {
    return { $in: [idStr] };
  }
};

const ACTIVE_TASK_STATUSES = ["Pending", "In Progress"];

const observationNotes = ({ reportType, signs, notes }) =>
  `Breeding observation: ${reportType}. Signs: ${(Array.isArray(signs) ? signs : []).join(", ") || "None"}. Notes: ${notes || "None"}`;

const validDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

export const getBreedingObservationFollowUpDecision = ({
  reportType,
  pregnancyReadiness,
  hasActiveTask = false,
}) => {
  if (reportType === "return_to_heat") {
    return {
      scheduleFollowUp: true,
      technicianActionRequired: true,
      verificationStatus: "pending",
      taskSourceType: "farmer_requested_verification",
    };
  }

  // possible_pregnancy and unsure follow the default path

  return {
    scheduleFollowUp: true,
    technicianActionRequired: false,
    verificationStatus: "pending",
    taskSourceType: null,
  };
};

export const ensureBreedingObservationFollowUpTask = async ({
  request,
  farmerId,
  animalId,
  technicianId,
  reportType,
  signs,
  notes,
  pregnancyReadiness,
  at = new Date(),
}) => {
  const initialDecision = getBreedingObservationFollowUpDecision({
    reportType,
    pregnancyReadiness,
  });

  const taskLookup = {
    taskType: "BreedingFollowUp",
    "metadata.inseminationId": buildInseminationIdMatch(request._id),
    status: { $in: ACTIVE_TASK_STATUSES },
  };

  let task = await Task.findOne(taskLookup);

  if (task) {
    if (reportType === "return_to_heat") {
      task = await Task.findOneAndUpdate(
        { _id: task._id },
        {
          $set: {
            dueDate: at,
            priority: 1,
            notes: observationNotes({ reportType, signs, notes }),
            "metadata.reportType": reportType,
          },
        },
        { returnDocument: "after" },
      );
    } else if (reportType === "possible_pregnancy") {
      task = await Task.findOneAndUpdate(
        { _id: task._id },
        {
          $set: {
            notes: observationNotes({ reportType, signs, notes }),
            "metadata.reportType": reportType,
          },
        },
        { returnDocument: "after" },
      );
    } else if (reportType === "unsure") {
      task = await Task.findOneAndUpdate(
        { _id: task._id },
        {
          $set: {
            notes: observationNotes({ reportType, signs, notes }),
            "metadata.reportType": reportType,
          },
        },
        { returnDocument: "after" },
      );
    }
  } else if (initialDecision.technicianActionRequired) {
    task = await Task.create({
      taskType: "BreedingFollowUp",
      category: "Follow-up",
      status: "Pending",
      dueDate: at,
      priority: 1,
      notes: observationNotes({ reportType, signs, notes }),
      farmerId,
      animalIds: [animalId],
      sourceType: initialDecision.taskSourceType || "farmer_requested_verification",
      metadata: {
        inseminationId: request._id,
        reportType,
      },
      ...(technicianId ? { technicianId } : {}),
    });
  }

  return {
    task,
    ...getBreedingObservationFollowUpDecision({
      reportType,
      pregnancyReadiness,
      hasActiveTask: Boolean(task),
    }),
  };
};

/**
 * Closes any active BreedingFollowUp tasks for a specific insemination.
 * Used when a definitive professional reproductive outcome supersedes the need for follow-up.
 */
export const closeBreedingFollowUpTask = async ({
  inseminationId,
  reason,
  at = new Date(),
  actorId = null,
  session = null,
}) => {
  const query = {
    taskType: "BreedingFollowUp",
    "metadata.inseminationId": buildInseminationIdMatch(inseminationId),
    status: { $nin: ["Completed", "Cancelled"] },
  };

  const update = {
    $set: {
      status: "Cancelled",
      completedAt: at,
      ...(actorId ? { technicianId: actorId } : {}),
    },
    // We append the cancellation context to task notes since Task doesn't have a statusHistory array.
    $set: {
      "metadata.closureReason": reason,
    },
  };

  // Note: we can't use $push on statusHistory because TaskSchema lacks it.
  // Instead we append to notes to preserve the history.

  const options = session ? { session } : {};

  // First, find the tasks to append notes properly without overwriting
  const TaskModel = (await import("../models/task.model.js")).Task;
  const tasks = await TaskModel.find(query).session(session);

  for (const task of tasks) {
    const closedNotes = `${task.notes}\n\n[System]: Task cancelled at ${at.toISOString()} because it was superseded. Reason: ${reason}`;
    await TaskModel.updateOne(
      { _id: task._id },
      {
        $set: {
          status: "Cancelled",
          completedAt: at,
          notes: closedNotes.trim(),
          "metadata.closureReason": reason,
          ...(actorId ? { technicianId: actorId } : {}),
        }
      },
      options
    );
  }
};

/**
 * Centrally cancels specific pending reproductive tasks associated with a failed insemination attempt.
 * Use this only for terminal AI failures (e.g., return-to-heat) to clean up stale tasks like PD.
 */
export const cancelPendingReproductiveTasksForInsemination = async ({
  inseminationId,
  taskTypes = ["BreedingFollowUp", "PD"],
  reason,
  session = null,
  excludeTaskId = null,
}) => {
  if (!inseminationId || !taskTypes || !taskTypes.length) return;
  const TaskModel = (await import("../models/task.model.js")).Task;

  const query = {
    taskType: { $in: taskTypes },
    "metadata.inseminationId": buildInseminationIdMatch(inseminationId),
    status: { $nin: ["Completed", "Cancelled"] },
    ...(excludeTaskId ? { _id: { $ne: excludeTaskId } } : {}),
  };

  const tasks = await TaskModel.find(query).session(session);
  const now = new Date();
  const options = session ? { session } : {};

  for (const task of tasks) {
    const closedNotes = `${task.notes}\n\n[System]: Task cancelled at ${now.toISOString()} because the AI attempt terminally failed. Reason: ${reason}`;
    await TaskModel.updateOne(
      { _id: task._id },
      {
        $set: {
          status: "Cancelled",
          completedAt: now,
          notes: closedNotes.trim(),
          "metadata.closureReason": reason,
        }
      },
      options
    );
  }
};
