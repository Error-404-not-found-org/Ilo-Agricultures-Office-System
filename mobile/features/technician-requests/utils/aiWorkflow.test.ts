import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getClaimScheduleErrorMessage } from "./aiWorkflow.ts";

describe("getClaimScheduleErrorMessage", () => {
  it("preserves exact existing backend error codes for UI mapping", () => {
    // Standard unclaimable
    assert.equal(
      getClaimScheduleErrorMessage({
        response: { data: { code: "REQUEST_NOT_CLAIMABLE" } },
      }),
      "This request can no longer be scheduled.",
    );

    // Already claimed
    assert.equal(
      getClaimScheduleErrorMessage({
        response: { data: { code: "REQUEST_ALREADY_CLAIMED" } },
      }),
      "This request was already claimed by another technician.",
    );
    assert.equal(getClaimScheduleErrorMessage({ response: { status: 409 } }),
      "This request was already claimed by another technician.",
    );

    // Specific Dispatch Mappings
    assert.equal(
      getClaimScheduleErrorMessage({
        response: { data: { code: "NOT_ACCEPTING_REQUESTS" } },
      }),
      "Turn on Receive Requests before claiming new work.",
    );

    assert.equal(
      getClaimScheduleErrorMessage({
        response: { data: { code: "TECHNICIAN_NOT_AVAILABLE" } },
      }),
      "You are not currently available for new requests.",
    );

    assert.equal(
      getClaimScheduleErrorMessage({
        response: { data: { code: "OUTSIDE_SERVICE_AREA" } },
      }),
      "This request is outside your assigned Field Area.",
    );

    assert.equal(
      getClaimScheduleErrorMessage({
        response: { data: { code: "SERVICE_CAPABILITY_REQUIRED" } },
      }),
      "You are not assigned to handle this type of request.",
    );

    assert.equal(
      getClaimScheduleErrorMessage({
        response: { data: { code: "TECHNICIAN_NOT_OPERATIONAL" } },
      }),
      "Your Technician account is not currently available for new requests.",
    );

    assert.equal(
      getClaimScheduleErrorMessage({
        response: { data: { code: "REQUEST_SERVICE_AREA_UNRESOLVED" } },
      }),
      "This request does not have a valid service municipality yet.",
    );

    // Generic 403 authorization message
    assert.equal(getClaimScheduleErrorMessage({ response: { status: 403 } }),
      "You are not authorized to schedule this request.",
    );

    assert.equal(getClaimScheduleErrorMessage({ response: { status: 401 } }),
      "You are not authorized to schedule this request.",
    );
  });
});
