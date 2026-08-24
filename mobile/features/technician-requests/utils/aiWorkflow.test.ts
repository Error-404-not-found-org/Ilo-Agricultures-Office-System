// @ts-nocheck
import { getClaimScheduleErrorMessage } from "./aiWorkflow";

describe("getClaimScheduleErrorMessage", () => {
  it("preserves exact existing backend error codes for UI mapping", () => {
    // Standard unclaimable
    expect(
      getClaimScheduleErrorMessage({
        response: { data: { code: "REQUEST_NOT_CLAIMABLE" } },
      }),
    ).toBe("This request can no longer be scheduled.");

    // Already claimed
    expect(
      getClaimScheduleErrorMessage({
        response: { data: { code: "REQUEST_ALREADY_CLAIMED" } },
      }),
    ).toBe("This request was already claimed by another technician.");
    expect(getClaimScheduleErrorMessage({ response: { status: 409 } })).toBe(
      "This request was already claimed by another technician.",
    );

    // Specific Dispatch Mappings
    expect(
      getClaimScheduleErrorMessage({
        response: { data: { code: "NOT_ACCEPTING_REQUESTS" } },
      }),
    ).toBe("Turn on Receive Requests before claiming new work.");

    expect(
      getClaimScheduleErrorMessage({
        response: { data: { code: "TECHNICIAN_NOT_AVAILABLE" } },
      }),
    ).toBe("You are not currently available for new requests.");

    expect(
      getClaimScheduleErrorMessage({
        response: { data: { code: "OUTSIDE_SERVICE_AREA" } },
      }),
    ).toBe("This request is outside your assigned Field Area.");

    expect(
      getClaimScheduleErrorMessage({
        response: { data: { code: "SERVICE_CAPABILITY_REQUIRED" } },
      }),
    ).toBe("You are not assigned to handle this type of request.");

    expect(
      getClaimScheduleErrorMessage({
        response: { data: { code: "TECHNICIAN_NOT_OPERATIONAL" } },
      }),
    ).toBe(
      "Your Technician account is not currently available for new requests.",
    );

    expect(
      getClaimScheduleErrorMessage({
        response: { data: { code: "REQUEST_SERVICE_AREA_UNRESOLVED" } },
      }),
    ).toBe("This request does not have a valid service municipality yet.");

    // Generic 403 authorization message
    expect(getClaimScheduleErrorMessage({ response: { status: 403 } })).toBe(
      "You are not authorized to schedule this request.",
    );

    expect(getClaimScheduleErrorMessage({ response: { status: 401 } })).toBe(
      "You are not authorized to schedule this request.",
    );
  });
});
