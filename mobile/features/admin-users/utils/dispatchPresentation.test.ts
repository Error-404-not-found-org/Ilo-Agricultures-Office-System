import assert from "node:assert/strict";
import test from "node:test";

import {
  getAccountStatePresentation,
  getAvailabilityLabel,
  getCapabilityLabels,
  getDispatchReadinessPresentation,
  getFieldAreaLabel,
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

test("presents an unclaimed invitation without calling it suspended", () => {
  assert.deepEqual(
    getAccountStatePresentation({
      ...readyTechnician,
      isVerified: false,
      profileClaimStatus: "unclaimed",
    }),
    { label: "Invitation pending", tone: "warning" },
  );
});
