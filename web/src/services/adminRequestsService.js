import axiosInstance from "../lib/axios";

const REQUEST_TYPE_ALIASES = new Map([
  ["ai", "ai"],
  ["insemination", "ai"],
  ["artificial insemination", "ai"],
  ["health", "health"],
]);

export function normalizeAdminRequestType(type) {
  const normalized = REQUEST_TYPE_ALIASES.get(
    String(type || "")
      .trim()
      .toLowerCase()
      .replaceAll("_", " "),
  );

  if (!normalized) {
    throw new Error("Only Insemination and Health requests can be reassigned.");
  }

  return normalized;
}

export async function reassignRequest({ type, requestId, technicianId }) {
  if (!requestId) throw new Error("Request details are unavailable.");
  if (!technicianId) throw new Error("Choose a Technician before reassigning this request.");

  const requestType = normalizeAdminRequestType(type);
  return axiosInstance.post(
    `/admin/requests/${requestType}/${encodeURIComponent(requestId)}/reassign`,
    { technicianId },
  );
}

export function invalidateAdminReassignmentQueries(queryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["admin", "dashboard-overview"] }),
    queryClient.invalidateQueries({ queryKey: ["admin", "work-queue-oversight"] }),
    queryClient.invalidateQueries({ queryKey: ["admin", "technician-tasks"] }),
    queryClient.invalidateQueries({ queryKey: ["technician", "requests"] }),
    queryClient.invalidateQueries({
      queryKey: ["technician", "requests-stats-background"],
    }),
  ]);
}
