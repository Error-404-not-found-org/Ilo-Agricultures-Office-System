import { describe, expect, it } from "vitest";
import { getAIEligibility } from "./aiEligibility";

const eligibleFemale = {
  gender: "Female",
  birthDate: "2020-01-01T00:00:00.000Z",
  species: "Cattle",
  reproductiveStatus: "Normal",
  inseminations: [],
};

describe("Web AI eligibility presentation", () => {
  it("uses the backend next action to explain a pending pregnancy recheck", () => {
    const result = getAIEligibility({
      animal: {
        ...eligibleFemale,
        reproductiveStatus: "Inseminated",
        nextAction: {
          type: "PERFORM_PREGNANCY_DIAGNOSIS",
          phase: "PREGNANCY_CHECK_DUE",
        },
        inseminations: [
          {
            status: "done",
            pregnancyFollowUpTask: {
              metadata: { workflowStage: "diagnostic_follow_up" },
            },
          },
        ],
      },
    });

    expect(result).toMatchObject({
      isEligible: false,
      code: "ACTIVE_REPRODUCTIVE_WORKFLOW",
      reason: "Pregnancy recheck is still pending.",
    });
  });

  it("uses the backend effective status for postpartum recovery", () => {
    const result = getAIEligibility({
      animal: {
        ...eligibleFemale,
        effectiveReproductiveStatus: "Post-partum",
        nextAction: {
          type: "WAIT_FOR_POSTPARTUM_RECOVERY",
          phase: "RECOVERY_PERIOD",
        },
      },
    });

    expect(result).toMatchObject({
      isEligible: false,
      code: "POSTPARTUM_RECOVERY",
      reason: "This animal is still in postpartum recovery.",
    });
  });
});
