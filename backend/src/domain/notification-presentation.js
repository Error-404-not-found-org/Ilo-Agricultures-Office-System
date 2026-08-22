const EVENT_ALIASES = {
  request_submitted: "service_request_submitted",
  farmer_breeding_observation_reported: "farmer_observation_submitted",
  breeding_observation_submitted: "farmer_observation_submitted",
  observation_review_required: "technician_review_required",
  pregnancy_checked_negative: "pregnancy_not_confirmed",
  pregnancy_loss_recorded: "pregnancy_loss",
  pregnancy_continuation_rechecked: "pregnancy_continuing",
  ai_attempt_failed: "ai_attempt_unsuccessful",
};

const RAW_STATUS_LABELS = {
  PREGNANT: "Pregnant",
  EMPTY: "Not pregnant",
  NEEDS_RECHECK: "Follow-up required",
  RETURN_TO_HEAT: "Return to heat",
  LIVE_BIRTH: "Live birth",
  LOSS_DETECTED: "Pregnancy loss",
  FOLLOW_UP_REQUIRED: "Follow-up required",
};

const cleanSpacing = (value) =>
  String(value || "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

export const sanitizeNotificationText = (value, fallback = "") => {
  const cleaned = String(value || fallback || "")
    .replace(/\[Summary\]\s*/gi, "")
    .replace(/SEED-repro-manual-\d{8}-/gi, "")
    .replace(/SEED-repro-[^-]+-/gi, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\uFE0E\uFE0F]/g, "")
    .replace(/\bMr\.\s+/g, "")
    .replace(/\buncompleted\b/gi, "not yet completed")
    .replace(/\bDay\s+(\d+)\s+post[- ]AI\b/gi, "$1 days after the AI service")
    .replace(/\b(\d+)\+?\s+days?\s+post[- ]AI\b/gi, "$1 days after the AI service")
    .replace(/\bP\.?D\.?\b/g, "pregnancy diagnosis")
    .replace(/\bN\/?A\b/gi, "Not recorded")
    .replace(
      /\b(PREGNANT|EMPTY|NEEDS_RECHECK|RETURN_TO_HEAT|LIVE_BIRTH|LOSS_DETECTED|FOLLOW_UP_REQUIRED)\b/g,
      (raw) => RAW_STATUS_LABELS[raw] || raw,
    );

  return cleanSpacing(cleaned) || fallback;
};

const normalizedEvent = (value) => {
  const event = String(value || "").trim().toLowerCase();
  return EVENT_ALIASES[event] || event;
};

const serviceLabel = (value) =>
  String(value || "").toLowerCase().includes("health")
    ? "Health assistance"
    : "AI service";

const animalLabel = (metadata = {}) =>
  sanitizeNotificationText(
    metadata.animalTag || metadata.animalReference || metadata.animal || "the animal",
    "the animal",
  );

const dateOnlyLabel = (value) => {
  if (!value) return "the recorded date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return sanitizeNotificationText(value);
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

export const visitScheduleLabel = (scheduledDate, visitPeriod) => {
  const parsedDate = new Date(scheduledDate);
  const date = !scheduledDate
    ? "the scheduled date"
    : Number.isNaN(parsedDate.getTime())
      ? sanitizeNotificationText(scheduledDate)
      : new Intl.DateTimeFormat("en-PH", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "Asia/Manila",
        }).format(parsedDate);
  const normalizedPeriod = String(visitPeriod || "").trim().toLowerCase();
  if (!scheduledDate || !["morning", "afternoon"].includes(normalizedPeriod)) {
    return date;
  }
  return `${date} · ${normalizedPeriod[0].toUpperCase()}${normalizedPeriod.slice(1)}`;
};

const reasonSentence = (reason) => {
  const readable = sanitizeNotificationText(reason);
  return readable ? ` Reason: ${readable}.` : "";
};

const structuredCopy = (eventType, metadata = {}) => {
  const event = normalizedEvent(eventType);
  const animal = animalLabel(metadata);
  const service = serviceLabel(metadata.serviceType || metadata.type);
  const isReInsemination = metadata.requestKind === "re_insemination";
  const technician = sanitizeNotificationText(
    metadata.technicianName || metadata.actorName || "The technician",
  );
  const farmer = sanitizeNotificationText(metadata.farmerName || "The farmer");
  const location = sanitizeNotificationText(metadata.location);
  const reason = metadata.reason;
  const urgent = ["high", "emergency", "critical"].includes(
    String(metadata.urgency || "").toLowerCase(),
  );

  const templates = {
    service_request_submitted: {
      title: `${urgent ? "Urgent health assistance" : service} request for ${animal}`,
      message: location
        ? `${urgent ? "An urgent" : "A new"} request is available in ${location}. Open it to review the details and claim the visit.`
        : `${urgent ? "An urgent" : "A new"} request is available. Open it to review the details and claim the visit.`,
    },
    re_insemination_requested: {
      title: `Re-insemination request for ${animal}`,
      message: `${farmer} requested another AI service after the previous attempt was confirmed unsuccessful. Open it to review the details and schedule the visit.`,
    },
    service_request_accepted: {
      title: `${service} request accepted`,
      message: `${technician} accepted the request for ${animal}. A visit time will be added next.`,
    },
    health_advice_available: {
      title: "Health advice available",
      message: `A technician responded to the Health request for ${animal}. Open the request to review the advice.`,
    },
    health_office_pickup_available: {
      title: "Office pickup available",
      message: `A technician confirmed an office-pickup response for ${animal}. Open the request to review the pickup instructions.`,
    },
    service_visit_scheduled: {
      title: isReInsemination
        ? "Re-insemination scheduled"
        : `${service} visit scheduled`,
      message: isReInsemination
        ? `Your re-insemination request for ${animal} has been scheduled for ${visitScheduleLabel(metadata.scheduledDate, metadata.visitPeriod)} with ${technician}.`
        : `The visit for ${animal} is scheduled for ${visitScheduleLabel(metadata.scheduledDate, metadata.visitPeriod)} with ${technician}.`,
    },
    service_visit_rescheduled: {
      title: isReInsemination
        ? "Re-insemination rescheduled"
        : `${service} visit rescheduled`,
      message: isReInsemination
        ? `Your re-insemination visit for ${animal} was moved to ${visitScheduleLabel(metadata.scheduledDate, metadata.visitPeriod)} with ${technician}.`
        : `The visit for ${animal} was moved to ${visitScheduleLabel(metadata.scheduledDate, metadata.visitPeriod)} with ${technician}.`,
    },
    service_started: {
      title: isReInsemination ? "Re-insemination started" : `${service} started`,
      message: isReInsemination
        ? `${technician} started the re-insemination service for ${animal}.`
        : `${technician} started the service for ${animal}.`,
    },
    service_completed: {
      title: isReInsemination
        ? "Re-insemination completed"
        : `${service} completed`,
      message:
        isReInsemination
          ? `The re-insemination service for ${animal} is complete. Continue monitoring the animal; a technician must confirm any reproductive outcome.`
          : service === "AI service"
          ? `The AI service for ${animal} is complete. Continue monitoring the animal; a technician must confirm any reproductive outcome.`
          : `The health assistance for ${animal} is complete. Open the record to review the diagnosis and treatment.`,
    },
    field_ai_recorded: {
      title: `AI service recorded for ${animal}`,
      message: `${technician} recorded the completed AI service. Continue monitoring the animal; a technician must confirm any reproductive outcome.`,
    },
    medical_record_added: {
      title: `${sanitizeNotificationText(metadata.recordType, "Health")} record added`,
      message: `A new record was added for ${animal}. Open the animal profile to review it.`,
    },
    withdrawal_safety_active: {
      title: "Food safety withdrawal period active",
      message: `Do not consume or sell meat or milk from ${animal} until ${dateOnlyLabel(metadata.withdrawalEndDate)} after treatment with ${sanitizeNotificationText(metadata.medicineName, "medicine")}.`,
    },
    animal_registered: {
      title: `${animal} was added to your animals`,
      message: `${technician} registered this animal. Open the animal profile to review its information.`,
    },
    service_request_declined: {
      title: `${service} request not approved`,
      message: `The request for ${animal} was not approved.${reasonSentence(reason)}`,
    },
    cancellation_requested: {
      title: `${service} cancellation needs review`,
      message: `${farmer} asked to cancel the visit for ${animal}.${
        metadata.isToday ? " The visit is scheduled for today." : ""
      }${reasonSentence(reason)}`,
    },
    cancellation_approved: {
      title: "Cancellation approved",
      message: `Your request to cancel the ${service.toLowerCase()} visit for ${animal} was approved.`,
    },
    cancellation_rejected: {
      title: "Cancellation not approved",
      message: `Your request to cancel the ${service.toLowerCase()} visit for ${animal} was not approved.${reasonSentence(reason)}`,
    },
    request_cancelled: {
      title: `${service} request cancelled`,
      message: `The request for ${animal} was cancelled${
        metadata.actorName ? ` by ${sanitizeNotificationText(metadata.actorName)}` : ""
      }.${reasonSentence(reason)}`,
    },
    farmer_observation_submitted: {
      title: "Observation submitted",
      message: `Your observation for ${animal} was sent to a technician for review.`,
    },
    farmer_observation_reported: {
      title: `Breeding observation recorded for ${animal}`,
      message: `${farmer} submitted a breeding observation. Follow the existing breeding schedule when professional follow-up becomes due.`,
    },
    technician_review_required: {
      title: "Observation needs review",
      message: `${farmer} submitted a breeding observation for ${animal}. Open it to choose the appropriate follow-up.`,
    },
    pregnancy_confirmed: {
      title: `Pregnancy confirmed for ${animal}`,
      message: `${technician} confirmed the pregnancy. The pregnancy tracker has been updated.`,
    },
    pregnancy_not_confirmed: {
      title: `Pregnancy not confirmed for ${animal}`,
      message: "The latest check did not confirm pregnancy. Open the breeding record to review the next step.",
    },
    return_to_heat_confirmed: {
      title: "Return to heat confirmed",
      message: `A technician confirmed that ${animal} returned to heat after insemination.`,
    },
    continuation_recheck_due: {
      title: "Pregnancy follow-up due",
      message: `A continuation recheck is due for ${animal}. Open the task to record the follow-up.`,
    },
    pregnancy_continuing: {
      title: "Pregnancy continuing",
      message: `The continuation recheck for ${animal} confirms that the pregnancy is continuing.`,
    },
    pregnancy_loss: {
      title: "Pregnancy loss recorded",
      message: `A pregnancy loss was recorded for ${animal}. Open the record for details and follow-up guidance.`,
    },
    ai_attempt_unsuccessful: {
      title: "AI attempt unsuccessful",
      message: `AI attempt ${metadata.attemptNumber || ""} for ${animal} was confirmed unsuccessful.`.replace(
        "attempt  for",
        "attempt for",
      ),
    },
    reinsemination_available: {
      title: "Another AI request is available",
      message: `${animal} is eligible for another AI request.`,
    },
    calving_recorded: {
      title: `Calving recorded for ${animal}`,
      message:
        sanitizeNotificationText(metadata.outcomeSummary) ||
        "The calving outcome was added to the animal record.",
    },
  };

  return templates[event] || null;
};

export const presentNotificationCopy = ({
  title,
  message,
  eventType,
  metadata,
} = {}) => {
  const template = structuredCopy(eventType || metadata?.eventType, metadata);
  if (template) return template;
  return {
    title: sanitizeNotificationText(title, "BreedSmart update"),
    message: sanitizeNotificationText(
      message,
      "Open BreedSmart to review this update.",
    ),
  };
};

export const normalizePushNotificationData = (data = {}) => {
  const normalized = { ...data };
  const rawType = String(data.type || "").toLowerCase();
  if (["ai", "ai-request", "insemination"].includes(rawType)) {
    normalized.type = "ai-request";
  } else if (["health", "health-request"].includes(rawType)) {
    normalized.type = "health-request";
  }

  for (const key of [
    "notificationId",
    "requestId",
    "taskId",
    "animalId",
    "recordId",
    "pregnancyId",
    "relatedId",
  ]) {
    if (normalized[key] !== undefined && normalized[key] !== null) {
      normalized[key] = String(normalized[key]);
    }
  }

  return normalized;
};

export const presentNotificationDocument = (notification) => {
  const source = notification?.toObject
    ? notification.toObject()
    : { ...(notification || {}) };
  const copy = presentNotificationCopy(source);
  return { ...source, ...copy };
};
