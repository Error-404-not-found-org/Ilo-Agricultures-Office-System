import { describe, expect, it } from "vitest";
import { statusBadgeClass } from "./uiClasses";

describe("shared status badge semantics", () => {
  it.each([
    ["pending", "badge-warning badge-soft"],
    ["waiting", "badge-warning badge-soft"],
    ["scheduled", "badge-info badge-soft"],
    ["in-progress", "badge-primary badge-soft"],
    ["completed", "badge-success badge-soft"],
    ["urgent", "badge-error badge-soft"],
    ["cancelled", "badge-neutral badge-soft"],
    ["off_duty", "badge-neutral badge-soft"],
  ])("maps %s to %s", (status, expectedClass) => {
    expect(statusBadgeClass(status)).toBe(expectedClass);
  });

  it("keeps service categories neutral instead of treating them as outcomes", () => {
    expect(statusBadgeClass(undefined, "health")).toBe(
      "badge-neutral badge-soft",
    );
    expect(statusBadgeClass(undefined, "insemination")).toBe(
      "badge-neutral badge-soft",
    );
  });
});
