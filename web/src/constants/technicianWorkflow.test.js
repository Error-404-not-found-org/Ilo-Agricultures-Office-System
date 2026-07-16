import { describe, expect, it } from "vitest";
import { getClaimType, getTechnicianStatus } from "./technicianWorkflow";

describe("technician workflow presentation", () => {
  it("maps Web service aliases to canonical claim types", () => {
    expect(getClaimType("insemination")).toBe("ai");
    expect(getClaimType("ai")).toBe("ai");
    expect(getClaimType("health")).toBe("health");
    expect(getClaimType("pregnancy_check")).toBe("breeding_verification");
    expect(getClaimType("breeding_verification")).toBe("breeding_verification");
    expect(getClaimType("calving")).toBeNull();
  });

  it("uses consistent labels for API status aliases", () => {
    expect(getTechnicianStatus("in_progress").label).toBe("In Progress");
    expect(getTechnicianStatus("in-progress").label).toBe("In Progress");
    expect(getTechnicianStatus("resolved").label).toBe("Resolved");
    expect(getTechnicianStatus("done").label).toBe("Completed");
  });
});
