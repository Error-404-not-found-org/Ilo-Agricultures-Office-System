import { describe, expect, it } from "vitest";
import {
  formatObservationValue,
  formatSubmittedAt,
  formatTaskSummary,
  getBreedingObservationLabel,
  getBreedingObservationSignLabel,
  isFarmerBreedingObservationPendingReview,
  normalizeFarmerObservation,
  BREEDING_OBSERVATION_LABELS,
  BREEDING_OBSERVATION_SIGN_LABELS,
} from "./breedingObservation";

describe("breedingObservation utilities", () => {
  describe("normalizeFarmerObservation", () => {
    it("normalizes canonical Insemination document fields correctly", () => {
      const insemination = {
        _id: "insem-123",
        farmerOutcomeReport: "return_to_heat",
        farmerOutcomeReportedAt: "2026-09-07T04:40:00.000Z",
        farmerObservationSigns: ["mucus_discharge", "mounting_behavior"],
        farmerObservationNotes: "Cow was restless and mounting others",
        evidencePhotos: [
          "https://res.cloudinary.com/demo/image/upload/v1/mucus.jpg",
          "https://res.cloudinary.com/demo/image/upload/v1/mounting.jpg",
        ],
        verificationRequested: true,
        outcomeVerificationStatus: "pending",
      };

      const normalized = normalizeFarmerObservation(insemination);

      expect(normalized.hasObservation).toBe(true);
      expect(normalized.reportType).toBe("return_to_heat");
      expect(normalized.reportedAt).toBe("2026-09-07T04:40:00.000Z");
      expect(normalized.signs).toEqual(["mucus_discharge", "mounting_behavior"]);
      expect(normalized.notes).toBe("Cow was restless and mounting others");
      expect(normalized.evidencePhotos).toHaveLength(2);
      expect(normalized.evidencePhotos[0]).toBe(
        "https://res.cloudinary.com/demo/image/upload/v1/mucus.jpg",
      );
      expect(normalized.verificationRequested).toBe(true);
      expect(normalized.verificationStatus).toBe("pending");
    });

    it("normalizes task wrapper containing populated insemination", () => {
      const taskWrapper = {
        _id: "task-456",
        taskType: "BreedingFollowUp",
        insemination: {
          _id: "insem-123",
          farmerOutcomeReport: "return_to_heat",
          farmerOutcomeReportedAt: "2026-09-07T04:40:00.000Z",
          farmerObservationSigns: ["mucus_discharge"],
          farmerObservationNotes: "",
          evidencePhotos: ["https://example.com/photo.jpg"],
        },
      };

      const normalized = normalizeFarmerObservation(taskWrapper);

      expect(normalized.hasObservation).toBe(true);
      expect(normalized.reportType).toBe("return_to_heat");
      expect(normalized.signs).toEqual(["mucus_discharge"]);
      expect(normalized.notes).toBe("");
      expect(normalized.evidencePhotos).toEqual(["https://example.com/photo.jpg"]);
    });

    it("normalizes legacy metadata / farmerObservation structures", () => {
      const legacyTask = {
        metadata: { reportType: "possible_pregnancy" },
        farmerObservation: {
          signs: ["standing_heat"],
          notes: "Legacy notes",
        },
      };

      const normalized = normalizeFarmerObservation(legacyTask);

      expect(normalized.hasObservation).toBe(true);
      expect(normalized.reportType).toBe("possible_pregnancy");
      expect(normalized.signs).toEqual(["standing_heat"]);
      expect(normalized.notes).toBe("Legacy notes");
    });

    it("returns hasObservation = false when no observation is present", () => {
      const emptyInsemination = {
        _id: "insem-999",
        inseminationDate: "2026-08-17T00:00:00.000Z",
        attemptNumber: 1,
      };

      const normalized = normalizeFarmerObservation(emptyInsemination);

      expect(normalized.hasObservation).toBe(false);
      expect(normalized.reportType).toBeNull();
      expect(normalized.signs).toEqual([]);
      expect(normalized.notes).toBe("");
      expect(normalized.evidencePhotos).toEqual([]);
    });

    it("handles null / undefined safely", () => {
      const normalized = normalizeFarmerObservation(null);
      expect(normalized.hasObservation).toBe(false);
      expect(normalized.reportType).toBeNull();
    });
  });

  describe("getBreedingObservationLabel", () => {
    it("maps return_to_heat to Showing signs of heat", () => {
      expect(getBreedingObservationLabel("return_to_heat")).toBe("Showing signs of heat");
    });

    it("maps possible_pregnancy to No signs observed", () => {
      expect(getBreedingObservationLabel("possible_pregnancy")).toBe("No signs observed");
    });

    it("maps unsure to I'm not sure", () => {
      expect(getBreedingObservationLabel("unsure")).toBe("I'm not sure");
    });

    it("falls back gracefully for null or unknown values", () => {
      expect(getBreedingObservationLabel(null)).toBe("Breeding observation");
      expect(getBreedingObservationLabel("custom_observation")).toBe("Custom Observation");
    });
  });

  describe("getBreedingObservationSignLabel", () => {
    it("maps known sign tokens to human-facing labels", () => {
      expect(getBreedingObservationSignLabel("mucus_discharge")).toBe("Clear mucus discharge");
      expect(getBreedingObservationSignLabel("mounting_behavior")).toBe("Mounting other cattle");
      expect(getBreedingObservationSignLabel("standing_heat")).toBe("Stands when mounted");
      expect(getBreedingObservationSignLabel("restlessness")).toBe("Restless / more active than usual");
      expect(getBreedingObservationSignLabel("vulvar_swelling")).toBe("Vulva looks swollen or red");
      expect(getBreedingObservationSignLabel("vocalization")).toBe("More vocal than usual");
    });

    it("handles formatting fallback for unknown signs", () => {
      expect(getBreedingObservationSignLabel("tail_swishing")).toBe("Tail Swishing");
      expect(getBreedingObservationSignLabel("")).toBe("");
    });
  });

  describe("formatTaskSummary", () => {
    it("replaces raw tokens with human-facing copy", () => {
      const rawSummary =
        "Breeding observation: return_to_heat. Signs: mucus_discharge, mounting_behavior. Notes: None";
      const formatted = formatTaskSummary(rawSummary);

      expect(formatted).toBe(
        "Breeding observation: Return to heat. Signs: Clear mucus discharge, Mounting other cattle. Notes: None",
      );
      expect(formatted).not.toContain("return_to_heat");
      expect(formatted).not.toContain("mucus_discharge");
      expect(formatted).not.toContain("mounting_behavior");
    });

    it("preserves non-matching summary strings", () => {
      const summary = "Regular task summary with no tokens";
      expect(formatTaskSummary(summary)).toBe(summary);
      expect(formatTaskSummary(null)).toBeNull();
    });
  });

  describe("formatSubmittedAt", () => {
    it("formats ISO date string into readable date and time", () => {
      const date = "2026-09-07T04:40:00.000Z";
      const formatted = formatSubmittedAt(date);

      expect(formatted).toBeTruthy();
      expect(formatted).toContain("2026");
      expect(formatted).toContain("Sep");
    });

    it("returns null for invalid / empty dates", () => {
      expect(formatSubmittedAt(null)).toBeNull();
      expect(formatSubmittedAt("invalid-date")).toBeNull();
    });
  });

  describe("isFarmerBreedingObservationPendingReview", () => {
    it("returns true for pending BreedingFollowUp task with farmer report", () => {
      const task = {
        workflowType: "BreedingFollowUp",
        status: "Pending",
        context: { reportType: "return_to_heat" },
      };
      expect(isFarmerBreedingObservationPendingReview(task)).toBe(true);
    });

    it("returns false for completed BreedingFollowUp task", () => {
      const task = {
        workflowType: "BreedingFollowUp",
        status: "Completed",
        context: { reportType: "return_to_heat" },
      };
      expect(isFarmerBreedingObservationPendingReview(task)).toBe(false);
    });

    it("returns false for non-BreedingFollowUp task", () => {
      const task = {
        workflowType: "AI",
        status: "Pending",
      };
      expect(isFarmerBreedingObservationPendingReview(task)).toBe(false);
    });

    it("returns false for BreedingFollowUp without farmer report", () => {
      const task = {
        workflowType: "BreedingFollowUp",
        status: "Pending",
      };
      expect(isFarmerBreedingObservationPendingReview(task)).toBe(false);
    });
  });
});
