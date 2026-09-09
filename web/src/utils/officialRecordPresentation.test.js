import { describe, expect, it } from "vitest";
import {
  formatRecordStatus,
  getAIResultPresentation,
  getAllRecordsResultPresentation,
  getCalvingResultPresentation,
  getHealthResultPresentation,
  getPregnancyResultPresentation,
  humanizeToken,
} from "./officialRecordPresentation";

describe("officialRecordPresentation", () => {
  describe("formatRecordStatus", () => {
    it("capitalizes completed and resolved statuses", () => {
      expect(formatRecordStatus("completed")).toBe("Completed");
      expect(formatRecordStatus("done")).toBe("Completed");
      expect(formatRecordStatus("resolved")).toBe("Resolved");
      expect(formatRecordStatus("cancelled")).toBe("Cancelled");
      expect(formatRecordStatus("rejected")).toBe("Rejected");
    });
  });

  describe("getHealthResultPresentation", () => {
    it("labels diagnosis when diagnosis is present", () => {
      const record = {
        recordKind: "medical_record",
        source: {
          details: {
            diagnosis: "Haha",
            treatment: "Haah",
            dosage: "1",
          },
        },
      };

      const result = getHealthResultPresentation(record);
      expect(result).toEqual({ label: "Diagnosis", value: "Haha" });
    });

    it("labels treatment when diagnosis is missing but treatment is present", () => {
      const record = {
        recordKind: "medical_record",
        source: {
          details: {
            treatment: "Deworming",
          },
        },
      };

      const result = getHealthResultPresentation(record);
      expect(result).toEqual({ label: "Treatment", value: "Deworming" });
    });

    it("does NOT display dosage as an unlabeled result when diagnosis/treatment are absent or numeric", () => {
      const recordWithDosageOnly = {
        recordKind: "medical_record",
        summary: "1",
        source: {
          details: {
            dosage: "1",
            diagnosis: "1",
          },
        },
      };

      const result = getHealthResultPresentation(recordWithDosageOnly);
      expect(result).toEqual({ label: null, value: null });
      expect(result.value).not.toBe("1");
    });

    it("ignores generic placeholder diagnosis and treatment text", () => {
      const record = {
        recordKind: "medical_record",
        summary: "Health record completed",
        source: {
          details: {
            diagnosis: "No specific diagnosis logged.",
            treatment: "No treatment logged.",
          },
        },
      };

      const result = getHealthResultPresentation(record);
      expect(result).toEqual({ label: null, value: null });
    });

    it("formats closed health requests with semantic labels", () => {
      const adviceRecord = {
        recordKind: "health_request",
        status: "resolved",
        source: {
          handlingMethod: "advice",
          advice: "Give plenty of water",
        },
      };
      expect(getHealthResultPresentation(adviceRecord)).toEqual({
        label: null,
        value: "Advice provided",
      });

      const pickupRecord = {
        recordKind: "health_request",
        status: "resolved",
        source: {
          handlingMethod: "office_pickup",
        },
      };
      expect(getHealthResultPresentation(pickupRecord)).toEqual({
        label: null,
        value: "Pickup info provided",
      });

      const cancelledRecord = {
        recordKind: "health_request",
        status: "cancelled",
        source: {
          cancellationReason: "Farmer requested cancellation",
        },
      };
      expect(getHealthResultPresentation(cancelledRecord)).toEqual({
        label: "Reason",
        value: "Farmer requested cancellation",
      });
    });

    it("presents General Note with source.note correctly", () => {
      const noteRecord = {
        recordKind: "medical_record",
        category: "General Note",
        source: {
          note: "Animal was grazing normally today",
        },
      };
      expect(getHealthResultPresentation(noteRecord)).toEqual({
        label: "Note",
        value: "Animal was grazing normally today",
      });
    });

    it("does NOT throw ReferenceError when General Note lacks source.note (TDZ regression test)", () => {
      const noteWithoutSourceNote = {
        recordKind: "medical_record",
        category: "General Note",
        summary: "Observation during routine pasture check",
        source: {},
      };
      // Must not throw ReferenceError: Cannot access 'summary' before initialization
      expect(() => getHealthResultPresentation(noteWithoutSourceNote)).not.toThrow();
      expect(getHealthResultPresentation(noteWithoutSourceNote)).toEqual({
        label: "Note",
        value: "Observation during routine pasture check",
      });

      const noteWithoutAnyText = {
        recordKind: "medical_record",
        category: "General Note",
        source: {},
      };
      expect(() => getHealthResultPresentation(noteWithoutAnyText)).not.toThrow();
      expect(getHealthResultPresentation(noteWithoutAnyText)).toEqual({
        label: null,
        value: null,
      });
    });
  });

  describe("getAIResultPresentation", () => {
    it("returns confirmed outcomes only", () => {
      expect(
        getAIResultPresentation({
          recordKind: "insemination",
          source: { outcome: "Pregnant" },
        }),
      ).toBe("Pregnant");

      expect(
        getAIResultPresentation({
          recordKind: "insemination",
          source: { outcome: "Failed (Re-heat)" },
        }),
      ).toBe("Return to heat");

      expect(
        getAIResultPresentation({
          recordKind: "insemination",
          source: { outcome: "Failed (Negative PD)" },
        }),
      ).toBe("Not pregnant (Negative PD)");
    });

    it("returns null when outcome is Pending or unrecorded", () => {
      expect(
        getAIResultPresentation({
          recordKind: "insemination",
          source: { outcome: "Pending" },
        }),
      ).toBeNull();

      expect(
        getAIResultPresentation({
          recordKind: "insemination",
          summary: "Artificial insemination completed",
          source: {},
        }),
      ).toBeNull();
    });

    it("shows cancellation reason for cancelled AI request", () => {
      expect(
        getAIResultPresentation({
          recordKind: "ai_request",
          source: { cancellationReason: "Cow was not in standing heat" },
        }),
      ).toBe("Reason: Cow was not in standing heat");
    });
  });

  describe("getPregnancyResultPresentation", () => {
    it("maps raw enums to human-facing labels", () => {
      expect(
        getPregnancyResultPresentation({
          source: { pregnancyDiagnosis: { result: "pregnant" } },
        }),
      ).toBe("Pregnant");

      expect(
        getPregnancyResultPresentation({
          source: { pregnancyDiagnosis: { result: "not_pregnant" } },
        }),
      ).toBe("Not pregnant");

      expect(
        getPregnancyResultPresentation({
          source: { pregnancyDiagnosis: { result: "empty" } },
        }),
      ).toBe("Not pregnant");

      expect(
        getPregnancyResultPresentation({
          source: { pregnancyDiagnosis: { result: "needs_recheck" } },
        }),
      ).toBe("Recheck required");

      expect(
        getPregnancyResultPresentation({
          source: { pregnancyDiagnosis: { result: "return_to_heat" } },
        }),
      ).toBe("Returned to heat");
    });

    it("returns null for generic placeholder summary without result", () => {
      expect(
        getPregnancyResultPresentation({
          summary: "Pregnancy diagnosis recorded",
          source: {},
        }),
      ).toBeNull();
    });
  });

  describe("getCalvingResultPresentation", () => {
    it("formats offspring count and outcome cleanly without raw tokens", () => {
      expect(
        getCalvingResultPresentation({
          source: {
            numberOfCalves: 1,
            calvingOutcome: "live_birth",
          },
        }),
      ).toBe("1 calf · Live Birth");

      expect(
        getCalvingResultPresentation({
          source: {
            numberOfCalves: 2,
            calvingOutcome: "live_birth",
          },
        }),
      ).toBe("2 calves · Live Birth");

      expect(
        getCalvingResultPresentation({
          source: {
            numberOfCalves: 1,
          },
        }),
      ).toBe("1 calf");

      expect(
        getCalvingResultPresentation({
          source: {
            numberOfCalves: 1,
            outcome: "stillbirth",
          },
        }),
      ).toBe("1 calf · Stillbirth");

      expect(
        getCalvingResultPresentation({
          source: {
            outcome: "live_birth",
          },
        }),
      ).toBe("Live Birth");
    });
  });

  describe("getAllRecordsResultPresentation", () => {
    it("returns labeled diagnosis for Health record with diagnosis", () => {
      const record = {
        category: "Health",
        recordKind: "medical_record",
        source: {
          details: {
            diagnosis: "Haha",
            treatment: "Haah",
            dosage: "1",
          },
        },
      };
      expect(getAllRecordsResultPresentation(record)).toEqual({
        label: "Diagnosis",
        value: "Haha",
      });
    });

    it("returns labeled treatment for Health record when diagnosis is missing", () => {
      const record = {
        category: "Health",
        recordKind: "medical_record",
        source: {
          details: {
            treatment: "Haah",
            dosage: "1",
          },
        },
      };
      expect(getAllRecordsResultPresentation(record)).toEqual({
        label: "Treatment",
        value: "Haah",
      });
    });

    it("returns null for Health record when only dosage or pure number exists", () => {
      const record = {
        category: "Health",
        recordKind: "medical_record",
        summary: "1",
        source: {
          details: {
            dosage: "1",
          },
        },
      };
      expect(getAllRecordsResultPresentation(record)).toBeNull();
    });

    it("returns humanized pregnancy result for Pregnancy record", () => {
      const record = {
        category: "Pregnancy",
        recordKind: "pregnancy",
        source: {
          pregnancyDiagnosis: {
            result: "needs_recheck",
          },
        },
      };
      expect(getAllRecordsResultPresentation(record)).toEqual({
        label: null,
        value: "Recheck required",
      });
    });

    it("returns confirmed outcome for AI record, null if pending", () => {
      const confirmedAI = {
        category: "AI",
        recordKind: "insemination",
        source: { outcome: "Pregnant" },
      };
      expect(getAllRecordsResultPresentation(confirmedAI)).toEqual({
        label: null,
        value: "Pregnant",
      });

      const pendingAI = {
        category: "AI",
        recordKind: "insemination",
        source: { outcome: "Pending" },
      };
      expect(getAllRecordsResultPresentation(pendingAI)).toBeNull();
    });

    it("returns formatted offspring and outcome for Calving record", () => {
      const record = {
        category: "Calving",
        recordKind: "calving",
        source: {
          numberOfCalves: 1,
          calvingOutcome: "live_birth",
        },
      };
      expect(getAllRecordsResultPresentation(record)).toEqual({
        label: null,
        value: "1 calf · Live Birth",
      });
    });
  });
});

