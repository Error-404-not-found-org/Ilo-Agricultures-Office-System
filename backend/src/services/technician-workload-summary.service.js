import { User } from "../models/user.model.js";
import { Insemination } from "../models/insemination.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { Task } from "../models/task.model.js";
import { MedicalRecord } from "../models/medical-record.model.js";
import { DIRECT_HEALTH_SERVICE_TYPES } from "../domain/direct-health-record.js";
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

export const buildStandaloneTaskDuplicateSuppressionFilter = () => ({
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
});

export const buildCompletedStandaloneTaskFilter = ({ technicianId } = {}) => ({
  status: "Completed",
  ...buildStandaloneTaskDuplicateSuppressionFilter(),
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
  ...buildStandaloneTaskDuplicateSuppressionFilter(),
  ...(technicianId ? { technicianId } : {}),
});

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

export const getManilaDayBounds = (now = new Date()) => {
  const start = new Date(now.getTime() + MANILA_OFFSET_MS);
  start.setUTCHours(0, 0, 0, 0);
  start.setTime(start.getTime() - MANILA_OFFSET_MS);

  return {
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000),
  };
};

export const buildAICompletedInRangeFilter = ({
  technicianId,
  start,
  end,
} = {}) => ({
  $and: [
    buildCompletedAIWorkFilter({ technicianId }),
    {
      $or: [
        { completedAt: { $gte: start, $lt: end } },
        {
          completedAt: null,
          entryMode: { $nin: ["history_only", "continue_tracking"] },
          statusHistory: {
            $elemMatch: {
              status: AI_STATUS.DONE,
              createdAt: { $gte: start, $lt: end },
            },
          },
        },
      ],
    },
  ],
});

export const buildDirectHealthCompletedInRangeFilter = ({
  technicianId,
  start,
  end,
} = {}) => ({
  technicianId,
  healthRequestId: null,
  deletedAt: null,
  "details.serviceType": { $in: DIRECT_HEALTH_SERVICE_TYPES },
  date: { $gte: start, $lt: end },
});

const buildDateBoundActiveFilter = ({ baseFilter, field, range }) => ({
  ...baseFilter,
  [field]: range,
});

export const loadTechnicianDashboardMetrics = async ({
  technicianId,
  now = new Date(),
  models = {},
} = {}) => {
  const InseminationModel = models.Insemination || Insemination;
  const HealthRequestModel = models.HealthRequest || HealthRequest;
  const TaskModel = models.Task || Task;
  const MedicalRecordModel = models.MedicalRecord || MedicalRecord;
  const { start, end } = getManilaDayBounds(now);
  const activeAI = buildActiveAIWorkFilter({ technicianId });
  const activeHealth = buildActiveHealthWorkFilter({ technicianId });
  const activeTasks = buildActiveStandaloneTaskFilter({ technicianId, now });
  const scheduledHealth = {
    ...activeHealth,
    handlingMethod: { $nin: ["advice", "office_pickup"] },
  };

  const [
    aiDueToday,
    healthDueToday,
    tasksDueToday,
    aiOverdue,
    healthOverdue,
    tasksOverdue,
    aiCompletedToday,
    healthCompletedToday,
    tasksCompletedToday,
    directHealthCompletedToday,
  ] = await Promise.all([
    InseminationModel.countDocuments(
      buildDateBoundActiveFilter({
        baseFilter: activeAI,
        field: "scheduledDate",
        range: { $gte: start, $lt: end },
      }),
    ),
    HealthRequestModel.countDocuments(
      buildDateBoundActiveFilter({
        baseFilter: scheduledHealth,
        field: "scheduledDate",
        range: { $gte: start, $lt: end },
      }),
    ),
    TaskModel.countDocuments(
      buildDateBoundActiveFilter({
        baseFilter: activeTasks,
        field: "dueDate",
        range: { $gte: start, $lt: end },
      }),
    ),
    InseminationModel.countDocuments(
      buildDateBoundActiveFilter({
        baseFilter: activeAI,
        field: "scheduledDate",
        range: { $lt: start },
      }),
    ),
    HealthRequestModel.countDocuments(
      buildDateBoundActiveFilter({
        baseFilter: scheduledHealth,
        field: "scheduledDate",
        range: { $lt: start },
      }),
    ),
    TaskModel.countDocuments(
      buildDateBoundActiveFilter({
        baseFilter: activeTasks,
        field: "dueDate",
        range: { $lt: start },
      }),
    ),
    InseminationModel.countDocuments(
      buildAICompletedInRangeFilter({ technicianId, start, end }),
    ),
    HealthRequestModel.countDocuments({
      ...buildCompletedHealthWorkFilter({ technicianId }),
      resolvedAt: { $gte: start, $lt: end },
    }),
    TaskModel.countDocuments({
      ...buildCompletedStandaloneTaskFilter({ technicianId }),
      completedAt: { $gte: start, $lt: end },
    }),
    MedicalRecordModel.countDocuments(
      buildDirectHealthCompletedInRangeFilter({ technicianId, start, end }),
    ),
  ]);

  return {
    dueToday: aiDueToday + healthDueToday + tasksDueToday,
    overdue: aiOverdue + healthOverdue + tasksOverdue,
    completedToday:
      aiCompletedToday +
      healthCompletedToday +
      tasksCompletedToday +
      directHealthCompletedToday,
    aiDueToday,
    aiOverdue,
    aiCompletedToday,
  };
};

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
