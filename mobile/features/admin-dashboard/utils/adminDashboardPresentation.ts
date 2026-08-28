import {
  getDispatchReadinessPresentation,
  type DispatchUser,
} from "../../admin-users/utils/dispatchPresentation.ts";

type RequestSummary = {
  status?: string;
  handledBy?: unknown;
  assignedTechnicianId?: unknown;
  technicianId?: unknown;
  approvedBy?: unknown;
};

const activeStatuses = new Set([
  "approved",
  "assigned",
  "scheduled",
  "in-progress",
  "in_progress",
]);

const rowsOf = (payload: any): RequestSummary[] =>
  Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [];

export function buildAdminAttentionSummary({
  technicians,
  aiRequests,
  healthRequests,
}: {
  technicians: DispatchUser[];
  aiRequests: unknown;
  healthRequests: unknown;
}) {
  const aiRows = rowsOf(aiRequests);
  const healthRows = rowsOf(healthRequests);
  const allRequests = [...aiRows, ...healthRows];
  const pendingRequests = allRequests.filter(
    (request) => String(request.status || "").toLowerCase() === "pending",
  ).length;
  const activeWork = allRequests.filter((request) =>
    activeStatuses.has(String(request.status || "").toLowerCase()),
  ).length;
  const notReadyTechnicians = technicians.filter(
    (technician) => !getDispatchReadinessPresentation(technician).eligible,
  ).length;
  const setupIncompleteTechnicians = technicians.filter((technician) =>
    getDispatchReadinessPresentation(technician).blockingReasons.some((reason) =>
      ["NO_DISPATCH_PROFILE", "NO_SERVICE_AREA", "NO_SERVICE_CAPABILITIES"].includes(reason),
    ),
  ).length;

  return {
    pendingRequests,
    activeWork,
    totalTechnicians: technicians.length,
    notReadyTechnicians,
    setupIncompleteTechnicians,
  };
}
