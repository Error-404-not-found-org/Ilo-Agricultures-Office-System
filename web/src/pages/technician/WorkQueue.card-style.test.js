import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";
import { describe, expect, it } from "vitest";

const workQueueSource = readFileSync(
  resolve(cwd(), "src/pages/technician/WorkQueue.jsx"),
  "utf8",
);
const myWorkStart = workQueueSource.indexOf(
  '<div className="space-y-3" aria-label="My Work items">',
);
const myWorkEnd = workQueueSource.indexOf("{/* PAGINATION */}", myWorkStart);
const myWorkCards = workQueueSource.slice(myWorkStart, myWorkEnd);

describe("Technician My Work card styling", () => {
  it("uses the same neutral card surface regardless of task or request URL focus", () => {
    expect(myWorkStart).toBeGreaterThan(-1);
    expect(myWorkEnd).toBeGreaterThan(myWorkStart);
    expect(myWorkCards).toContain(
      'className="rounded-box border border-base-300 bg-base-100 p-4 transition-colors hover:border-base-content/25 sm:p-5"',
    );
    expect(myWorkCards).not.toContain("bg-primary/5");
    expect(myWorkCards).not.toContain("isFocused");
  });

  it("keeps visible service, status, urgency, timing, and action cues", () => {
    expect(myWorkCards).toContain("servicePresentation.label");
    expect(myWorkCards).toContain("statusPresentation.label");
    expect(myWorkCards).toContain("task.urgent");
    expect(myWorkCards).toContain("timingLabel");
    expect(myWorkCards).toContain("primaryActionLabel");
  });
});
