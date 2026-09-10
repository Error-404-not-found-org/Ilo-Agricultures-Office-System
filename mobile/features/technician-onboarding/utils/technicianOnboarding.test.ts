import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { URL as NodeURL } from "node:url";

import {
  completeOnboarding,
  enableRequestAcceptance,
  isTechnicianAcceptingRequests,
  shouldShowProfileWarning,
  shouldShowTechnicianOnboarding,
} from "./technicianOnboarding.ts";

describe("Technician onboarding rules", () => {
  it("keeps the primary action full-width with explicit theme contrast", () => {
    const source = readFileSync(
      new NodeURL("../components/TechnicianOnboardingGate.tsx", import.meta.url),
      "utf8",
    );
    assert.match(source, /width: "100%"/);
    assert.match(source, /color: colors\.onPrimary/);
  });

  it("shows only for a claimed Technician without a completion timestamp", () => {
    assert.equal(shouldShowTechnicianOnboarding({ role: "technician", profileClaimStatus: "claimed", technicianOnboardingCompletedAt: null }), true);
    assert.equal(shouldShowTechnicianOnboarding({ role: "technician", profileClaimStatus: "claimed", technicianOnboardingCompletedAt: "2026-09-10T00:00:00.000Z" }), false);
    assert.equal(shouldShowTechnicianOnboarding({ role: "technician", profileClaimStatus: "unclaimed", technicianOnboardingCompletedAt: null }), false);
    assert.equal(shouldShowTechnicianOnboarding({ role: "farmer", profileClaimStatus: "claimed", technicianOnboardingCompletedAt: null }), false);
    assert.equal(shouldShowTechnicianOnboarding({ role: "admin", profileClaimStatus: "claimed", technicianOnboardingCompletedAt: null }), false);
  });

  it("enables requests through the canonical endpoint and refreshes user state", async () => {
    const calls: unknown[] = [];
    const api = { patch: async (...args: unknown[]) => calls.push(args) };
    const queryClient = { invalidateQueries: async (args: unknown) => calls.push(args) };

    await enableRequestAcceptance(api as never, queryClient as never);

    assert.deepEqual(calls, [
      ["/technician/dispatch-status", { acceptsNewRequests: true }],
      { queryKey: ["user", "me"] },
    ]);
  });

  it("reflects an initially Off Duty Technician as not accepting requests", () => {
    assert.equal(
      isTechnicianAcceptingRequests({
        dispatchProfile: {
          availabilityStatus: "off_duty",
          acceptsNewRequests: false,
        },
      }),
      false,
    );
  });

  it("does not report success or refresh user state when availability fails", async () => {
    let invalidated = false;
    const api = { patch: async () => { throw new Error("offline"); } };
    const queryClient = { invalidateQueries: async () => { invalidated = true; } };

    await assert.rejects(() =>
      enableRequestAcceptance(api as never, queryClient as never),
    );
    assert.equal(invalidated, false);
  });

  it("completes through the self endpoint and refreshes user state", async () => {
    const calls: unknown[] = [];
    const api = { patch: async (...args: unknown[]) => calls.push(args) };
    const queryClient = { invalidateQueries: async (args: unknown) => calls.push(args) };

    await completeOnboarding(api as never, queryClient as never);

    assert.deepEqual(calls, [
      ["/technician/onboarding", {}],
      { queryKey: ["user", "me"] },
    ]);
  });

  it("does not dismiss onboarding when final persistence fails", async () => {
    let persisted = false;
    let invalidated = false;
    const api = { patch: async () => { throw new Error("server unavailable"); } };
    const queryClient = { invalidateQueries: async () => { invalidated = true; } };

    await assert.rejects(() =>
      completeOnboarding(
        api as never,
        queryClient as never,
        () => { persisted = true; },
      ),
    );
    assert.equal(persisted, false);
    assert.equal(invalidated, false);
  });

  it("suppresses the profile warning during onboarding and its clean landing", () => {
    const incompleteUser = { phoneNumber: "", address: {} };
    assert.equal(shouldShowProfileWarning(incompleteUser, { onboardingVisible: true, suppressAfterCompletion: false }), false);
    assert.equal(shouldShowProfileWarning(incompleteUser, { onboardingVisible: false, suppressAfterCompletion: true }), false);
    assert.equal(shouldShowProfileWarning(incompleteUser, { onboardingVisible: false, suppressAfterCompletion: false }), true);
  });
});
