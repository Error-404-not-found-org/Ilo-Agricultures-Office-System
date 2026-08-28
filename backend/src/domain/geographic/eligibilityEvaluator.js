import { DISPATCH_STAGES } from "./constants.js";
import { normalizeMunicipalityCode } from "./psgcRegistry.js";

const LEGACY_CLAIM_COMPATIBLE_STATUSES = new Set([undefined, null, "", "none"]);

const createEligibilityResult = () => ({
  eligible: false,
  blockingReasons: [],
  informationalReasons: [],
  matchedMunicipalityCode: null,
  matchedCapability: null,
});

const uniqueServiceMunicipalityCodes = (profile) =>
  [
    ...new Set(
      (profile?.serviceMunicipalities || [])
        .flatMap((municipality) => {
          const storedCode = String(
            municipality?.municipalityCode || "",
          ).trim();
          const canonicalCode = normalizeMunicipalityCode(storedCode);
          return [storedCode, canonicalCode];
        })
        .filter(Boolean),
    ),
  ];

/**
 * Evaluates whether a Technician account is operationally ready to receive
 * new Farmer requests, before matching a particular request location.
 *
 * Verified legacy Technician accounts with the historical `none`/missing
 * claim status remain compatible. Explicit unclaimed/blocked profiles do not.
 */
export function evaluateTechnicianDispatchReadiness({
  technician,
  requestType,
} = {}) {
  const result = createEligibilityResult();

  if (!technician) {
    result.blockingReasons.push("NO_TECHNICIAN_PROVIDED");
    return result;
  }

  if (technician.deletedAt != null) {
    result.blockingReasons.push("ACCOUNT_DELETED");
  }
  if (!technician.isVerified) {
    result.blockingReasons.push("ACCOUNT_NOT_VERIFIED");
  }
  if (
    !LEGACY_CLAIM_COMPATIBLE_STATUSES.has(technician.profileClaimStatus) &&
    technician.profileClaimStatus !== "claimed"
  ) {
    result.blockingReasons.push("ACCOUNT_NOT_CLAIMED");
  }
  if (technician.status === "suspended") {
    result.blockingReasons.push("ACCOUNT_SUSPENDED");
  } else if (technician.status === "on-leave") {
    result.blockingReasons.push("ACCOUNT_ON_LEAVE");
  } else if (technician.status !== "active" && technician.status !== "on-site") {
    result.blockingReasons.push("ACCOUNT_STATUS_INELIGIBLE");
  }
  if (technician.role !== "technician") {
    result.blockingReasons.push("ROLE_NOT_ELIGIBLE");
  }

  const profile = technician.dispatchProfile;
  if (!profile) {
    result.blockingReasons.push("NO_DISPATCH_PROFILE");
  } else {
    if (profile.acceptsNewRequests !== true) {
      result.blockingReasons.push("NOT_ACCEPTING_REQUESTS");
    }
    if (profile.availabilityStatus === "off_duty") {
      result.blockingReasons.push("OFF_DUTY");
    } else if (profile.availabilityStatus === "busy") {
      result.blockingReasons.push("BUSY");
    } else if (profile.availabilityStatus !== "available") {
      result.blockingReasons.push("AVAILABILITY_UNKNOWN");
    }

    if (uniqueServiceMunicipalityCodes(profile).length === 0) {
      result.blockingReasons.push("NO_SERVICE_AREA");
    }

    if (requestType) {
      if (!profile.serviceCapabilities?.includes(requestType)) {
        result.blockingReasons.push("CAPABILITY_MISMATCH");
      } else {
        result.matchedCapability = requestType;
      }
    } else if (!profile.serviceCapabilities?.length) {
      result.blockingReasons.push("NO_SERVICE_CAPABILITIES");
    }
  }

  result.eligible = result.blockingReasons.length === 0;
  if (!result.eligible) result.matchedCapability = null;
  return result;
}

export function getTechnicianServiceMunicipalityCodes(technician) {
  return uniqueServiceMunicipalityCodes(technician?.dispatchProfile);
}

/**
 * Pure eligibility evaluator for dispatch assignment.
 * Does not query the database.
 *
 * @param {Object} params
 * @param {Object} params.technician - Populated technician user object
 * @param {String} params.requestType - e.g., "AI", "HEALTH", "PREGNANCY_DIAGNOSIS", "CALVING"
 * @param {Object} params.dispatchLocation - The resolved dispatch location snapshot object
 * @param {String} params.dispatchStage - "local", "adjacent", "regional"
 * @returns {Object} Eligibility result
 */
export function evaluateTechnicianDispatchEligibility({
  technician,
  requestType,
  dispatchLocation,
  dispatchStage = DISPATCH_STAGES.LOCAL,
}) {
  const result = evaluateTechnicianDispatchReadiness({
    technician,
    requestType,
  });
  const profile = technician?.dispatchProfile;

  if (!dispatchLocation?.municipalityCode) {
    result.blockingReasons.push("MUNICIPALITY_UNRESOLVED");
  } else {
    const requestMunicipalityCode = normalizeMunicipalityCode(
      dispatchLocation.municipalityCode,
    );
    const isLocallyCovered = getTechnicianServiceMunicipalityCodes(
      technician,
    ).includes(requestMunicipalityCode);

    if (dispatchStage === DISPATCH_STAGES.LOCAL) {
      if (!isLocallyCovered) {
        result.blockingReasons.push("MUNICIPALITY_NOT_COVERED");
      } else {
        result.matchedMunicipalityCode = requestMunicipalityCode;
        result.informationalReasons.push("ELIGIBLE_LOCAL");
      }
    } else if (profile) {
      result.matchedMunicipalityCode = requestMunicipalityCode;
      result.informationalReasons.push("ELIGIBLE_OVERFLOW");
    }
  }

  if (result.blockingReasons.length === 0) {
    result.eligible = true;
  } else {
    result.eligible = false;
    result.matchedCapability = null;
    result.matchedMunicipalityCode = null;
  }

  return result;
}
