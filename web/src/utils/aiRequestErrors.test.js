import { describe, expect, it } from "vitest";
import { getAIRequestErrorMessage } from "./aiRequestErrors";

describe("getAIRequestErrorMessage", () => {
  it("maps the structured active-request conflict without matching raw text", () => {
    const error = {
      response: {
        data: {
          code: "ACTIVE_AI_REQUEST_EXISTS",
          message: "server wording can change",
        },
      },
    };
    expect(getAIRequestErrorMessage(error, "fallback")).toMatch(
      /active AI service request/i,
    );
  });

  it("falls back to the server message for other errors", () => {
    expect(
      getAIRequestErrorMessage(
        { response: { data: { message: "Animal not found" } } },
        "fallback",
      ),
    ).toBe("Animal not found");
  });
});
