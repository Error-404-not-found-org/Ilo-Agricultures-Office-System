import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateTechnicianDispatchEligibility,
  evaluateTechnicianDispatchReadiness,
} from "../src/domain/geographic/eligibilityEvaluator.js";
import {
  assertTechnicianEligibleForNewRequest,
  buildNewRequestDispatchFilter,
} from "../src/services/dispatch-eligibility.service.js";

const readyTechnician = (overrides = {}) => ({
  _id: "technician-1",
  role: "technician",
  status: "active",
  deletedAt: null,
  isVerified: true,
  profileClaimStatus: "claimed",
  dispatchProfile: {
    availabilityStatus: "available",
    acceptsNewRequests: true,
    serviceCapabilities: ["AI", "HEALTH"],
    serviceMunicipalities: [{ municipalityCode: "063034000" }],
  },
  ...overrides,
});

describe("evaluateTechnicianDispatchEligibility", () => {
  it("blocks if profile is missing", () => {
    const tech = { deletedAt: null, isVerified: true };
    const req = { type: "AI", dispatch: { municipalityCode: "063022000" } };
    
    const res = evaluateTechnicianDispatchEligibility({
      technician: tech,
      requestType: req.type,
      dispatchLocation: req.dispatch
    });
    assert.equal(res.eligible, false);
    assert.ok(res.blockingReasons.includes("NO_DISPATCH_PROFILE"));
  });

  it("blocks if technician is off_duty", () => {
    const tech = { status: "active", deletedAt: null, isVerified: true, dispatchProfile: { availabilityStatus: "off_duty", acceptsNewRequests: true }, role: "technician" };
    const req = { type: "AI", dispatch: { municipalityCode: "063022000" } };
    
    const res = evaluateTechnicianDispatchEligibility({
      technician: tech,
      requestType: req.type,
      dispatchLocation: req.dispatch
    });
    assert.equal(res.eligible, false);
    assert.ok(res.blockingReasons.includes("OFF_DUTY"));
  });

  it("blocks if not accepting new requests", () => {
    const tech = { status: "active", deletedAt: null, isVerified: true, dispatchProfile: { availabilityStatus: "available", acceptsNewRequests: false }, role: "technician" };
    const req = { type: "AI", dispatch: { municipalityCode: "063022000" } };
    
    const res = evaluateTechnicianDispatchEligibility({
      technician: tech,
      requestType: req.type,
      dispatchLocation: req.dispatch
    });
    assert.equal(res.eligible, false);
    assert.ok(res.blockingReasons.includes("NOT_ACCEPTING_REQUESTS"));
  });

  it("blocks if missing capability", () => {
    const tech = {
      status: "active",
      deletedAt: null, isVerified: true,
      role: "technician",
      dispatchProfile: {
        availabilityStatus: "available",
        acceptsNewRequests: true,
        serviceCapabilities: ["HEALTH"],
        serviceMunicipalities: [{ municipalityCode: "063022000" }]
      }
    };
    const req = { type: "AI", dispatch: { municipalityCode: "063022000" } };
    
    const res = evaluateTechnicianDispatchEligibility({
      technician: tech,
      requestType: req.type,
      dispatchLocation: req.dispatch
    });
    assert.equal(res.eligible, false);
    assert.ok(res.blockingReasons.includes("CAPABILITY_MISMATCH"));
  });

  it("blocks if geographic mismatch", () => {
    const tech = {
      status: "active",
      deletedAt: null, isVerified: true,
      role: "technician",
      dispatchProfile: {
        availabilityStatus: "available",
        acceptsNewRequests: true,
        serviceCapabilities: ["AI"],
        serviceMunicipalities: [{ municipalityCode: "063034000" }]
      }
    };
    const req = { type: "AI", dispatch: { municipalityCode: "063022000" } };
    
    const res = evaluateTechnicianDispatchEligibility({
      technician: tech,
      requestType: req.type,
      dispatchLocation: req.dispatch
    });
    assert.equal(res.eligible, false);
    assert.ok(res.blockingReasons.includes("MUNICIPALITY_NOT_COVERED"));
  });

  it("succeeds with strict match", () => {
    const tech = {
      status: "active",
      deletedAt: null, isVerified: true,
      role: "technician",
      dispatchProfile: {
        availabilityStatus: "available",
        acceptsNewRequests: true,
        serviceCapabilities: ["AI"],
        serviceMunicipalities: [{ municipalityCode: "063022000" }]
      }
    };
    const req = { type: "AI", dispatch: { municipalityCode: "063022000" } };
    
    const res = evaluateTechnicianDispatchEligibility({
      technician: tech,
      requestType: req.type,
      dispatchLocation: req.dispatch
    });
    assert.equal(res.blockingReasons.length, 0);
    assert.equal(res.eligible, true);
  });

  it("derives readiness without persisting another status", () => {
    const ready = evaluateTechnicianDispatchReadiness({
      technician: readyTechnician(),
      requestType: "AI",
    });
    assert.equal(ready.eligible, true);

    const noArea = evaluateTechnicianDispatchReadiness({
      technician: readyTechnician({
        dispatchProfile: {
          availabilityStatus: "available",
          acceptsNewRequests: true,
          serviceCapabilities: ["AI"],
          serviceMunicipalities: [],
        },
      }),
      requestType: "AI",
    });
    assert.equal(noArea.eligible, false);
    assert.ok(noArea.blockingReasons.includes("NO_SERVICE_AREA"));
  });

  it("blocks explicitly unclaimed invitations while preserving verified legacy profiles", () => {
    const unclaimed = evaluateTechnicianDispatchReadiness({
      technician: readyTechnician({ profileClaimStatus: "unclaimed" }),
      requestType: "AI",
    });
    assert.ok(unclaimed.blockingReasons.includes("ACCOUNT_NOT_CLAIMED"));

    const legacy = evaluateTechnicianDispatchReadiness({
      technician: readyTechnician({ profileClaimStatus: "none" }),
      requestType: "AI",
    });
    assert.equal(legacy.eligible, true);
  });

  it("builds the same municipality filter used by Open Requests", () => {
    const result = buildNewRequestDispatchFilter({
      technician: readyTechnician(),
      requestType: "AI",
    });
    assert.equal(result.readiness.eligible, true);
    assert.deepEqual(result.filter, {
      "dispatch.location.municipalityCode": {
        $in: ["063034000", "0603034000"],
      },
    });

    const off = buildNewRequestDispatchFilter({
      technician: readyTechnician({
        dispatchProfile: {
          ...readyTechnician().dispatchProfile,
          acceptsNewRequests: false,
          availabilityStatus: "off_duty",
        },
      }),
      requestType: "AI",
    });
    assert.deepEqual(off.filter, { _id: { $exists: false } });
  });

  it("returns stable claim error codes for area and capability failures", () => {
    assert.throws(
      () =>
        assertTechnicianEligibleForNewRequest({
          technician: readyTechnician(),
          requestType: "AI",
          dispatch: {
            stage: "local",
            location: { municipalityCode: "063022000" },
          },
        }),
      (error) => error.code === "OUTSIDE_SERVICE_AREA" && error.status === 403,
    );
    assert.throws(
      () =>
        assertTechnicianEligibleForNewRequest({
          technician: readyTechnician({
            dispatchProfile: {
              ...readyTechnician().dispatchProfile,
              serviceCapabilities: ["HEALTH"],
            },
          }),
          requestType: "AI",
          dispatch: {
            stage: "local",
            location: { municipalityCode: "063034000" },
          },
        }),
      (error) =>
        error.code === "SERVICE_CAPABILITY_REQUIRED" && error.status === 403,
    );
  });
});

test("canonical and legacy Oton identifiers match the same service area", () => {
  const canonical = evaluateTechnicianDispatchEligibility({
    technician: readyTechnician({
      dispatchProfile: {
        ...readyTechnician().dispatchProfile,
        serviceMunicipalities: [{ municipalityCode: "0603034000" }],
      },
    }),
    requestType: "AI",
    dispatchLocation: { municipalityCode: "0603034000" },
  });
  const legacy = evaluateTechnicianDispatchEligibility({
    technician: readyTechnician(),
    requestType: "HEALTH",
    dispatchLocation: { municipalityCode: "0603034000" },
  });

  assert.equal(canonical.eligible, true);
  assert.equal(canonical.matchedMunicipalityCode, "0603034000");
  assert.equal(legacy.eligible, true);
  assert.equal(legacy.matchedMunicipalityCode, "0603034000");
});
