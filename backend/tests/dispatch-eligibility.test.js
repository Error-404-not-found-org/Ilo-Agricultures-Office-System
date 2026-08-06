import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateTechnicianDispatchEligibility } from "../src/domain/geographic/eligibilityEvaluator.js";

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
});
