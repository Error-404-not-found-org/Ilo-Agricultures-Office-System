import { differenceInManilaCalendarDays } from "./service-date-time.js";

export const getHealthVisitAvailability = ({
  scheduledDate,
  now = new Date(),
}) => {
  const daysUntilVisit = differenceInManilaCalendarDays(scheduledDate, now);
  if (daysUntilVisit === null) return null;

  if (daysUntilVisit > 0) {
    return {
      workTiming: "upcoming",
      allowedAction: "VIEW_DETAILS",
      actionLabel: "View Scheduled Visit",
    };
  }

  return {
    workTiming: daysUntilVisit === 0 ? "actionable" : "overdue",
    allowedAction: "START_SERVICE",
    actionLabel: "Start Visit",
  };
};
