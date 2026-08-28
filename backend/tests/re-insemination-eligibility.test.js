import test from "node:test";
import assert from "node:assert";
import { isVerifiedReturnToHeatAIAttempt } from "../src/services/ai-request-creation.service.js";
import { getReproductionEligibility } from "../src/domain/reproduction-lifecycle.js";

test("Re-insemination Eligibility (Request Another AI)", async (t) => {
  await t.test(
    "1. Technician-confirmed Return to Heat with farmerOutcomeReport=null -> Request Another AI allowed",
    () => {
      const request = {
        status: "done",
        isSuccess: false,
        outcome: "Failed (Re-heat)",
        failureReason: "return_to_heat",
        outcomeVerificationStatus: "verified",
        farmerOutcomeReport: null,
      };
      assert.strictEqual(isVerifiedReturnToHeatAIAttempt(request), true);
    }
  );

  await t.test(
    "2. Technician-confirmed Return to Heat after farmer previously reported possible_pregnancy -> Request Another AI allowed",
    () => {
      const request = {
        status: "done",
        isSuccess: false,
        outcome: "Failed (Re-heat)",
        failureReason: "return_to_heat",
        outcomeVerificationStatus: "verified",
        farmerOutcomeReport: "possible_pregnancy",
      };
      assert.strictEqual(isVerifiedReturnToHeatAIAttempt(request), true);
    }
  );

  await t.test(
    "3. Farmer reports return_to_heat but technician has not confirmed it -> blocked",
    () => {
      const request = {
        status: "done",
        isSuccess: false,
        outcome: "Failed (Re-heat)", // Even if somehow set
        failureReason: "return_to_heat",
        outcomeVerificationStatus: "pending",
        farmerOutcomeReport: "return_to_heat",
      };
      assert.strictEqual(isVerifiedReturnToHeatAIAttempt(request), false);
    }
  );

  await t.test(
    "4. Animal is In Heat but previous AI is unresolved -> blocked",
    () => {
      const request = {
        status: "done",
        isSuccess: null,
        outcome: "Pending",
        outcomeVerificationStatus: "pending",
      };
      assert.strictEqual(isVerifiedReturnToHeatAIAttempt(request), false);
    }
  );

  await t.test(
    "5. Failed Negative PD -> must NOT be mistaken for Failed (Re-heat)",
    () => {
      const request = {
        status: "done",
        isSuccess: false,
        outcome: "Failed (Negative PD)",
        failureReason: "negative_pd",
        outcomeVerificationStatus: "verified",
        farmerOutcomeReport: "not_pregnant",
      };
      assert.strictEqual(isVerifiedReturnToHeatAIAttempt(request), false);
    }
  );

  await t.test(
    "6. Existing active Attempt #2 -> Attempt #1 cannot be reused to create another attempt (Eligibility check)",
    () => {
      const eligibility = getReproductionEligibility({
        animal: {},
        activeRequest: { _id: "attempt-2-active" }
      });
      assert.strictEqual(eligibility.eligible, false);
      assert.strictEqual(eligibility.code, "ACTIVE_REPRODUCTIVE_WORKFLOW");
    }
  );
});
