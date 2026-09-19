import { differenceInManilaCalendarDays } from "./service-date-time.js";

export const getAIVisitAvailability = ({
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

  if (daysUntilVisit === 0) {
    return {
      workTiming: "actionable",
      allowedAction: "RECORD_SERVICE",
      actionLabel: "Record Insemination",
    };
  }

  return {
    workTiming: "overdue",
    allowedAction: "RECORD_SERVICE",
    actionLabel: "Record Completed Service",
  };
};
