import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve("src/components/dialogs/WalkInHealthModal.jsx"),
  "utf8",
);

describe("Web direct Health recording", () => {
  it("exposes the canonical direct clinical fields", () => {
    for (const label of [
      "Farmer",
      "Animal",
      "Service type",
      "Service date",
      "Findings / diagnosis",
      "Treatment provided",
      "Medication given",
      "Dosage",
      "Withdrawal period in days",
      "Care advice",
      "Resolution / technician notes",
      "Follow-up date",
    ]) {
      expect(source).toContain(label);
    }
  });

  it("uses MedicalRecord for the active direct flow and keeps request fields out of it", () => {
    expect(source).toContain('existingOnly && Boolean(data.farmerId)');
    expect(source).toContain('? "/medical"');
    expect(source).toContain('queryKey: ["technician", "official-records"]');
    expect(source).toContain("{!existingOnly && (");
  });

  it("keeps backend errors inline and success feedback global", () => {
    expect(source).toContain('role="alert"');
    expect(source).toContain("setSubmissionError(");
    expect(source).not.toContain("toast.error(");
    expect(source).toContain("toast.success(");
  });
});
