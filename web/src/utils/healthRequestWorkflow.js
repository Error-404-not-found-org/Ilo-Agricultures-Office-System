const MANILA_TIME_ZONE = "Asia/Manila";
const ADVICE_MAX_LENGTH = 2000;
const PICKUP_ITEM_MAX_LENGTH = 200;
const PICKUP_TEXT_MAX_LENGTH = 2000;

const text = (value) => (typeof value === "string" ? value.trim() : "");

const entityPresent = (value) => {
  if (!value) return false;
  if (typeof value === "string") return Boolean(value.trim());
  return Boolean(value._id || value.id);
};

export const normalizeHealthStatus = (value) =>
  text(value).toLowerCase().replaceAll("_", "-").replaceAll(" ", "-");

export const getHealthRequestId = (task = {}) =>
  task.workflowId || task.id || task._id || task.raw?._id || task.raw?.id || null;

export const isOwnedHealthRequest = (request = {}) =>
  entityPresent(request.handledBy) ||
  entityPresent(request.assignedTechnicianId);

export const isHealthAdviceEligible = (request = {}) => {
  const status = normalizeHealthStatus(request.status);
  const handlingMethod = text(request.handlingMethod).toLowerCase();
  const hasOwner = isOwnedHealthRequest(request);

  if (
    status === "scheduled" ||
    request.scheduledDate ||
    request.visitPeriod ||
    ["farm_visit", "office_pickup"].includes(handlingMethod) ||
    [
      "in-progress",
      "resolved",
      "done",
      "completed",
      "cancelled",
      "rejected",
      "declined",
    ].includes(status)
  ) {
    return false;
  }

  if (status === "pending") return hasOwner;
  return hasOwner && ["triaged", "assigned", "approved"].includes(status);
};

export const isHealthOfficePickupEligible = (request = {}) => {
  const status = normalizeHealthStatus(request.status);
  const handlingMethod = text(request.handlingMethod).toLowerCase();
  const hasOwner = isOwnedHealthRequest(request);

  if (
    request.scheduledDate ||
    request.visitPeriod ||
    handlingMethod ||
    [
      "scheduled",
      "in-progress",
      "resolved",
      "done",
      "completed",
      "cancelled",
      "rejected",
      "declined",
    ].includes(status)
  ) {
    return false;
  }

  if (status === "pending") return hasOwner;
  return hasOwner && ["triaged", "assigned", "approved"].includes(status);
};

export const isHealthFarmVisitEligible = (request = {}) => {
  const status = normalizeHealthStatus(request.status);
  const handlingMethod = text(request.handlingMethod).toLowerCase();
  if (!isOwnedHealthRequest(request)) return false;
  if (request.scheduledDate || request.visitPeriod || handlingMethod) return false;
  return ["pending", "triaged", "assigned", "approved"].includes(status);
};

export const buildHealthAdvicePayload = ({
  adviceForFarmer = "",
  followUpDate = "",
  internalNote = "",
} = {}) => {
  const payload = { advice: adviceForFarmer.trim() };
  if (internalNote.trim()) payload.technicianNote = internalNote.trim();
  if (followUpDate.trim()) payload.followUpDate = followUpDate.trim();
  return payload;
};

export const validateHealthAdvice = (draft = {}) => {
  const advice = text(draft.adviceForFarmer);
  if (!advice) return "Advice for the farmer is required.";
  if (advice.length > ADVICE_MAX_LENGTH) {
    return `Advice must be ${ADVICE_MAX_LENGTH.toLocaleString()} characters or fewer.`;
  }
  return validateOptionalFutureDate(draft.followUpDate);
};

export const buildHealthOfficePickupPayload = ({
  item = "",
  pickupInstructions = "",
  farmerMessage = "",
  dosageInstructions = "",
  withdrawalGuidance = "",
  followUpDate = "",
  internalNote = "",
} = {}) => {
  const payload = {
    item: item.trim(),
    availabilityConfirmed: true,
    instructions: pickupInstructions.trim(),
  };
  const optionalFields = [
    ["farmerMessage", farmerMessage],
    ["dosageOrUseInstructions", dosageInstructions],
    ["withdrawalGuidance", withdrawalGuidance],
    ["technicianNote", internalNote],
    ["followUpDate", followUpDate],
  ];
  for (const [field, value] of optionalFields) {
    if (value.trim()) payload[field] = value.trim();
  }
  return payload;
};

export const validateHealthOfficePickup = (draft = {}) => {
  const item = text(draft.item);
  const instructions = text(draft.pickupInstructions);
  if (!item) return "Item available for pickup is required.";
  if (item.length > PICKUP_ITEM_MAX_LENGTH) {
    return `Item must be ${PICKUP_ITEM_MAX_LENGTH} characters or fewer.`;
  }
  if (draft.availabilityConfirmed !== true) {
    return "Confirm that the item is available for office pickup.";
  }
  if (!instructions) return "Pickup instructions are required.";

  const fields = [
    ["Pickup instructions", draft.pickupInstructions],
    ["Message for Farmer", draft.farmerMessage],
    ["Dosage / Use instructions", draft.dosageInstructions],
    ["Withdrawal guidance", draft.withdrawalGuidance],
    ["Internal Note", draft.internalNote],
  ];
  const tooLong = fields.find(
    ([, value]) => text(value).length > PICKUP_TEXT_MAX_LENGTH,
  );
  if (tooLong) {
    return `${tooLong[0]} must be ${PICKUP_TEXT_MAX_LENGTH.toLocaleString()} characters or fewer.`;
  }
  return validateOptionalFutureDate(draft.followUpDate);
};

const manilaParts = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: MANILA_TIME_ZONE,
  }).formatToParts(value);
  const part = (type) => parts.find((entry) => entry.type === type)?.value || "";
  return {
    dateKey: `${part("year")}-${part("month")}-${part("day")}`,
    hour: Number(part("hour") || 0),
  };
};

export const getManilaDateKey = (value = new Date()) =>
  manilaParts(value).dateKey;

const isValidDateKey = (value) => {
  const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

export const validateOptionalFutureDate = (value, now = new Date()) => {
  const dateKey = text(value);
  if (!dateKey) return null;
  if (!isValidDateKey(dateKey)) return "Follow-up date is invalid.";
  if (dateKey < getManilaDateKey(now)) {
    return "Follow-up date cannot be in the past.";
  }
  return null;
};

export const getHealthVisitPeriodAvailability = (
  scheduledDate,
  visitPeriod,
  now = new Date(),
) => {
  const selectedDate = text(scheduledDate);
  const { dateKey: today, hour } = manilaParts(now);
  if (!isValidDateKey(selectedDate)) {
    return { disabled: true, requiresConfirmation: false, reason: "Choose a valid visit date." };
  }
  if (selectedDate < today) {
    return { disabled: true, requiresConfirmation: false, reason: "Visit date cannot be in the past." };
  }
  if (selectedDate > today) {
    return { disabled: false, requiresConfirmation: false, reason: "" };
  }
  if (visitPeriod === "morning") {
    if (hour >= 12) {
      return { disabled: true, requiresConfirmation: false, reason: "Today Morning is no longer available." };
    }
    return {
      disabled: false,
      requiresConfirmation: hour >= 10,
      reason: hour >= 10 ? "Current period confirmation required." : "",
    };
  }
  if (visitPeriod === "afternoon") {
    if (hour >= 18) {
      return { disabled: true, requiresConfirmation: false, reason: "Today Afternoon is no longer available." };
    }
    return {
      disabled: false,
      requiresConfirmation: hour >= 15,
      reason: hour >= 15 ? "Current period confirmation required." : "",
    };
  }
  return { disabled: false, requiresConfirmation: false, reason: "" };
};

export const formatHealthVisitSchedule = (scheduledDate, visitPeriod) => {
  const dateKey = text(scheduledDate).match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  if (!dateKey) return "Not scheduled";
  const [year, month, day] = dateKey.split("-").map(Number);
  const label = new Date(year, month - 1, day).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const period = text(visitPeriod).toLowerCase();
  return `${label}${period ? ` · ${period === "morning" ? "Morning" : "Afternoon"}` : ""}`;
};

export const HEALTH_ADVICE_MAX_LENGTH = ADVICE_MAX_LENGTH;
export const HEALTH_PICKUP_ITEM_MAX_LENGTH = PICKUP_ITEM_MAX_LENGTH;
export const HEALTH_PICKUP_TEXT_MAX_LENGTH = PICKUP_TEXT_MAX_LENGTH;
