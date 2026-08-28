import { AppError } from "../utils/app-error.js";
import {
  evaluateTechnicianDispatchEligibility,
  evaluateTechnicianDispatchReadiness,
  getTechnicianServiceMunicipalityCodes,
} from "../domain/geographic/eligibilityEvaluator.js";

const NEVER_MATCH_FILTER = Object.freeze({ _id: { $exists: false } });

const CLAIM_ERROR_BY_REASON = Object.freeze({
  NO_TECHNICIAN_PROVIDED: {
    code: "TECHNICIAN_NOT_OPERATIONAL",
    message: "The Technician account could not be verified for dispatch.",
  },
  ACCOUNT_DELETED: {
    code: "TECHNICIAN_NOT_OPERATIONAL",
    message: "This Technician account is not operational.",
  },
  ACCOUNT_NOT_VERIFIED: {
    code: "TECHNICIAN_NOT_OPERATIONAL",
    message: "This Technician account is not verified for dispatch.",
  },
  ACCOUNT_NOT_CLAIMED: {
    code: "TECHNICIAN_NOT_OPERATIONAL",
    message: "This Technician invitation has not been claimed.",
  },
  ACCOUNT_SUSPENDED: {
    code: "TECHNICIAN_NOT_OPERATIONAL",
    message: "This Technician account is suspended.",
  },
  ACCOUNT_ON_LEAVE: {
    code: "TECHNICIAN_NOT_AVAILABLE",
    message: "This Technician is currently on leave.",
  },
  ACCOUNT_STATUS_INELIGIBLE: {
    code: "TECHNICIAN_NOT_OPERATIONAL",
    message: "This Technician account is not operational.",
  },
  ROLE_NOT_ELIGIBLE: {
    code: "TECHNICIAN_NOT_OPERATIONAL",
    message: "Only Technician accounts can receive field requests.",
  },
  NO_DISPATCH_PROFILE: {
    code: "TECHNICIAN_NOT_OPERATIONAL",
    message: "This Technician does not have a dispatch profile.",
  },
  NOT_ACCEPTING_REQUESTS: {
    code: "NOT_ACCEPTING_REQUESTS",
    message: "Turn on Receive Requests before claiming new work.",
  },
  OFF_DUTY: {
    code: "TECHNICIAN_NOT_AVAILABLE",
    message: "You must be available before claiming new work.",
  },
  BUSY: {
    code: "TECHNICIAN_NOT_AVAILABLE",
    message: "You are currently busy and cannot claim new work.",
  },
  AVAILABILITY_UNKNOWN: {
    code: "TECHNICIAN_NOT_AVAILABLE",
    message: "Your availability is not ready for new requests.",
  },
  CAPABILITY_MISMATCH: {
    code: "SERVICE_CAPABILITY_REQUIRED",
    message: "Your dispatch profile does not include this service capability.",
  },
  NO_SERVICE_CAPABILITIES: {
    code: "SERVICE_CAPABILITY_REQUIRED",
    message: "No service capabilities are assigned to your dispatch profile.",
  },
  NO_SERVICE_AREA: {
    code: "OUTSIDE_SERVICE_AREA",
    message: "No Field Area is assigned to your dispatch profile.",
  },
  MUNICIPALITY_NOT_COVERED: {
    code: "OUTSIDE_SERVICE_AREA",
    message: "This request is outside your assigned Field Area.",
  },
  MUNICIPALITY_UNRESOLVED: {
    code: "REQUEST_SERVICE_AREA_UNRESOLVED",
    message: "This request does not have a verified municipality for dispatch.",
  },
});

export function buildNewRequestDispatchFilter({ technician, requestType }) {
  const readiness = evaluateTechnicianDispatchReadiness({
    technician,
    requestType,
  });
  if (!readiness.eligible) {
    return { filter: NEVER_MATCH_FILTER, readiness };
  }

  return {
    filter: {
      "dispatch.location.municipalityCode": {
        $in: getTechnicianServiceMunicipalityCodes(technician),
      },
    },
    readiness,
  };
}

export function assertTechnicianEligibleForNewRequest({
  technician,
  requestType,
  dispatch,
}) {
  const eligibility = evaluateTechnicianDispatchEligibility({
    technician,
    requestType,
    dispatchLocation: dispatch?.location,
    dispatchStage: dispatch?.stage || "local",
  });
  if (eligibility.eligible) return eligibility;

  const reason = eligibility.blockingReasons.find(
    (candidate) => CLAIM_ERROR_BY_REASON[candidate],
  );
  const mapped = CLAIM_ERROR_BY_REASON[reason] || {
    code: "TECHNICIAN_NOT_OPERATIONAL",
    message: "Your Technician account is not ready to receive new requests.",
  };
  throw new AppError(mapped.message, {
    status: 403,
    code: mapped.code,
    details: { blockingReasons: eligibility.blockingReasons },
  });
}
