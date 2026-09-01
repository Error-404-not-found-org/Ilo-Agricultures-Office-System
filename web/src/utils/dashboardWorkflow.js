import { buildScheduleItems } from "./technicianSchedulePresentation";

export const getDashboardGreeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

export const getDashboardScheduleOverview = (
  agendaItems = [],
  now = new Date(),
) => {
  const scheduleItems = buildScheduleItems(agendaItems, now);

  return {
    dueCount: scheduleItems.filter((item) =>
      ["due", "overdue"].includes(item.timingState),
    ).length,
    todayWork: scheduleItems.filter((item) => item.timingState === "due"),
  };
};

export const getDashboardScheduleSlot = (item = {}) =>
  item.periodLabel || (item.timingState === "due" ? "Due" : "Scheduled");
