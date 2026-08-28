import {
  ACTIVE_AI_REQUEST_STATUSES,
  ACTIVE_HEALTH_REQUEST_STATUSES,
  AI_STATUS,
  HEALTH_STATUS,
  normalizeAIStatus,
  normalizeHealthStatus,
} from "../domain/status-vocabulary.js";
import { HEALTH_HANDLING_METHOD } from "../domain/health-request-vocabulary.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const AI_SERVICE_REMINDER_STATUSES = Object.freeze(
  ACTIVE_AI_REQUEST_STATUSES.filter((status) =>
    [AI_STATUS.SCHEDULED, AI_STATUS.IN_PROGRESS].includes(
      normalizeAIStatus(status),
    ),
  ),
);

export const HEALTH_VISIT_REMINDER_STATUSES = Object.freeze(
  ACTIVE_HEALTH_REQUEST_STATUSES.filter((status) =>
    [HEALTH_STATUS.SCHEDULED, HEALTH_STATUS.IN_PROGRESS].includes(
      normalizeHealthStatus(status),
    ),
  ),
);

export const buildPendingServiceReminderQueries = (now = new Date()) => ({
  ai: {
    status: { $in: [...AI_SERVICE_REMINDER_STATUSES] },
    scheduledDate: { $lte: now },
    deletedAt: null,
  },
  health: {
    status: { $in: [...HEALTH_VISIT_REMINDER_STATUSES] },
    scheduledDate: { $lte: now },
    handlingMethod: {
      $nin: [
        HEALTH_HANDLING_METHOD.ADVICE,
        HEALTH_HANDLING_METHOD.OFFICE_PICKUP,
      ],
    },
    deletedAt: null,
  },
});

const dateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("A valid reminder milestone date is required.");
  }
  return date.toISOString();
};

export const buildReminderDedupeKey = ({
  eventType,
  relatedId,
  recipientId,
  milestoneDate,
  period,
}) =>
  [
    "background-reminder",
    eventType,
    String(relatedId),
    dateKey(milestoneDate),
    period || "all-day",
    String(recipientId),
  ].join(":");

export const getExpectedCalvingReminderDates = (expectedCalvingDate) => {
  const target = new Date(expectedCalvingDate);
  if (Number.isNaN(target.getTime())) return null;
  return {
    target,
    upcoming: new Date(target.getTime() - 7 * DAY_MS),
    overdue: new Date(target.getTime() + 10 * DAY_MS),
  };
};

export const isExpectedCalvingReminderEligible = ({ pregnancy, animal }) =>
  Boolean(
    pregnancy &&
      !pregnancy.deletedAt &&
      pregnancy.cycleStatus === "active" &&
      pregnancy.targetCalvingDate &&
      animal &&
      !animal.deletedAt &&
      animal.reproductiveStatus === "Pregnant",
  );
