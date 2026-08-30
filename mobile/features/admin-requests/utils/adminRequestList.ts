export const ACTIVE_AI_REQUEST_STATUSES = [
  "pending",
  "approved",
  "scheduled",
  "in-progress",
  "submitted",
  "accepted",
  "assigned",
  "in_progress",
  "awaiting-service",
  "awaiting service",
  "awaiting-result",
  "awaiting result",
  "under-monitoring",
  "under monitoring",
] as const;

export const ACTIVE_HEALTH_REQUEST_STATUSES = [
  "pending",
  "triaged",
  "assigned",
  "approved",
  "scheduled",
  "in-progress",
  "in_progress",
] as const;

export type AdminRequestType = "ai" | "health";
export type AdminRequestStatusFilter =
  | "all"
  | "pending"
  | "triaged"
  | "assigned"
  | "scheduled"
  | "in-progress";

const AI_STATUS_COMPATIBILITY: Record<string, string> = {
  submitted: "pending",
  accepted: "approved",
  assigned: "approved",
  in_progress: "in-progress",
  "awaiting-service": "scheduled",
  "awaiting service": "scheduled",
  "awaiting-result": "in-progress",
  "awaiting result": "in-progress",
  "under-monitoring": "in-progress",
  "under monitoring": "in-progress",
};

export function buildActiveRequestUrl(
  endpoint: string,
  statuses: readonly string[],
): string {
  const query = [
    "page=1",
    "limit=100",
    ...statuses.map((status) => `status=${encodeURIComponent(status)}`),
  ].join("&");

  return `${endpoint}?${query}`;
}

export function unwrapAdminRequestList(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: any[] }).data;
  }
  return [];
}

export function normalizeAdminRequestStatus(
  type: AdminRequestType,
  status: unknown,
): string {
  const value = String(status || "pending")
    .trim()
    .toLowerCase();
  if (type === "ai") return AI_STATUS_COMPATIBILITY[value] || value;
  return value === "in_progress" ? "in-progress" : value;
}

export function matchesAdminRequestStatus(
  type: AdminRequestType,
  status: unknown,
  filter: AdminRequestStatusFilter,
): boolean {
  if (filter === "all") return true;
  const normalized = normalizeAdminRequestStatus(type, status);
  if (filter === "assigned") {
    return normalized === "assigned" || normalized === "approved";
  }
  return normalized === filter;
}
