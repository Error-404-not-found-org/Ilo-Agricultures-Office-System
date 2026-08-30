import {
  getDispatchReadinessPresentation,
  type DispatchUser,
} from "../../admin-users/utils/dispatchPresentation.ts";
import type { TechnicianWorkloadSummary } from "../../admin-workload/services/adminWorkload.service.ts";
import { getActiveWorkloadTotal } from "../../admin-workload/utils/adminWorkloadPresentation.ts";

type RequestSummary = {
  status?: string;
  handledBy?: unknown;
  assignedTechnicianId?: unknown;
  technicianId?: unknown;
  approvedBy?: unknown;
};

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
  workloadSummary,
}: {
  technicians: DispatchUser[];
  aiRequests: unknown;
  healthRequests: unknown;
  workloadSummary: TechnicianWorkloadSummary[];
}) {
  const aiRows = rowsOf(aiRequests);
  const healthRows = rowsOf(healthRequests);
  const allRequests = [...aiRows, ...healthRows];
  const pendingRequests = allRequests.filter(
    (request) => String(request.status || "").toLowerCase() === "pending",
  ).length;
  const activeWork = getActiveWorkloadTotal(workloadSummary);
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
