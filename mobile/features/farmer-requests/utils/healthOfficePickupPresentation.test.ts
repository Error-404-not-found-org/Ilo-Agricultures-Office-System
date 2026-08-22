import assert from "node:assert/strict";
import test from "node:test";

import { getHealthOfficePickupPresentation } from "./healthOfficePickupPresentation.ts";

test("farmer Office Pickup presentation maps the real nested response", () => {
  const presentation = getHealthOfficePickupPresentation({
    status: "resolved",
    handlingMethod: "office_pickup",
    advice: "You may collect the dewormer from our office.",
    technicianNote: "PRIVATE SHELF LOCATION",
    followUpDate: "2026-08-30T00:00:00.000Z",
    technicianResponse: {
      pickup: {
        item: "Dewormer",
        availabilityConfirmed: true,
        instructions:
          "Available at the Municipal Agriculture Office. Visit during office hours.",
        dosageOrUseInstructions: "Follow the package label.",
        withdrawalGuidance: "Ask the technician before use.",
      },
    },
  });

  assert.deepEqual(presentation, {
    item: "Dewormer",
    availabilityConfirmed: true,
    instructions:
      "Available at the Municipal Agriculture Office. Visit during office hours.",
    farmerMessage: "You may collect the dewormer from our office.",
    dosageOrUseInstructions: "Follow the package label.",
    withdrawalGuidance: "Ask the technician before use.",
    followUpDate: "August 30, 2026",
  });
  assert.doesNotMatch(JSON.stringify(presentation), /PRIVATE SHELF LOCATION/);
});

test("farmer Office Pickup presentation omits empty and duplicate optionals", () => {
  const presentation = getHealthOfficePickupPresentation({
    handlingMethod: "office_pickup",
    advice: "Visit during office hours.",
    technicianResponse: {
      pickup: {
        item: "Supplements",
        availabilityConfirmed: true,
        instructions: "Visit during office hours.",
      },
    },
  });

  assert.equal(presentation?.farmerMessage, null);
  assert.equal(presentation?.dosageOrUseInstructions, null);
  assert.equal(presentation?.withdrawalGuidance, null);
  assert.equal(presentation?.followUpDate, null);
  assert.equal(
    getHealthOfficePickupPresentation({ handlingMethod: "advice" }),
    null,
  );
});
