import {
  formatAnimalReference,
} from "../../farmer-dashboard/utils/farmerDashboard.transforms";

export type NotificationData = {
  _id: string;
  title?: string;
  message?: string;
  type?: string;
  category?: string;
  eventType?: string;
  linkType?: string;
  relatedId?: string;
  recordId?: string;
  taskId?: string;
  requestId?: string;
  pregnancyId?: string;
  animalId?: string | Record<string, unknown>;
  metadata?: Record<string, any>;
};

const readable = (value: unknown) =>
  String(value || "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const stripSeedPrefix = (value: string) =>
  String(value || "")
    .replace(/SEED-repro-manual-\d{8}-/gi, "")
    .replace(/SEED-repro-[^-]+-/gi, "")
    .replace(
      /\b(PREGNANT|EMPTY|NEEDS_RECHECK|RETURN_TO_HEAT|LIVE_BIRTH|LOSS_DETECTED|FOLLOW_UP_REQUIRED)\b/g,
      (raw) =>
        ({
          PREGNANT: "Pregnant",
          EMPTY: "Not pregnant",
          NEEDS_RECHECK: "Follow-up required",
          RETURN_TO_HEAT: "Return to heat",
          LIVE_BIRTH: "Live birth",
          LOSS_DETECTED: "Pregnancy loss",
          FOLLOW_UP_REQUIRED: "Follow-up required",
        })[raw] || raw,
    );

const eventAliases: Record<string, string> = {
  farmer_breeding_observation_reported: "farmer_observation_submitted",
  breeding_observation_submitted: "farmer_observation_submitted",
  observation_review_required: "technician_review_required",
  pregnancy_checked_negative: "pregnancy_not_confirmed",
  pregnancy_loss_recorded: "pregnancy_loss",
  pregnancy_continuation_rechecked: "pregnancy_continuing",
  ai_attempt_failed: "ai_attempt_unsuccessful",
};

export const getNotificationCategory = (item: NotificationData) => {
  const structured = String(
    item.category || item.metadata?.category || item.metadata?.workflowStage || "",
  ).toLowerCase();
  if (structured.includes("pregnan") || structured.includes("continuation")) return "pregnancy";
  if (structured.includes("calv")) return "calving";
  if (structured.includes("cancel")) return "cancellations";
  if (structured.includes("reminder") || structured.includes("follow")) return "reminders";
  if (structured.includes("health")) return "health";
  if (structured.includes("ai") || structured.includes("observation")) return "ai";
  if (item.type === "ai-request") return "ai";
  if (item.type === "health-request") return "health";
  return "system";
};

const eventKey = (item: NotificationData) => {
  const raw = String(item.eventType || item.metadata?.eventType || "").toLowerCase();
  return eventAliases[raw] || raw;
};

const animalReference = (item: NotificationData) =>
  formatAnimalReference(
    item.metadata?.animal ||
      item.metadata?.animalReference ||
      item.metadata?.animalTag ||
      item.animalId ||
      "the animal",
  );

export const presentNotification = (item: NotificationData) => {
  const event = eventKey(item);
  const animal = animalReference(item);
  const technician = item.metadata?.technicianName || "The technician";
  const attempt = item.metadata?.attemptNumber || "";
  const outcome = item.metadata?.outcomeSummary || "The calving outcome was added to the animal record.";
  const templates: Record<string, { title: string; body: string }> = {
    farmer_observation_submitted: {
      title: "Observation submitted",
      body: `Your observation for ${animal} was sent to the technician for review.`,
    },
    technician_review_required: {
      title: "Observation needs review",
      body: `A farmer submitted a breeding observation for ${animal}.`,
    },
    pregnancy_confirmed: {
      title: `Pregnancy confirmed for ${animal}`,
      body: `${technician} confirmed the pregnancy. The pregnancy tracker has been updated.`,
    },
    pregnancy_not_confirmed: {
      title: `Pregnancy not confirmed for ${animal}`,
      body: "The latest check did not confirm pregnancy. Review the animal’s breeding record for next steps.",
    },
    continuation_recheck_due: {
      title: "Pregnancy follow-up due",
      body: `A continuation recheck is due for ${animal}.`,
    },
    pregnancy_continuing: {
      title: "Pregnancy continuing",
      body: `The continuation recheck for ${animal} confirms the pregnancy is continuing.`,
    },
    pregnancy_loss: {
      title: "Pregnancy loss recorded",
      body: `A pregnancy loss was recorded for ${animal}. Review the record for details.`,
    },
    ai_attempt_unsuccessful: {
      title: "AI attempt unsuccessful",
      body: `Attempt ${attempt || "recorded"} for ${animal} was confirmed unsuccessful.`,
    },
    reinsemination_available: {
      title: "Re-insemination available",
      body: `${animal} is eligible for another AI request.`,
    },
    calving_recorded: {
      title: `Calving recorded for ${animal}`,
      body: outcome,
    },
  };
  const template = templates[event];
  if (template) return { ...template, category: getNotificationCategory(item) };
  return {
    title: stripSeedPrefix(item.title || "Notification update"),
    body: stripSeedPrefix(item.message || "Open this update for details."),
    category: getNotificationCategory(item),
  };
};

const value = (item: NotificationData, key: string) =>
  item[key as keyof NotificationData] || item.metadata?.[key];

export const getNotificationTarget = (item: NotificationData, role?: string) => {
  const taskId = value(item, "taskId");
  if (taskId && ["technician", "veterinarian"].includes(String(role))) {
    return { pathname: "/(technician)/task-details", params: { id: String(taskId) } };
  }
  const requestId = value(item, "requestId") ||
    (item.linkType === "request" ? item.relatedId : null) ||
    (["ai-request", "health-request"].includes(String(item.type)) ? item.relatedId : null);
  if (requestId) {
    const type = item.type === "health-request" ? "health" : "ai";
    if (["technician", "veterinarian"].includes(String(role))) {
      return { pathname: "/(technician)/request-details", params: { id: String(requestId), type } };
    }
    if (role === "farmer") {
      return {
        pathname: type === "health" ? "/(farmer)/health-request-detail" : "/(farmer)/ai-request-detail",
        params: { id: String(requestId) },
      };
    }
  }
  const pregnancyId = value(item, "pregnancyId");
  const animalId = value(item, "animalId") || (item.linkType === "animal" ? item.relatedId : null);
  if (pregnancyId && role === "farmer") {
    return { pathname: "/(farmer)/pregnancy-tracker", params: { pregnancyId: String(pregnancyId), animalId: animalId ? String(animalId) : undefined } };
  }
  const recordId = value(item, "recordId") || (item.linkType === "record" ? item.relatedId : null);
  if (recordId && role === "farmer") {
    return { pathname: "/(farmer)/animal-record-detail", params: { id: String(recordId), animalId: animalId ? String(animalId) : undefined } };
  }
  if (animalId) {
    return {
      pathname: role === "farmer" ? "/(farmer)/animal-details" : "/(technician)/animal-details",
      params: { id: String(animalId) },
    };
  }
  return { pathname: "/notification-details", params: { id: item._id } };
};

export const notificationEventLabel = (event: unknown) =>
  readable(event) || "Notification update";
