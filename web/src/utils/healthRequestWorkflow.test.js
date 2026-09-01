import { describe, expect, it } from "vitest";
import {
  buildHealthAdvicePayload,
  buildHealthOfficePickupPayload,
  getHealthRequestId,
  getHealthVisitPeriodAvailability,
  isHealthAdviceEligible,
  isHealthFarmVisitEligible,
  isHealthOfficePickupEligible,
  validateHealthAdvice,
  validateHealthOfficePickup,
} from "./healthRequestWorkflow";

const owned = {
  status: "approved",
  handledBy: { _id: "technician-1" },
};

describe("Web Health request workflow rules", () => {
  it("returns no request ID for empty modal context", () => {
    expect(getHealthRequestId(null)).toBeNull();
    expect(getHealthRequestId(undefined)).toBeNull();
    expect(getHealthRequestId({})).toBeNull();
  });

  it("prefers workflow IDs and preserves normalized ID fallbacks", () => {
    expect(getHealthRequestId({ workflowId: "request-1", id: "task-1" })).toBe(
      "request-1",
    );
    expect(getHealthRequestId({ id: "request-2" })).toBe("request-2");
    expect(getHealthRequestId({ _id: "request-3" })).toBe("request-3");
    expect(getHealthRequestId({ raw: { _id: "request-4" } })).toBe(
      "request-4",
    );
  });

  it("keeps response methods request-linked and blocks incompatible states", () => {
    expect(isHealthAdviceEligible(owned)).toBe(true);
    expect(isHealthOfficePickupEligible(owned)).toBe(true);
    expect(isHealthFarmVisitEligible(owned)).toBe(true);
    expect(
      isHealthAdviceEligible({ ...owned, scheduledDate: "2026-09-01" }),
    ).toBe(false);
    expect(
      isHealthOfficePickupEligible({ ...owned, handlingMethod: "advice" }),
    ).toBe(false);
    expect(
      isHealthFarmVisitEligible({ ...owned, handlingMethod: "office_pickup" }),
    ).toBe(false);
  });

  it("validates and trims Advice without adding schedule fields", () => {
    expect(validateHealthAdvice({ adviceForFarmer: "   " })).toBe(
      "Advice for the farmer is required.",
    );
    expect(
      buildHealthAdvicePayload({
        adviceForFarmer: "  Keep the animal hydrated.  ",
        followUpDate: " 2026-09-03 ",
        internalNote: "  Monitor the next request. ",
      }),
    ).toEqual({
      advice: "Keep the animal hydrated.",
      followUpDate: "2026-09-03",
      technicianNote: "Monitor the next request.",
    });
  });

  it("validates Office Pickup and omits empty optional fields", () => {
    const draft = {
      item: " Dewormer ",
      availabilityConfirmed: true,
      pickupInstructions: " Collect during office hours. ",
      farmerMessage: " ",
      dosageInstructions: " ",
      withdrawalGuidance: " ",
      followUpDate: " ",
      internalNote: " internal only ",
    };
    expect(validateHealthOfficePickup(draft)).toBeNull();
    expect(buildHealthOfficePickupPayload(draft)).toEqual({
      item: "Dewormer",
      availabilityConfirmed: true,
      instructions: "Collect during office hours.",
      technicianNote: "internal only",
    });
    expect(
      validateHealthOfficePickup({ ...draft, availabilityConfirmed: false }),
    ).toBe("Confirm that the item is available for office pickup.");
  });

  it("uses Asia/Manila thresholds for current-period confirmation", () => {
    const date = "2026-08-31";
    expect(
      getHealthVisitPeriodAvailability(
        date,
        "morning",
        new Date("2026-08-31T01:59:00.000Z"),
      ).requiresConfirmation,
    ).toBe(false);
    expect(
      getHealthVisitPeriodAvailability(
        date,
        "morning",
        new Date("2026-08-31T02:00:00.000Z"),
      ).requiresConfirmation,
    ).toBe(true);
    expect(
      getHealthVisitPeriodAvailability(
        date,
        "morning",
        new Date("2026-08-31T04:00:00.000Z"),
      ).disabled,
    ).toBe(true);
    expect(
      getHealthVisitPeriodAvailability(
        date,
        "afternoon",
        new Date("2026-08-31T06:59:00.000Z"),
      ).requiresConfirmation,
    ).toBe(false);
    expect(
      getHealthVisitPeriodAvailability(
        date,
        "afternoon",
        new Date("2026-08-31T07:00:00.000Z"),
      ).requiresConfirmation,
    ).toBe(true);
    expect(
      getHealthVisitPeriodAvailability(
        date,
        "afternoon",
        new Date("2026-08-31T10:00:00.000Z"),
      ).disabled,
    ).toBe(true);
  });

  it("keeps exact Morning and Afternoon service-period boundaries", () => {
    const date = "2026-08-31";
    const atManila = (time) =>
      new Date(`2026-08-31T${time}:00.000+08:00`);

    expect(
      getHealthVisitPeriodAvailability(date, "morning", atManila("09:59")),
    ).toMatchObject({ disabled: false, requiresConfirmation: false });
    expect(
      getHealthVisitPeriodAvailability(date, "morning", atManila("10:00")),
    ).toMatchObject({ disabled: false, requiresConfirmation: true });
    expect(
      getHealthVisitPeriodAvailability(date, "morning", atManila("11:59")),
    ).toMatchObject({ disabled: false, requiresConfirmation: true });
    expect(
      getHealthVisitPeriodAvailability(date, "morning", atManila("12:00")),
    ).toMatchObject({ disabled: true, requiresConfirmation: false });

    expect(
      getHealthVisitPeriodAvailability(date, "afternoon", atManila("12:23")),
    ).toMatchObject({ disabled: false, requiresConfirmation: false });
    expect(
      getHealthVisitPeriodAvailability(date, "afternoon", atManila("14:59")),
    ).toMatchObject({ disabled: false, requiresConfirmation: false });
    expect(
      getHealthVisitPeriodAvailability(date, "afternoon", atManila("15:00")),
    ).toMatchObject({ disabled: false, requiresConfirmation: true });
    expect(
      getHealthVisitPeriodAvailability(date, "afternoon", atManila("17:59")),
    ).toMatchObject({ disabled: false, requiresConfirmation: true });
    expect(
      getHealthVisitPeriodAvailability(date, "afternoon", atManila("18:00")),
    ).toMatchObject({ disabled: true, requiresConfirmation: false });

    expect(
      getHealthVisitPeriodAvailability(
        "2026-09-01",
        "morning",
        atManila("18:00"),
      ),
    ).toMatchObject({ disabled: false, requiresConfirmation: false });
    expect(
      getHealthVisitPeriodAvailability(
        "2026-08-30",
        "afternoon",
        atManila("09:00"),
      ),
    ).toMatchObject({ disabled: true, requiresConfirmation: false });
  });
});
