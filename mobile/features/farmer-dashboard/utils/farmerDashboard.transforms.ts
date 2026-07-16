import type { AIRequest, HealthRequest } from "@/types";
import type { UpcomingVisit } from "../types/farmerDashboard.types";

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

  return [...upcomingAI, ...upcomingHealth].sort((a, b) => {
    const dateA = new Date(a.scheduledDate || 0).getTime();
    const dateB = new Date(b.scheduledDate || 0).getTime();
    return dateA - dateB;
  });
};

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
