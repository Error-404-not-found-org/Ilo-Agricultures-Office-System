import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHealthAdvicePayload,
  formatHealthFollowUpDateKey,
  formatHealthFollowUpDateLabel,
  isHealthAdviceEligible,
  parseHealthFollowUpDateKey,
  validateHealthAdviceDraft,
} from "./healthAdviceWorkflow.ts";
import { sendTechnicianHealthAdvice } from "../../technician/services/technician.service.ts";

test("Advice eligibility covers pending and owned unscheduled requests", () => {
  assert.equal(isHealthAdviceEligible({ status: "pending" }), true);
  assert.equal(
    isHealthAdviceEligible({ status: "approved", handledBy: "technician-1" }),
    true,
  );
  assert.equal(isHealthAdviceEligible({ status: "approved" }), false);
  assert.equal(
    isHealthAdviceEligible({
      status: "scheduled",
      scheduledDate: "2026-09-01",
    }),
    false,
  );
  assert.equal(
    isHealthAdviceEligible({ status: "pending", handlingMethod: "farm_visit" }),
    false,
  );
  assert.equal(
    isHealthAdviceEligible({
      status: "pending",
      handlingMethod: "office_pickup",
    }),
    false,
  );
  assert.equal(isHealthAdviceEligible({ status: "resolved" }), false);
});

test("Advice validation blocks blank and oversized farmer advice", () => {
  assert.match(
    validateHealthAdviceDraft({
      adviceForFarmer: "   ",
      followUpDate: "",
      internalNote: "",
    }) || "",
    /required/i,
  );
  assert.match(
    validateHealthAdviceDraft({
      adviceForFarmer: "a".repeat(2001),
      followUpDate: "",
      internalNote: "",
    }) || "",
    /2,000/i,
  );
});

test("Advice payload is trimmed and contains no lifecycle or ownership fields", () => {
  const payload = buildHealthAdvicePayload({
    adviceForFarmer: "  Keep the animal hydrated.  ",
    followUpDate: " 2026-09-30 ",
    internalNote: "  Internal assessment only.  ",
  });

  assert.deepEqual(payload, {
    advice: "Keep the animal hydrated.",
    technicianNote: "Internal assessment only.",
    followUpDate: "2026-09-30",
  });
  assert.equal("status" in payload, false);
  assert.equal("handlingMethod" in payload, false);
  assert.equal("handledBy" in payload, false);
  assert.equal("assignedTechnicianId" in payload, false);
  assert.equal("latitude" in payload, false);
  assert.equal("longitude" in payload, false);
  assert.equal("location" in payload, false);
});

test("optional Advice fields are omitted when blank", () => {
  assert.deepEqual(
    buildHealthAdvicePayload({
      adviceForFarmer: " Monitor appetite. ",
      followUpDate: "",
      internalNote: " ",
    }),
    { advice: "Monitor appetite." },
  );
});

test("follow-up dates round-trip as local calendar dates with readable labels", () => {
  const selectedDate = new Date(2026, 7, 28);

  assert.equal(formatHealthFollowUpDateKey(selectedDate), "2026-08-28");
  assert.equal(formatHealthFollowUpDateLabel("2026-08-28"), "August 28, 2026");
  assert.equal(parseHealthFollowUpDateKey("2026-08-28")?.getDate(), 28);
  assert.equal(parseHealthFollowUpDateKey("2026-02-30"), null);
  assert.equal(formatHealthFollowUpDateLabel("not-a-date"), "");
});

test("Advice service patches the exact request endpoint and payload", async () => {
  const calls: { url: string; payload: unknown }[] = [];
  const api = {
    patch: async (url: string, payload: unknown) => {
      calls.push({ url, payload });
      return { data: { data: { request: { status: "resolved" } } } };
    },
  };
  const payload = { advice: "Keep the animal hydrated." };

  const result = await sendTechnicianHealthAdvice(
    api as any,
    "health-request-1",
    payload,
  );

  assert.deepEqual(calls, [
    {
      url: "/health-request/health-request-1/advice",
      payload,
    },
  ]);
  assert.equal(result.request.status, "resolved");
});
