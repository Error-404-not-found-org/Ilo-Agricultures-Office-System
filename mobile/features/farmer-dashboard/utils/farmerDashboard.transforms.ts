import type { AIRequest, HealthRequest } from "@/types";
import { isFarmerBreedingObservationReminderDay } from "../../breeding/utils/breedingObservationPresentation.ts";
import type {
  FarmerActivity,
  FarmerActivityPresentation,
  FarmerAttentionItem,
  FarmerMilestone,
  UpcomingVisit,
} from "../types/farmerDashboard.types";

export const FARMER_HOME_LIMITS = {
  visits: 2,
  actions: 2,
  activities: 3,
} as const;

const rawAnimalValue = (animal: unknown): string => {
  if (!animal) return "Animal";
  if (typeof animal === "string") return animal;
  if (typeof animal !== "object") return String(animal);
  const value = animal as Record<string, unknown>;
  return String(value.earTag || value.animalId || value.name || "Animal");
};

export const formatAnimalReference = (animal: unknown): string => {
  const raw = rawAnimalValue(animal).trim();
  const scenarioReference = raw.match(/(RC\d{2})-(?:\d{6}-)?(\d{2})(?:-|$)/i);
  if (scenarioReference) {
    return `${scenarioReference[1].toUpperCase()}-${scenarioReference[2]}`;
  }

  return raw
    .replace(/^SEED-repro-manual-\d{8}-/i, "")
    .replace(/^SEED-repro-[^-]+-/i, "") || "Animal";
};

export const getFullAnimalReference = rawAnimalValue;

export const getFarmerDashboardLayout = (screenWidth: number) => {
  const horizontalPadding = screenWidth <= 320 ? 16 : screenWidth <= 360 ? 20 : 24;
  const nextCardPreview = screenWidth <= 320 ? 24 : screenWidth <= 360 ? 30 : 34;
  const cardGap = 12;
  const animalCardWidth = screenWidth <= 320 ? 148 : screenWidth <= 360 ? 156 : 164;

  return { horizontalPadding, animalCardWidth, cardGap, nextCardPreview };
};

const toArray = <T>(body: unknown): T[] => {
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === "object" && Array.isArray((body as any).data)) {
    return (body as any).data as T[];
  }
  return [];
};

export const responseToArray = toArray;

export const buildUpcomingVisits = (
  aiBody: unknown,
  healthBody: unknown,
): UpcomingVisit[] => {
  const aiRequests = toArray<AIRequest>(aiBody);
  const healthRequests = toArray<HealthRequest>(healthBody);

  const upcomingAI = aiRequests
    .filter((request) => {
      const status = request.status?.toLowerCase() ?? "";
      return (
        ["scheduled", "in-progress"].includes(status) &&
        Boolean(request.scheduledDate)
      );
    })
    .map((request) => ({
      ...request,
      serviceType: "ai" as const,
      technician:
        (request.approvedBy as any)?.name ||
        (request.technicianId as any)?.name ||
        null,
    }));

  const upcomingHealth = healthRequests
    .filter((request) => {
      const status = request.status?.toLowerCase() ?? "";
      return (
        ["scheduled", "in-progress"].includes(status) &&
        Boolean(request.scheduledDate)
      );
    })
    .map((request) => ({
      ...request,
      serviceType: "health" as const,
      technician: (request.handledBy as any)?.name || null,
    }));

  const seen = new Set<string>();
  return [...upcomingAI, ...upcomingHealth].filter((visit) => {
    const value = visit as UpcomingVisit & Record<string, unknown>;
    const linkedIdentity =
      value.requestId || value.relatedRequestId || value.taskId || value._id;
    const key = `${value.serviceType}:${String(linkedIdentity)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => {
    const dateA = new Date(a.scheduledDate || 0).getTime();
    const dateB = new Date(b.scheduledDate || 0).getTime();
    return dateA - dateB;
  });
};

export const selectUpcomingVisits = (visits: UpcomingVisit[] = []) =>
  visits.slice(0, FARMER_HOME_LIMITS.visits);

const attentionRank: Record<FarmerAttentionItem["urgency"], number> = {
  overdue: 0,
  due_today: 1,
  actionable: 2,
  awaiting: 3,
};

const isResolvedMilestone = (milestone: FarmerMilestone) => {
  const status = String(milestone.status || "").toLowerCase();
  return milestone.resolved === true ||
    ["resolved", "completed", "done", "cancelled", "canceled", "lost"].includes(status);
};

const toAttentionItem = (milestone: FarmerMilestone): FarmerAttentionItem | null => {
  if (isResolvedMilestone(milestone)) return null;

  const daysLeft = milestone.daysLeft !== null &&
    milestone.daysLeft !== undefined &&
    Number.isFinite(Number(milestone.daysLeft))
    ? Number(milestone.daysLeft)
    : null;
  const animalReference = formatAnimalReference(milestone.animal);
  const isPregnancyCheck = milestone.type === "pd_check";
  const isCalving = milestone.type === "calving";
  const hasFarmerObservation = Boolean(
    milestone.farmerObservation?.reportType,
  );
  const daysPostAI = milestone.pregnancyReadiness?.daysPostAI;

  // Farmer Home represents work the Farmer can perform now. Pregnancy checks
  // and submitted observations remain visible in the detail/tracker surfaces.
  if (isPregnancyCheck) return null;
  if (
    milestone.type === "heat_check" &&
    (hasFarmerObservation ||
      !isFarmerBreedingObservationReminderDay(daysPostAI))
  ) {
    return null;
  }

  const urgency: FarmerAttentionItem["urgency"] =
    daysLeft !== null && daysLeft < 0
      ? "overdue"
      : daysLeft === 0
        ? "due_today"
        : "actionable";

  let displayTitle = milestone.title || "Breeding action";
  let displaySubtitle = animalReference;
  let guidance = "Review this animal's breeding record.";
  let actionLabel = "View Animal";
  let actionKind: FarmerAttentionItem["actionKind"] = "view_animal";

  if (milestone.type === "heat_check") {
    const elapsedDays = Number(daysPostAI);
    displayTitle = `${elapsedDays} day${elapsedDays === 1 ? "" : "s"} after insemination`;
    displaySubtitle = animalReference;
    guidance = "Has your animal returned to heat?";
    actionLabel = "Give Update";
    actionKind = "report_signs";
  } else if (isCalving) {
    if (daysLeft !== null && daysLeft < 0) {
      displayTitle = "Past Expected Calving Date";
      displaySubtitle = `${animalReference} · ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} past expected date`;
      guidance = "Please update the outcome when known.";
      actionLabel = "Record Outcome";
      actionKind = "record_calving";
    } else if (daysLeft === 0) {
      displayTitle = "Expected Calving Today";
      displaySubtitle = `${animalReference} · Today`;
      guidance = "Has calving occurred?";
      actionLabel = "Record Calving";
      actionKind = "record_calving";
    } else {
      displayTitle = "Expected Calving";
      displaySubtitle = `${animalReference}${daysLeft !== null ? ` · Expected in ${daysLeft} day${daysLeft === 1 ? "" : "s"}` : ""}`;
      guidance = "Prepare for the expected calving date.";
    }
  }

  return {
    ...milestone,
    displayTitle,
    displaySubtitle,
    urgency,
    animalReference,
    guidance,
    actionLabel,
    actionKind,
  };
};

export const selectNeedsAttention = (milestones: FarmerMilestone[] = []) =>
  milestones
    .map(toAttentionItem)
    .filter((item): item is FarmerAttentionItem => Boolean(item))
    .sort((a, b) => {
      const rankDifference = attentionRank[a.urgency] - attentionRank[b.urgency];
      if (rankDifference !== 0) return rankDifference;
      return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
    })
    .slice(0, FARMER_HOME_LIMITS.actions);

const humanizeOutcome = (value: unknown): string => {
  const normalized = String(value || "").trim().toLowerCase();
  const outcomes: Record<string, string> = {
    live_birth: "Live birth",
    stillbirth: "Stillbirth",
    mixed: "Live birth and stillbirth",
    abortion: "Pregnancy loss",
    pending: "Outcome awaiting confirmation",
  };
  if (outcomes[normalized]) return outcomes[normalized];
  if (!normalized) return "Details recorded";
  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
};

export const formatHumanReadableRecordTitle = (
  activity: FarmerActivity,
): FarmerActivityPresentation => {
  const animalReference = formatAnimalReference(activity.animalId || activity.title);
  const fullAnimalReference = getFullAnimalReference(activity.animalId || activity.title);
  const type = String(activity.type || "record").toLowerCase();
  const details = activity.details || {};

  if (type === "calving") {
    const outcome = details.outcome ||
      (Number(details.stillbornCount) > 0 && Number(details.livingCalfCount) > 0
        ? "mixed"
        : Number(details.stillbornCount) > 0
          ? "stillbirth"
          : "live_birth");
    const outcomeLabel = humanizeOutcome(outcome);
    return {
      id: String(activity.id || activity._id || "calving"),
      title: outcomeLabel === "Stillbirth" || outcomeLabel === "Pregnancy loss"
        ? `Calving outcome recorded for ${animalReference}`
        : `Calving recorded for ${animalReference}`,
      outcome: outcomeLabel,
      date: activity.date || activity.createdAt,
      type,
      animalId: activity.animalId,
      fullAnimalReference,
    };
  }

  if (type === "ai") {
    const status = String(details.status || "").toLowerCase();
    const completed = ["done", "completed"].includes(status) || /performed|completed/i.test(activity.title || "");
    return {
      id: String(activity.id || activity._id || "ai"),
      title: `${completed ? "AI service completed" : "AI service requested"} for ${animalReference}`,
      outcome: humanizeOutcome(details.outcome || (completed ? "pending" : details.status)),
      date: activity.date || activity.createdAt,
      type,
      animalId: activity.animalId,
      fullAnimalReference,
    };
  }

  return {
    id: String(activity.id || activity._id || type),
    title: `${type === "health" ? "Health check" : "Record updated"} for ${animalReference}`,
    outcome: String(activity.description || humanizeOutcome(details.status)),
    date: activity.date || activity.createdAt,
    type,
    animalId: activity.animalId,
    fullAnimalReference,
  };
};

export const selectRecentActivities = (activities: FarmerActivity[] = []) =>
  activities
    .slice(0, FARMER_HOME_LIMITS.activities)
    .map(formatHumanReadableRecordTitle);

export const filterPendingOutcomes = (body: unknown): AIRequest[] => {
  return toArray<AIRequest>(body).filter((request) => {
    if (
      request.status !== "done" ||
      request.isSuccess !== null ||
      Boolean(request.farmerOutcomeReport)
    ) return false;
    const aiDate = new Date(request.inseminationDate || request.createdAt || 0);
    const today = new Date();
    const diffDays = Math.floor(
      Math.abs(today.getTime() - aiDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    return diffDays >= 18;
  });
};
