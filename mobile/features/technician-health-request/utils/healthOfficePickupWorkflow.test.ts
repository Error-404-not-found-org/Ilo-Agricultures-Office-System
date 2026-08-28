import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHealthOfficePickupPayload,
  isHealthOfficePickupEligible,
  validateHealthOfficePickupDraft,
  type HealthOfficePickupDraft,
} from "./healthOfficePickupWorkflow.ts";
import { sendTechnicianHealthOfficePickup } from "../../technician/services/technician.service.ts";

const validDraft = (
  overrides: Partial<HealthOfficePickupDraft> = {},
): HealthOfficePickupDraft => ({
  item: "Dewormer",
  availabilityConfirmed: true,
  pickupInstructions: "Available at the Municipal Agriculture Office.",
  farmerMessage: "",
  dosageInstructions: "",
  withdrawalGuidance: "",
  followUpDate: "",
  internalNote: "",
  ...overrides,
});

test("Office Pickup eligibility mirrors unscheduled request presentation rules", () => {
  assert.equal(isHealthOfficePickupEligible({ status: "pending" }), true);
  assert.equal(
    isHealthOfficePickupEligible({
      status: "approved",
      handledBy: "technician-1",
    }),
    true,
  );
  assert.equal(isHealthOfficePickupEligible({ status: "approved" }), false);
  assert.equal(
    isHealthOfficePickupEligible({
      status: "scheduled",
      scheduledDate: "2026-09-01",
    }),
    false,
  );
  assert.equal(
    isHealthOfficePickupEligible({
      status: "resolved",
      handlingMethod: "advice",
    }),
    false,
  );
  assert.equal(
    isHealthOfficePickupEligible({
      status: "resolved",
      handlingMethod: "office_pickup",
    }),
    false,
  );
  assert.equal(
    isHealthOfficePickupEligible({
      status: "pending",
      handlingMethod: "farm_visit",
    }),
    false,
  );
});

test("Office Pickup validation requires item, availability, and instructions", () => {
  assert.match(
    validateHealthOfficePickupDraft(validDraft({ item: " " })) || "",
    /item/i,
  );
  assert.match(
    validateHealthOfficePickupDraft(
      validDraft({ availabilityConfirmed: false }),
    ) || "",
    /confirm/i,
  );
  assert.match(
    validateHealthOfficePickupDraft(validDraft({ pickupInstructions: " " })) ||
      "",
    /instructions/i,
  );
  assert.equal(validateHealthOfficePickupDraft(validDraft()), null);
});

test("Office Pickup payload trims fields and omits empty optionals", () => {
  const payload = buildHealthOfficePickupPayload(
    validDraft({
      item: "  Dewormer  ",
      pickupInstructions: "  Visit during office hours.  ",
      farmerMessage: "  Ready for collection.  ",
      dosageInstructions: "  Follow the label.  ",
      withdrawalGuidance: "  Informational only.  ",
      internalNote: "  Shelf B.  ",
      followUpDate: " 2026-09-30 ",
    }),
  );

  assert.deepEqual(payload, {
    item: "Dewormer",
    availabilityConfirmed: true,
    instructions: "Visit during office hours.",
    farmerMessage: "Ready for collection.",
    dosageOrUseInstructions: "Follow the label.",
    withdrawalGuidance: "Informational only.",
    technicianNote: "Shelf B.",
    followUpDate: "2026-09-30",
  });
  for (const forbidden of [
    "status",
    "handlingMethod",
    "handledBy",
    "assignedTechnicianId",
    "claimedAt",
    "resolvedAt",
    "activeCaseKey",
    "scheduledDate",
    "visitPeriod",
    "diagnosis",
    "treatment",
    "medicineGiven",
    "dosage",
    "withdrawalPeriodDays",
    "withdrawalEndDate",
    "latitude",
    "longitude",
    "location",
  ]) {
    assert.equal(forbidden in payload, false);
  }

  assert.deepEqual(buildHealthOfficePickupPayload(validDraft()), {
    item: "Dewormer",
    availabilityConfirmed: true,
    instructions: "Available at the Municipal Agriculture Office.",
  });
});

test("Office Pickup service patches only the dedicated endpoint", async () => {
  const calls: { url: string; payload: unknown }[] = [];
  const api = {
    patch: async (url: string, payload: unknown) => {
      calls.push({ url, payload });
      return {
        data: {
          data: {
            request: {
              status: "resolved",
              handlingMethod: "office_pickup",
            },
          },
        },
      };
    },
  };
  const payload = buildHealthOfficePickupPayload(validDraft());

  const result = await sendTechnicianHealthOfficePickup(
    api as any,
    "health-request-1",
    payload,
  );

  assert.deepEqual(calls, [
    {
      url: "/health-request/health-request-1/office-pickup",
      payload,
    },
  ]);
  assert.equal(result.request.status, "resolved");
  assert.equal(result.request.handlingMethod, "office_pickup");
});
