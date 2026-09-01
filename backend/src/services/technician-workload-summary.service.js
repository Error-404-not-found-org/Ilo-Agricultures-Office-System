import { User } from "../models/user.model.js";
import { Insemination } from "../models/insemination.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { Task } from "../models/task.model.js";
import {
  ACTIVE_AI_REQUEST_STATUSES,
  ACTIVE_HEALTH_REQUEST_STATUSES,
  AI_STATUS,
} from "../domain/status-vocabulary.js";

export const buildActiveAIWorkFilter = ({ technicianId } = {}) => ({
  status: { $in: ACTIVE_AI_REQUEST_STATUSES },
  deletedAt: null,
  ...(technicianId
    ? {
        declinedByTechnicianIds: { $ne: technicianId },
        $or: [
          { approvedBy: technicianId },
          { status: AI_STATUS.DONE, technicianId },
        ],
      }
    : {}),
});

export const buildActiveHealthWorkFilter = ({ technicianId } = {}) => ({
  status: { $in: ACTIVE_HEALTH_REQUEST_STATUSES },
  deletedAt: null,
  ...(technicianId
    ? {
        declinedByTechnicianIds: { $ne: technicianId },
        $or: [
          { handledBy: technicianId },
          { assignedTechnicianId: technicianId },
        ],
      }
    : {}),
});

export const buildCompletedAIWorkFilter = ({ technicianId } = {}) => ({
  status: AI_STATUS.DONE,
  deletedAt: null,
  ...(technicianId
    ? {
        declinedByTechnicianIds: { $ne: technicianId },
        $or: [
          { approvedBy: technicianId },
          { status: AI_STATUS.DONE, technicianId },
        ],
      }
    : {}),
});

export const buildCompletedHealthWorkFilter = ({ technicianId } = {}) => ({
  status: { $in: ["resolved", "done"] },
  deletedAt: null,
  ...(technicianId
    ? {
        declinedByTechnicianIds: { $ne: technicianId },
        $or: [
          { handledBy: technicianId },
          { assignedTechnicianId: technicianId },
        ],
      }
    : {}),
});

export const DUE_GATED_REPRODUCTIVE_TASK_TYPES = Object.freeze([
  "PD",
  "BreedingFollowUp",
  "CD",
  "Calving",
]);

export const buildCompletedStandaloneTaskFilter = ({ technicianId } = {}) => ({
  status: "Completed",
  $nor: [
    {
      taskType: {
        $in: ["AI", "Health", "Treatment", "Vaccination", "Deworming"],
      },
    },
    {
      relatedRecordType: { $in: ["insemination", "health"] },
      taskType: { $nin: DUE_GATED_REPRODUCTIVE_TASK_TYPES },
    },
  ],
  ...(technicianId ? { technicianId } : {}),
});

export const buildActiveStandaloneTaskFilter = ({ technicianId, now } = {}) => ({
  status: { $in: ["Pending", "In Progress"] },
  $and: [
    {
      $or: [
        { taskType: { $nin: DUE_GATED_REPRODUCTIVE_TASK_TYPES } },
        {
          taskType: { $in: DUE_GATED_REPRODUCTIVE_TASK_TYPES },
          $or: [
            { status: "Pending", dueDate: { $ne: null, $lte: now || new Date() } },
            { status: "In Progress" },
          ],
        },
      ],
    },
  ],
  $nor: [
    {
      taskType: {
        $in: ["AI", "Health", "Treatment", "Vaccination", "Deworming"],
      },
    },
    {
      relatedRecordType: { $in: ["insemination", "health"] },
      taskType: { $nin: DUE_GATED_REPRODUCTIVE_TASK_TYPES },
    },
  ],
  ...(technicianId ? { technicianId } : {}),
});

const countByTechnician = (rows) =>
  new Map(rows.map((row) => [String(row._id), row]));

export const buildTechnicianWorkloadRows = ({
  technicians,
  aiCounts,
  healthCounts,
  taskCounts,
}) => {
  const aiByTechnician = countByTechnician(aiCounts);
  const healthByTechnician = countByTechnician(healthCounts);
  const tasksByTechnician = countByTechnician(taskCounts);

  return technicians
    .map((technician) => {
      const technicianId = String(technician._id);
      const ai = Number(aiByTechnician.get(technicianId)?.count || 0);
      const health = Number(healthByTechnician.get(technicianId)?.count || 0);
      const taskBreakdown = tasksByTechnician.get(technicianId) || {};
      const pregnancy = Number(taskBreakdown.pregnancy || 0);
      const calving = Number(taskBreakdown.calving || 0);
      const tasks = Number(taskBreakdown.tasks || 0);

      return {
        technicianId,
        name: technician.name || "Technician not recorded",
        activeWorkloadTotal: ai + health + pregnancy + calving + tasks,
        counts: { ai, health, pregnancy, calving, tasks },
      };
    })
    .sort(
      (left, right) =>
        right.activeWorkloadTotal - left.activeWorkloadTotal ||
        left.name.localeCompare(right.name) ||
        left.technicianId.localeCompare(right.technicianId),
    );
};

export const loadTechnicianWorkloadSummary = async ({
  now = new Date(),
  models = {},
} = {}) => {
  const UserModel = models.User || User;
  const InseminationModel = models.Insemination || Insemination;
  const HealthRequestModel = models.HealthRequest || HealthRequest;
  const TaskModel = models.Task || Task;

  const [technicians, aiCounts, healthCounts, taskCounts] = await Promise.all([
    UserModel.find({ role: "technician", deletedAt: null })
      .select("_id name")
      .lean(),
    InseminationModel.aggregate([
      { $match: { ...buildActiveAIWorkFilter(), approvedBy: { $ne: null } } },
      { $group: { _id: "$approvedBy", count: { $sum: 1 } } },
    ]),
    HealthRequestModel.aggregate([
      { $match: buildActiveHealthWorkFilter() },
      {
        $set: {
          workloadTechnicianId: {
            $ifNull: ["$handledBy", "$assignedTechnicianId"],
          },
        },
      },
      { $match: { workloadTechnicianId: { $ne: null } } },
      { $group: { _id: "$workloadTechnicianId", count: { $sum: 1 } } },
    ]),
    TaskModel.aggregate([
      {
        $match: {
          ...buildActiveStandaloneTaskFilter({ now }),
          technicianId: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$technicianId",
          pregnancy: { $sum: { $cond: [{ $eq: ["$taskType", "PD"] }, 1, 0] } },
          calving: {
            $sum: {
              $cond: [{ $in: ["$taskType", ["CD", "Calving"]] }, 1, 0],
            },
          },
          tasks: {
            $sum: {
              $cond: [
                { $in: ["$taskType", ["PD", "CD", "Calving"]] },
                0,
                1,
              ],
            },
          },
        },
      },
    ]),
  ]);

  return buildTechnicianWorkloadRows({
    technicians,
    aiCounts,
    healthCounts,
    taskCounts,
  });
};
