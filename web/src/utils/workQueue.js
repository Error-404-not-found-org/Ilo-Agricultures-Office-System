const normalizeStatus = (value) =>
  String(value || "pending").trim().toLowerCase().replaceAll(" ", "_");

export const isTerminalTask = (task = {}) =>
  ["completed", "done", "cancelled"].includes(normalizeStatus(task.status));

export const isOnHoldTask = (task = {}) =>
  normalizeStatus(task.status) === "paused";

export const isActiveTask = (task = {}) => !isTerminalTask(task);

const localDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const isTaskDueToday = (task = {}, now = new Date()) =>
  isActiveTask(task) &&
  !isOnHoldTask(task) &&
  Boolean(task.dueDate) &&
  localDateKey(task.dueDate) === localDateKey(now);

export const isTaskUpcoming = (task = {}, now = new Date()) => {
  if (!isActiveTask(task) || isOnHoldTask(task) || !task.dueDate) return false;
  const dueKey = localDateKey(task.dueDate);
  const todayKey = localDateKey(now);
  return Boolean(dueKey && todayKey && dueKey > todayKey);
};

const getLocalWeekRange = (now) => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const dayFromMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayFromMonday);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
};

export const isTaskScheduledThisWeek = (task = {}, now = new Date()) => {
  if (!isActiveTask(task) || !task.dueDate) return false;
  const dueDate = new Date(task.dueDate);
  if (Number.isNaN(dueDate.getTime())) return false;
  const { start, end } = getLocalWeekRange(now);
  return dueDate >= start && dueDate < end;
};

export const isTaskCompletedThisWeek = (task = {}, now = new Date()) => {
  if (!["completed", "done"].includes(normalizeStatus(task.status))) return false;
  const completedAt = new Date(task.completedAt || task.updatedAt || "");
  if (Number.isNaN(completedAt.getTime())) return false;

  const { start, end } = getLocalWeekRange(now);
  return completedAt >= start && completedAt < end;
};
