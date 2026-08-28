export type AnimalVisitCandidate = {
  status: string;
  scheduledDate?: string;
  ownerIds?: unknown[];
};

type ViewerContext = {
  role: "farmer" | "technician" | "admin";
  currentTechnicianId?: string;
  now?: number;
};

const SCHEDULED_VISIT_STATUSES = new Set([
  "assigned",
  "approved",
  "scheduled",
]);

export const getStableEntityId = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";

  const candidate = value as { _id?: unknown; id?: unknown };
  return getStableEntityId(candidate._id ?? candidate.id);
};

export const isVisitOwnedByTechnician = (
  visit: AnimalVisitCandidate,
  currentTechnicianId?: string,
) => {
  const technicianId = getStableEntityId(currentTechnicianId);
  const ownerIds = (visit.ownerIds || [])
    .map(getStableEntityId)
    .filter(Boolean);

  return (
    Boolean(technicianId) &&
    ownerIds.length > 0 &&
    ownerIds.every((ownerId) => ownerId === technicianId)
  );
};

export const selectNextAnimalVisit = <T extends AnimalVisitCandidate>(
  visits: T[],
  { role, currentTechnicianId, now = Date.now() }: ViewerContext,
): T | undefined =>
  visits
    .filter((visit) => {
      if (
        !visit.scheduledDate ||
        !SCHEDULED_VISIT_STATUSES.has(visit.status.toLowerCase())
      ) {
        return false;
      }

      const scheduledAt = new Date(visit.scheduledDate).getTime();
      if (!Number.isFinite(scheduledAt) || scheduledAt <= now) return false;

      return (
        role !== "technician" ||
        isVisitOwnedByTechnician(visit, currentTechnicianId)
      );
    })
    .sort(
      (first, second) =>
        new Date(first.scheduledDate || 0).getTime() -
        new Date(second.scheduledDate || 0).getTime(),
    )[0];
