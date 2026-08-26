import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getVisitSchedulePeriodAvailability } from "./visitScheduleAvailability.ts";

const TODAY = "2026-08-26";

const atManilaTime = (utcTime: string) =>
  new Date(`2026-08-26T${utcTime}:00.000Z`);

const availabilityAt = (utcTime: string, period: "morning" | "afternoon") =>
  getVisitSchedulePeriodAvailability(TODAY, period, atManilaTime(utcTime));

describe("shared visit schedule availability", () => {
  it("uses the 10:00 Morning confirmation threshold", () => {
    assert.equal(
      availabilityAt("01:59", "morning").requiresConfirmation,
      false,
    );
    assert.equal(availabilityAt("02:00", "morning").requiresConfirmation, true);
    assert.equal(availabilityAt("03:59", "morning").requiresConfirmation, true);
  });

  it("ends Morning at noon and keeps early Afternoon available normally", () => {
    const morningAtNoon = availabilityAt("04:00", "morning");
    const afternoonAtNoon = availabilityAt("04:00", "afternoon");

    assert.equal(morningAtNoon.timing, "past");
    assert.equal(morningAtNoon.disabled, true);
    assert.equal(afternoonAtNoon.timing, "current");
    assert.equal(afternoonAtNoon.requiresConfirmation, false);
    assert.equal(
      availabilityAt("04:23", "afternoon").requiresConfirmation,
      false,
    );
    assert.equal(
      availabilityAt("06:59", "afternoon").requiresConfirmation,
      false,
    );
  });

  it("uses the 15:00 Afternoon threshold and 18:00 cutoff", () => {
    assert.equal(
      availabilityAt("07:00", "afternoon").requiresConfirmation,
      true,
    );
    assert.equal(
      availabilityAt("09:59", "afternoon").requiresConfirmation,
      true,
    );

    const afternoonAtSix = availabilityAt("10:00", "afternoon");
    assert.equal(afternoonAtSix.timing, "past");
    assert.equal(afternoonAtSix.disabled, true);
    assert.equal(afternoonAtSix.requiresConfirmation, false);
  });

  it("uses Asia/Manila independently of the device timezone", () => {
    const originalTimeZone = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      const tenInManila = new Date("2026-08-26T02:00:00.000Z");
      assert.equal(
        getVisitSchedulePeriodAvailability(TODAY, "morning", tenInManila)
          .requiresConfirmation,
        true,
      );
      assert.equal(
        getVisitSchedulePeriodAvailability("2026-08-27", "morning", tenInManila)
          .requiresConfirmation,
        false,
      );
    } finally {
      if (originalTimeZone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimeZone;
    }
  });
});
