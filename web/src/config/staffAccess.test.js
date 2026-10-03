import { describe, expect, it } from "vitest";
import { classifyStaffBootstrapFailure } from "./staffAccess";

describe("staff suspension", () => {
  it("recognizes the backend suspension contract", () => {
    expect(classifyStaffBootstrapFailure({
      response: { status: 403, data: { code: "ACCOUNT_SUSPENDED", message: "Account has been suspended.", retryable: false } },
    })).toEqual({
      kind: "suspended",
      message: {
        title: "Account suspended",
        description: "Your BreedSmart account has been suspended. Please contact the Municipal Agriculture Office for assistance.",
      },
    });
  });

  it("does not label ordinary access failures or network errors as suspension", () => {
    expect(classifyStaffBootstrapFailure({ response: { status: 403, data: { code: "FORBIDDEN" } } }).kind).not.toBe("suspended");
    expect(classifyStaffBootstrapFailure({ message: "Network Error" }).kind).not.toBe("suspended");
  });
});
