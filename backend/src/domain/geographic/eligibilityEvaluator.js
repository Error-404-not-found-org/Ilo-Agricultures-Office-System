import { DISPATCH_STAGES } from "./constants.js";

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
  const result = {
    eligible: false,
    blockingReasons: [],
    informationalReasons: [],
    matchedMunicipalityCode: null,
    matchedCapability: null,
  };

  if (!technician) {
    result.blockingReasons.push("NO_TECHNICIAN_PROVIDED");
    return result;
  }

  // 1. Account Level Checks
  if (technician.deletedAt !== null) {
    result.blockingReasons.push("ACCOUNT_DELETED");
  }
  if (!technician.isVerified) {
    result.blockingReasons.push("ACCOUNT_NOT_VERIFIED");
  }
  if (technician.status === "suspended") {
    result.blockingReasons.push("ACCOUNT_SUSPENDED");
  }
  
  const allowedRoles = requestType === "HEALTH" ? ["technician", "veterinarian"] : ["technician"];
  if (!allowedRoles.includes(technician.role)) {
    result.blockingReasons.push("ROLE_NOT_ELIGIBLE");
  }

  // 2. Dispatch Profile Checks
  const profile = technician.dispatchProfile;
  if (!profile) {
    result.blockingReasons.push("NO_DISPATCH_PROFILE");
  } else {
    if (!profile.acceptsNewRequests) {
      result.blockingReasons.push("NOT_ACCEPTING_REQUESTS");
    }
    if (profile.availabilityStatus === "off_duty") {
      result.blockingReasons.push("OFF_DUTY");
    } else if (profile.availabilityStatus === "busy") {
      result.blockingReasons.push("BUSY");
    }

    // Capability Match
    if (!profile.serviceCapabilities || !profile.serviceCapabilities.includes(requestType)) {
      result.blockingReasons.push("CAPABILITY_MISMATCH");
    } else {
      result.matchedCapability = requestType;
    }

    // Municipality Match
    if (!dispatchLocation || !dispatchLocation.municipalityCode) {
      result.blockingReasons.push("MUNICIPALITY_UNRESOLVED");
    } else {
      const isLocallyCovered = profile.serviceMunicipalities?.some(
        m => m.municipalityCode === dispatchLocation.municipalityCode
      );

      if (dispatchStage === DISPATCH_STAGES.LOCAL) {
        if (!isLocallyCovered) {
          result.blockingReasons.push("MUNICIPALITY_NOT_COVERED");
        } else {
          result.matchedMunicipalityCode = dispatchLocation.municipalityCode;
          result.informationalReasons.push("ELIGIBLE_LOCAL");
        }
      } else {
        // For adjacent/regional overflow stages
        // (Detailed adjacent logic to be expanded in Batch 5)
        result.matchedMunicipalityCode = dispatchLocation.municipalityCode;
        result.informationalReasons.push("ELIGIBLE_OVERFLOW");
      }
    }
  }

  if (result.blockingReasons.length === 0) {
    result.eligible = true;
  } else {
    // If blocked, clear matched info
    result.matchedCapability = null;
    result.matchedMunicipalityCode = null;
  }

  return result;
}
