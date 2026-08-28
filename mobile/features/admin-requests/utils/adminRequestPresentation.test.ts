import assert from "node:assert/strict";
import test from "node:test";

import {
  getAdminRequestLocation,
  getAdminRequestStatusLabel,
  getFriendlyReassignmentError,
  getReassignmentCandidatePresentation,
  isMeaningfullyUrgent,
} from "./adminRequestPresentation.ts";

const readyTechnician = {
  _id: "tech-1",
  name: "Ana Santos",
  role: "technician",
  status: "active",
  isVerified: true,
  profileClaimStatus: "claimed",
  dispatchProfile: {
    serviceMunicipalities: [
      {
        municipalityCode: "063034000",
        municipalityName: "Oton",
        provinceName: "Iloilo",
      },
    ],
    serviceCapabilities: ["AI", "HEALTH"],
    availabilityStatus: "available",
    acceptsNewRequests: true,
  },
};

test("translates monitoring statuses and only elevates meaningful urgency", () => {
  assert.equal(getAdminRequestStatusLabel("in_progress"), "In progress");
  assert.equal(getAdminRequestStatusLabel("resolved"), "Completed");
  assert.equal(isMeaningfullyUrgent("medium"), false);
  assert.equal(isMeaningfullyUrgent("emergency"), true);
});

test("prefers the canonical request dispatch location", () => {
  assert.equal(
    getAdminRequestLocation({
      dispatch: {
        location: {
          barangayName: "Poblacion West",
          municipalityName: "Oton",
          provinceName: "Iloilo",
        },
      },
      farmerId: { address: { barangay: "Legacy Barangay" } },
    }),
    "Poblacion West, Oton, Iloilo",
  );
});

test("includes only eligible request reassignment candidates", () => {
  const candidate = getReassignmentCandidatePresentation({
    technician: readyTechnician,
    requestType: "HEALTH",
    requestMunicipalityCode: "063034000",
  });
  assert.equal(candidate.eligible, true);
  assert.equal(candidate.fieldArea, "Oton, Iloilo");
});

test("explains capability and Receive Requests blockers", () => {
  const candidate = getReassignmentCandidatePresentation({
    technician: {
      ...readyTechnician,
      dispatchProfile: {
        ...readyTechnician.dispatchProfile,
        serviceCapabilities: ["AI"],
        acceptsNewRequests: false,
      },
    },
    requestType: "HEALTH",
    requestMunicipalityCode: "063034000",
  });
  assert.equal(candidate.eligible, false);
  assert.match(candidate.blockerLabel || "", /receiving new requests/i);
});

test("translates reassignment codes without exposing backend terminology", () => {
  assert.equal(
    getFriendlyReassignmentError({
      response: { data: { code: "SERVICE_CAPABILITY_REQUIRED" } },
    }),
    "Technician does not have the required service capability.",
  );
});
