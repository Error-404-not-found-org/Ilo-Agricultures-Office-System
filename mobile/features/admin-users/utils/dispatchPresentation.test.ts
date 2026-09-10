import assert from "node:assert/strict";
import test from "node:test";

import {
  getAccountStatePresentation,
  getAvailabilityLabel,
  getCapabilityLabels,
  getDispatchReadinessPresentation,
  getFieldAreaLabel,
  getProfileClaimStatePresentation,
  getReceiveRequestsPresentation,
} from "./dispatchPresentation.ts";

const readyTechnician = {
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

test("presents a fully configured Technician as ready", () => {
  assert.deepEqual(getDispatchReadinessPresentation(readyTechnician), {
    eligible: true,
    title: "Ready for new requests",
    tone: "success",
    blockingReasons: [],
    blockers: [],
  });
});

test("separates setup blockers from Receive Requests ownership", () => {
  const result = getDispatchReadinessPresentation({
    ...readyTechnician,
    dispatchProfile: {
      serviceMunicipalities: [],
      serviceCapabilities: [],
      availabilityStatus: "available",
      acceptsNewRequests: false,
    },
  });

  assert.equal(result.title, "Setup incomplete");
  assert.match(result.blockers.join(" "), /No Field Area assigned/);
  assert.match(result.blockers.join(" "), /No service capabilities assigned/);
  assert.match(result.blockers.join(" "), /Receive Requests/);
});

test("uses canonical friendly Field Area and capability labels", () => {
  assert.equal(getFieldAreaLabel(readyTechnician.dispatchProfile), "Oton, Iloilo");
  assert.deepEqual(getCapabilityLabels(readyTechnician.dispatchProfile), [
    "Artificial Insemination",
    "Health Requests",
  ]);
});

test("keeps account, availability, and Receive Requests as distinct concepts", () => {
  assert.deepEqual(getAccountStatePresentation(readyTechnician), {
    label: "Active",
    tone: "success",
  });
  assert.equal(getAvailabilityLabel(readyTechnician.dispatchProfile), "Available");
  assert.deepEqual(getReceiveRequestsPresentation(readyTechnician.dispatchProfile), {
    label: "Receiving new requests",
    enabled: true,
  });
});

test("presents claim state independently from account state", () => {
  assert.deepEqual(
    getAccountStatePresentation({
      ...readyTechnician,
      isVerified: false,
      profileClaimStatus: "unclaimed",
    }),
    { label: "Verification pending", tone: "warning" },
  );

  assert.deepEqual(getProfileClaimStatePresentation(readyTechnician), {
    label: "Profile Claimed",
    tone: "success",
  });
  assert.deepEqual(
    getProfileClaimStatePresentation({
      ...readyTechnician,
      profileClaimStatus: "unclaimed",
    }),
    { label: "Not Claimed", tone: "warning" },
  );
  assert.deepEqual(
    getProfileClaimStatePresentation({
      ...readyTechnician,
      profileClaimStatus: "blocked",
    }),
    { label: "Claim Blocked", tone: "danger" },
  );
});

test("uses a real Clerk link only as a legacy claim compatibility fallback", () => {
  assert.deepEqual(
    getProfileClaimStatePresentation({
      ...readyTechnician,
      profileClaimStatus: "none",
      clerkId: "user_123",
    }),
    { label: "Profile Claimed", tone: "success" },
  );
  assert.deepEqual(
    getProfileClaimStatePresentation({
      ...readyTechnician,
      profileClaimStatus: "none",
      clerkId: "manual_profile_123",
    }),
    { label: "Not Claimed", tone: "warning" },
  );
});
