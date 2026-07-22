import {
  getTaskOperationalStatus,
  getTaskType,
} from "../constants/technicianWorkflow";
import { getTechnicianStatus } from "../constants/technicianWorkflow";
import {
  getRequestWorkflowSummary,
  getTaskWorkflowSummary,
} from "./reproductionWorkflow";

const TERMINAL_STATUSES = new Set([
  "done",
  "resolved",
  "completed",
  "rejected",
  "cancelled",
]);

const normalizedStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "-")
    .replaceAll("_", "-");

const isActive = (item = {}) => !TERMINAL_STATUSES.has(normalizedStatus(item.status));

const idOf = (value) =>
  value?._id || value?.id || (typeof value === "string" ? value : null);

const workKey = (item = {}, index = 0) =>
  `${item.type || item.taskType || "work"}:${idOf(item.id || item._id) || index}`;

const dateOf = (item = {}) =>
  item.displayDate || item.scheduledDate || item.preferredDate || item.dueDate || null;

const localDayStart = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const isDueToday = (item, now) => {
  const itemDay = localDayStart(dateOf(item));
  const today = localDayStart(now);
  return Boolean(itemDay && today && itemDay.getTime() === today.getTime());
};

const isOverdue = (item, now) => {
  if (item.overdue === true) return true;
  const itemDay = localDayStart(dateOf(item));
  const today = localDayStart(now);
  return Boolean(itemDay && today && itemDay.getTime() < today.getTime() && isActive(item));
};

const animalKey = (item = {}) => {
  const raw = item.raw || item;
  const animal = item.animalId || raw.animalId || raw.animalIds?.[0];
  return idOf(animal) || item.animalTag || raw.animalTag || null;
};

export const summarizeDashboardWork = (
  pendingRequests = [],
  agendaItems = [],
  now = new Date(),
) => {
  const activeRequests = pendingRequests.filter(isActive);
  const activeWork = new Map();
  [...activeRequests, ...agendaItems.filter(isActive)].forEach((item, index) => {
    activeWork.set(workKey(item, index), item);
  });
  const activeAgenda = agendaItems.filter(isActive);
  const animals = new Set(
    [...activeWork.values()].map(animalKey).filter(Boolean).map(String),
  );

  return {
    activeWorkCount: activeWork.size,
    activeRequestCount: activeRequests.length,
    aiRequestCount: activeRequests.filter((item) => item.type === "insemination").length,
    healthRequestCount: activeRequests.filter((item) => item.type === "health").length,
    pregnancyFollowUpCount: activeAgenda.filter(
      (item) => item.type === "task" && String(item.taskType).toUpperCase() === "PD",
    ).length,
    dueTodayCount: activeAgenda.filter((item) => isDueToday(item, now)).length,
    overdueCount: activeAgenda.filter((item) => isOverdue(item, now)).length,
    animalsToSeeCount: animals.size,
  };
};

export const getDashboardAgendaPresentation = (item = {}, now = new Date()) => {
  const raw = item.raw || item;
  const isTask = item.type === "task" || Boolean(item.taskType);
  const workflow = isTask
    ? getTaskWorkflowSummary(raw)
    : getRequestWorkflowSummary({
        ...item,
        serviceLabel: item.serviceType || "service",
      });
  const taskType = getTaskType(item.taskType || raw.taskType);
  const taskStatus = isTask
    ? getTaskOperationalStatus(raw, now)
    : null;
  const serviceStatus = getTechnicianStatus(normalizedStatus(item.status));
  const overdue = isOverdue(item, now);
  const dueToday = isDueToday(item, now);
  const status = overdue
    ? { label: "Overdue", badgeClass: "badge-error" }
    : item.isReadyToday
      ? { label: "Ready today", badgeClass: "badge-warning" }
      : taskStatus || serviceStatus;

  return {
    serviceLabel:
      isTask && String(item.taskType || raw.taskType).toUpperCase() === "PD"
        ? workflow.stageLabel
        : item.serviceType || taskType.label || "Field visit",
    sourceLabel: workflow.sourceLabel,
    nextActionLabel: workflow.nextActionLabel,
    statusLabel: status.label,
    statusClass: status.badgeClass,
    isDueToday: dueToday,
    isOverdue: overdue,
  };
};
