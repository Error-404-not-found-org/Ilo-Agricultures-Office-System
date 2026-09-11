import { describe, expect, it } from "vitest";
import { extractFarmerNote } from "./aiRequestNote";

describe("extractFarmerNote", () => {
  it("CASE A: extracts actual note from legacy composite comment", () => {
    const legacyComposite = `Observed Heat Signs:
• Standing to be Mounted (Standing Heat)
• Attempting to Mount Other Cows

Additional Notes:
Sir pa ai ko bwas`;
    expect(extractFarmerNote(legacyComposite)).toBe("Sir pa ai ko bwas");
  });

  it("CASE B: returns empty string for legacy composite with no actual note", () => {
    const legacyNoNote = `Observed Heat Signs:
• Standing to be Mounted (Standing Heat)
• Attempting to Mount Other Cows`;
    expect(extractFarmerNote(legacyNoNote)).toBe("");
  });

  it("CASE C: returns actual note from legacy Additional Notes: format", () => {
    const legacyOnlyNotes = `Additional Notes:
Sir pa ai ko bwas`;
    expect(extractFarmerNote(legacyOnlyNotes)).toBe("Sir pa ai ko bwas");

    const singleLine = "Additional Notes: Please visit before noon";
    expect(extractFarmerNote(singleLine)).toBe("Please visit before noon");
  });

  it("CASE D: returns modern plain comment unchanged", () => {
    expect(extractFarmerNote("Sir pa ai ko bwas")).toBe("Sir pa ai ko bwas");
    expect(extractFarmerNote("Call me before coming")).toBe(
      "Call me before coming",
    );
  });

  it("CASE E: returns empty string for null, undefined, or whitespace", () => {
    expect(extractFarmerNote(null)).toBe("");
    expect(extractFarmerNote(undefined)).toBe("");
    expect(extractFarmerNote("")).toBe("");
    expect(extractFarmerNote("   \n\t  ")).toBe("");
  });
});
