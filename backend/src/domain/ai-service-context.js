import { getEarlyStartTiming } from "./service-timing.js";

const idOf = (value) => value?._id || value || null;

const sameId = (left, right) =>
  Boolean(left && right && String(idOf(left)) === String(idOf(right)));

const dateKeyInManila = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

export const buildAIServiceContext = ({
  activeRequest = null,
  eligibility,
  task = null,
  actorId,
  isAdmin = false,
  now = new Date(),
}) => {
  if (!activeRequest) {
    const eligible = Boolean(eligibility?.eligible);
    return {
      mode: eligible ? "walk_in" : "blocked",
      eligibility,
      activeRequest: null,
      timing: null,
      allowedActions: eligible
        ? ["record_walk_in", "schedule_visit"]
        : [],
      blockedReason: eligible
        ? ""
        : eligibility?.reason || "This animal is not eligible for AI service.",
    };
  }

  const assignedTechnician =
    activeRequest.technicianId || activeRequest.approvedBy || null;
  const assignment = !assignedTechnician
    ? "unclaimed"
    : sameId(assignedTechnician, actorId)
      ? "mine"
      : "other";
  const canOpen = isAdmin || assignment !== "other";
  const scheduledDate =
    activeRequest.scheduledDate || activeRequest.preferredDate || null;
  const earlyTiming = scheduledDate
    ? getEarlyStartTiming(scheduledDate, now)
    : { isEarly: false, earlyStartMinutes: 0 };
  const scheduledAt = scheduledDate ? new Date(scheduledDate) : null;
  const validSchedule = scheduledAt && !Number.isNaN(scheduledAt.getTime());
  const isOverdue = Boolean(
    validSchedule && scheduledAt.getTime() < new Date(now).getTime(),
  );

  return {
    mode: canOpen ? "request" : "blocked",
    eligibility,
    activeRequest: {
      requestId: activeRequest._id,
      taskId: task?._id || null,
      status: activeRequest.status,
      createdAt: activeRequest.createdAt,
      scheduledDate,
      assignedTechnician: assignedTechnician
        ? {
            _id: idOf(assignedTechnician),
            name: assignedTechnician.name || "Assigned technician",
          }
        : null,
      assignment,
    },
    timing: {
      isToday: Boolean(
        validSchedule &&
          dateKeyInManila(scheduledAt) === dateKeyInManila(now),
      ),
      isEarly: Boolean(earlyTiming.isEarly),
      earlyStartMinutes: earlyTiming.earlyStartMinutes || 0,
      isOverdue,
    },
    allowedActions: canOpen
      ? assignment === "unclaimed"
        ? ["claim_request"]
        : ["open_request"]
      : [],
    blockedReason: canOpen
      ? ""
      : `This request is assigned to ${assignedTechnician?.name || "another technician"}.`,
  };
};
