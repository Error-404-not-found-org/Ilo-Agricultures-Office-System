import { describe, expect, it } from "vitest";
import {
  formatObservationValue,
  getBreedingObservationMeta,
  normalizeFarmerObservation,
} from "./breedingObservation";

describe("breeding observation presentation", () => {
  it("returns an empty observation while the modal has no selected request", () => {
    expect(normalizeFarmerObservation(null)).toMatchObject({
      reportType: null,
      reportedAt: null,
      signs: [],
      notes: "",
      evidencePhotos: [],
      verificationRequested: false,
    });
  });

  it("uses clear service labels instead of the ambiguous verify badge", () => {
    expect(getBreedingObservationMeta("possible_pregnancy")).toMatchObject({
      badge: "PREGNANCY CHECK",
      serviceLabel: "Pregnancy Check",
    });
    expect(getBreedingObservationMeta("return_to_heat")).toMatchObject({
      badge: "FOLLOW-UP",
      serviceLabel: "Return-to-Heat Review",
    });
    expect(getBreedingObservationMeta()).toMatchObject({
      badge: "BREEDING REVIEW",
      serviceLabel: "Breeding Review",
    });
  });

  it("normalizes structured farmer evidence from the request response", () => {
    expect(
      normalizeFarmerObservation({
        farmerObservation: {
          reportType: "possible_pregnancy",
          signs: ["No return to heat"],
          notes: "Eating well",
          evidencePhotos: ["photo.jpg", ""],
          verificationRequested: true,
        },
        raw: { notes: "Task context" },
      }),
    ).toMatchObject({
      reportType: "possible_pregnancy",
      signs: ["No return to heat"],
      notes: "Eating well",
      evidencePhotos: ["photo.jpg"],
      verificationRequested: true,
      taskNotes: "Task context",
    });
  });

  it("falls back to task metadata for legacy verification tasks", () => {
    expect(
      normalizeFarmerObservation({
        raw: {
          sourceType: "farmer_requested_verification",
          metadata: { reportType: "return_to_heat" },
        },
      }),
    ).toMatchObject({
      reportType: "return_to_heat",
      verificationRequested: true,
      evidencePhotos: [],
    });
    expect(formatObservationValue("return_to_heat")).toBe("Return To Heat");
  });
});
