import { describe, expect, it } from "vitest";
import { getPreviousAIErrorMessage } from "./previousAIError";

describe("getPreviousAIErrorMessage", () => {
  it("maps the tracking-window code without trusting conflicting message text", () => {
    expect(
      getPreviousAIErrorMessage({
        response: {
          data: {
            code: "PREVIOUS_AI_TRACKING_WINDOW_CLOSED",
            message: "A newer reproductive event already defines the current cycle.",
          },
        },
      }),
    ).toBe(
      "This insemination date is outside the active tracking window. Save it as History Only instead.",
    );
  });

  it("keeps newer-event and active-pregnancy conflicts distinct", () => {
    expect(
      getPreviousAIErrorMessage({
        response: { data: { code: "PREVIOUS_AI_TRACKING_SUPERSEDED" } },
      }),
    ).toBe(
      "A more recent breeding record already exists for this animal. Please select 'Add to history only' instead.",
    );
    expect(
      getPreviousAIErrorMessage({
        response: {
          data: { code: "PREVIOUS_AI_TRACKING_ACTIVE_PREGNANCY" },
        },
      }),
    ).toBe(
      "This animal already has an active pregnancy defining its current cycle. Save this AI as History Only instead.",
    );
  });
});
