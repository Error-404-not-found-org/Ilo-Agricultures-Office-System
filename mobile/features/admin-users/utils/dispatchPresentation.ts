export type DispatchMunicipality = {
  municipalityCode?: string;
  municipalityName?: string;
  provinceName?: string;
};

export type DispatchProfile = {
  serviceMunicipalities?: DispatchMunicipality[];
  serviceCapabilities?: string[];
  availabilityStatus?: string;
  acceptsNewRequests?: boolean;
};

export type DispatchUser = {
  role?: string;
  clerkId?: string | null;
  status?: string;
  deletedAt?: string | null;
  isVerified?: boolean;
  profileClaimStatus?: string | null;
  dispatchProfile?: DispatchProfile;
  dispatchReadiness?: {
    eligible: boolean;
    blockingReasons: string[];
    informationalReasons?: string[];
  };
};

export const DISPATCH_CAPABILITY_LABELS: Record<string, string> = {
  AI: "Artificial Insemination",
  HEALTH: "Health Requests",
  PREGNANCY_DIAGNOSIS: "Pregnancy Diagnosis",
  CALVING: "Calving Services",
};

export const DISPATCH_BLOCKER_LABELS: Record<string, string> = {
  NO_TECHNICIAN_PROVIDED: "Technician details are unavailable",
  ACCOUNT_DELETED: "Account has been deleted",
  ACCOUNT_NOT_VERIFIED: "Account verification is incomplete",
  ACCOUNT_NOT_CLAIMED: "Profile has not been claimed",
  ACCOUNT_SUSPENDED: "Account is suspended",
  ACCOUNT_ON_LEAVE: "Account is on leave",
  ACCOUNT_STATUS_INELIGIBLE: "Account is not active",
  ROLE_NOT_ELIGIBLE: "Account is not a Technician account",
  NO_DISPATCH_PROFILE: "Dispatch setup has not started",
  NOT_ACCEPTING_REQUESTS: "Technician has not enabled Receive Requests",
  OFF_DUTY: "Technician is off duty",
  BUSY: "Technician is currently busy",
  AVAILABILITY_UNKNOWN: "Availability has not been set",
  NO_SERVICE_AREA: "No Field Area assigned",
  NO_SERVICE_CAPABILITIES: "No service capabilities assigned",
  CAPABILITY_MISMATCH: "Required service capability is not assigned",
  MUNICIPALITY_NOT_COVERED: "Field Area does not cover this request",
  MUNICIPALITY_UNRESOLVED: "Request municipality could not be verified",
};

const LEGACY_CLAIM_COMPATIBLE_STATUSES = new Set([undefined, null, "", "none"]);

export function getDispatchBlockingReasons(user?: DispatchUser | null) {
  if (!user) return ["NO_TECHNICIAN_PROVIDED"];
  if (user.dispatchReadiness?.blockingReasons) {
    return [...new Set(user.dispatchReadiness.blockingReasons)];
  }

  const reasons: string[] = [];
  if (user.deletedAt) reasons.push("ACCOUNT_DELETED");
  if (!user.isVerified) reasons.push("ACCOUNT_NOT_VERIFIED");
  if (
    !LEGACY_CLAIM_COMPATIBLE_STATUSES.has(user.profileClaimStatus) &&
    user.profileClaimStatus !== "claimed"
  ) {
    reasons.push("ACCOUNT_NOT_CLAIMED");
  }
  if (user.status === "suspended") reasons.push("ACCOUNT_SUSPENDED");
  else if (user.status === "on-leave") reasons.push("ACCOUNT_ON_LEAVE");
  else if (user.status !== "active" && user.status !== "on-site") {
    reasons.push("ACCOUNT_STATUS_INELIGIBLE");
  }
  if (user.role !== "technician") reasons.push("ROLE_NOT_ELIGIBLE");

  const profile = user.dispatchProfile;
  if (!profile) {
    reasons.push("NO_DISPATCH_PROFILE");
    return reasons;
  }
  if (profile.acceptsNewRequests !== true) reasons.push("NOT_ACCEPTING_REQUESTS");
  if (profile.availabilityStatus === "off_duty") reasons.push("OFF_DUTY");
  else if (profile.availabilityStatus === "busy") reasons.push("BUSY");
  else if (profile.availabilityStatus !== "available") reasons.push("AVAILABILITY_UNKNOWN");
  if (!(profile.serviceMunicipalities || []).some((area) => area.municipalityCode)) {
    reasons.push("NO_SERVICE_AREA");
  }
  if (!profile.serviceCapabilities?.length) reasons.push("NO_SERVICE_CAPABILITIES");

  return [...new Set(reasons)];
}

export function getDispatchReadinessPresentation(user?: DispatchUser | null) {
  const blockingReasons = getDispatchBlockingReasons(user);
  const eligible = user?.dispatchReadiness?.eligible ?? blockingReasons.length === 0;
  const setupIncomplete = blockingReasons.some((reason) =>
    ["NO_DISPATCH_PROFILE", "NO_SERVICE_AREA", "NO_SERVICE_CAPABILITIES"].includes(reason),
  );
  const accountUnavailable = blockingReasons.some((reason) =>
    ["ACCOUNT_DELETED", "ACCOUNT_SUSPENDED", "ACCOUNT_ON_LEAVE", "ACCOUNT_STATUS_INELIGIBLE"].includes(reason),
  );
  const notReceiving = blockingReasons.includes("NOT_ACCEPTING_REQUESTS");

  const title = eligible
    ? "Ready for new requests"
    : accountUnavailable
      ? "Account not available for dispatch"
      : setupIncomplete
        ? "Setup incomplete"
        : notReceiving
          ? "Not currently receiving requests"
          : "Not ready for new requests";

  return {
    eligible,
    title,
    tone: eligible ? "success" : setupIncomplete || notReceiving ? "warning" : "danger",
    blockingReasons,
    blockers: blockingReasons.map(
      (reason) => DISPATCH_BLOCKER_LABELS[reason] || "Dispatch requirement is incomplete",
    ),
  } as const;
}

export function getAccountStatePresentation(user?: DispatchUser | null) {
  if (!user) return { label: "Account unavailable", tone: "neutral" } as const;
  if (user.deletedAt) return { label: "Deleted", tone: "danger" } as const;
  if (user.status === "suspended" || user.status === "blocked") {
    return { label: "Suspended", tone: "danger" } as const;
  }
  if (user.status === "on-leave") return { label: "On leave", tone: "warning" } as const;
  if (!user.isVerified) return { label: "Verification pending", tone: "warning" } as const;
  return { label: "Active", tone: "success" } as const;
}

export function getProfileClaimStatePresentation(user?: DispatchUser | null) {
  if (user?.profileClaimStatus === "blocked") {
    return { label: "Claim Blocked", tone: "danger" } as const;
  }

  if (user?.profileClaimStatus === "claimed") {
    return { label: "Profile Claimed", tone: "success" } as const;
  }

  const hasLegacyClerkLink =
    Boolean(user?.clerkId) && !String(user?.clerkId).startsWith("manual_");
  if (
    LEGACY_CLAIM_COMPATIBLE_STATUSES.has(user?.profileClaimStatus) &&
    hasLegacyClerkLink
  ) {
    return { label: "Profile Claimed", tone: "success" } as const;
  }

  return { label: "Not Claimed", tone: "warning" } as const;
}

export function getFieldAreaLabel(profile?: DispatchProfile | null) {
  const labels = (profile?.serviceMunicipalities || [])
    .map((area) =>
      [area.municipalityName, area.provinceName].filter(Boolean).join(", "),
    )
    .filter(Boolean);
  return labels.length ? [...new Set(labels)].join("; ") : "No Field Area assigned";
}

export function getCapabilityLabels(profile?: DispatchProfile | null) {
  return (profile?.serviceCapabilities || []).map(
    (capability) => DISPATCH_CAPABILITY_LABELS[capability] || capability,
  );
}

export function getReceiveRequestsPresentation(profile?: DispatchProfile | null) {
  return profile?.acceptsNewRequests
    ? { label: "Receiving new requests", enabled: true }
    : { label: "Not receiving new requests", enabled: false };
}

export function getAvailabilityLabel(profile?: DispatchProfile | null) {
  switch (profile?.availabilityStatus) {
    case "available":
      return "Available";
    case "busy":
      return "Busy with current work";
    case "off_duty":
      return "Off duty";
    default:
      return "Availability not set";
  }
}
