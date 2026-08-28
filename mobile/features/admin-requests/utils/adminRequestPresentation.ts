import {
  DISPATCH_CAPABILITY_LABELS,
  getDispatchBlockingReasons,
  getFieldAreaLabel,
  type DispatchUser,
} from "../../admin-users/utils/dispatchPresentation.ts";

export type AdminRequestLike = {
  status?: string;
  urgency?: string;
  scheduledDate?: string | Date;
  visitPeriod?: string;
  dispatch?: {
    location?: {
      municipalityCode?: string;
      municipalityName?: string;
      provinceName?: string;
      barangayName?: string;
    };
  };
  farmerId?: {
    address?: {
      barangay?: string;
      city?: string;
      province?: string;
    };
  };
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Unassigned",
  triaged: "Under review",
  assigned: "Assigned",
  approved: "Assigned",
  scheduled: "Scheduled",
  "in-progress": "In progress",
  in_progress: "In progress",
  done: "Completed",
  completed: "Completed",
  resolved: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const REASSIGNMENT_ERROR_MESSAGES: Record<string, string> = {
  NOT_ACCEPTING_REQUESTS: "Technician is not currently receiving new requests.",
  OUTSIDE_SERVICE_AREA: "Technician does not cover this request’s Field Area.",
  SERVICE_CAPABILITY_REQUIRED: "Technician does not have the required service capability.",
  TECHNICIAN_NOT_AVAILABLE: "Technician is not currently available for new requests.",
  TECHNICIAN_ACCOUNT_NOT_ACTIVE: "Technician account is not active.",
  TECHNICIAN_NOT_OPERATIONAL: "Technician dispatch setup is incomplete.",
  REQUEST_SERVICE_AREA_UNRESOLVED: "This request does not have a verified Field Area for reassignment.",
  TERMINAL_REQUEST_CANNOT_BE_REASSIGNED: "Completed, cancelled, or rejected work cannot be reassigned.",
  REQUEST_NOT_ASSIGNED: "Unassigned requests must use the normal Technician dispatch flow.",
  REASSIGNMENT_CONCURRENT_UPDATE: "The assignment changed. Refresh the request before trying again.",
};

export function getAdminRequestStatusLabel(status?: string) {
  const normalized = String(status || "pending").toLowerCase();
  return STATUS_LABELS[normalized] || normalized.replaceAll("_", " ");
}

export function isMeaningfullyUrgent(urgency?: string) {
  return ["high", "critical", "emergency"].includes(
    String(urgency || "").toLowerCase(),
  );
}

export function getAdminRequestLocation(request?: AdminRequestLike | null) {
  const dispatchLocation = request?.dispatch?.location;
  const dispatchParts = [
    dispatchLocation?.barangayName,
    dispatchLocation?.municipalityName,
    dispatchLocation?.provinceName,
  ].filter(Boolean);
  if (dispatchParts.length) return dispatchParts.join(", ");

  const address = request?.farmerId?.address;
  const legacyParts = [address?.barangay, address?.city, address?.province].filter(Boolean);
  return legacyParts.length ? legacyParts.join(", ") : "Location not recorded";
}

export function getAdminRequestSchedule(request?: AdminRequestLike | null) {
  if (!request?.scheduledDate) return null;
  const date = new Date(request.scheduledDate);
  if (Number.isNaN(date.getTime())) return null;
  const dateLabel = date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const period = String(request.visitPeriod || "").trim().replaceAll("_", " ");
  return period ? `${dateLabel} · ${period}` : dateLabel;
}

export function getFriendlyReassignmentError(error: any) {
  const code = error?.response?.data?.code || error?.code;
  return (
    REASSIGNMENT_ERROR_MESSAGES[code] ||
    error?.response?.data?.message ||
    "Unable to reassign this request. Refresh and try again."
  );
}

export type ReassignmentCandidate = DispatchUser & {
  _id: string;
  name?: string;
};

export function getReassignmentCandidatePresentation({
  technician,
  requestType,
  requestMunicipalityCode,
}: {
  technician: ReassignmentCandidate;
  requestType: "AI" | "HEALTH";
  requestMunicipalityCode?: string;
}) {
  const blockers = getDispatchBlockingReasons(technician);
  const capabilities = technician.dispatchProfile?.serviceCapabilities || [];
  if (!capabilities.includes(requestType)) blockers.push("CAPABILITY_MISMATCH");

  const coveredCodes = (technician.dispatchProfile?.serviceMunicipalities || [])
    .map((area) => area.municipalityCode)
    .filter(Boolean);
  if (!requestMunicipalityCode) blockers.push("MUNICIPALITY_UNRESOLVED");
  else if (!coveredCodes.includes(requestMunicipalityCode)) {
    blockers.push("MUNICIPALITY_NOT_COVERED");
  }

  const uniqueBlockers = [...new Set(blockers)];
  const primaryBlocker = uniqueBlockers[0];

  return {
    id: technician._id,
    name: technician.name || "Technician",
    fieldArea: getFieldAreaLabel(technician.dispatchProfile),
    capability: DISPATCH_CAPABILITY_LABELS[requestType],
    eligible: uniqueBlockers.length === 0,
    blockerCode: primaryBlocker,
    blockerLabel: primaryBlocker
      ? {
          NOT_ACCEPTING_REQUESTS: "Not receiving new requests",
          OFF_DUTY: "Off duty",
          BUSY: "Busy with current work",
          NO_SERVICE_AREA: "No Field Area assigned",
          NO_SERVICE_CAPABILITIES: "No capabilities assigned",
          CAPABILITY_MISMATCH: `Missing ${DISPATCH_CAPABILITY_LABELS[requestType]} capability`,
          MUNICIPALITY_NOT_COVERED: "Does not cover this Field Area",
          MUNICIPALITY_UNRESOLVED: "Request Field Area is unresolved",
          ACCOUNT_NOT_VERIFIED: "Account verification is incomplete",
          ACCOUNT_NOT_CLAIMED: "Invitation has not been claimed",
          ACCOUNT_SUSPENDED: "Account is suspended",
        }[primaryBlocker] || "Dispatch requirements are incomplete"
      : null,
  };
}
