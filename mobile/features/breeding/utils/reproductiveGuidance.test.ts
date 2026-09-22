import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { getReproductiveGuidance } from "./reproductiveGuidance.ts";

describe("reproductive guidance", () => {
  it("keeps recent completed AI in heat-return monitoring", () => {
    assert.deepEqual(
      getReproductiveGuidance({
        reproductiveStatus: "Inseminated",
        pregnancyReadiness: { isEligible: false },
        canGiveBreedingUpdate: true,
      }),
      {
        kind: "heat_return",
        title: "Heat-return monitoring",
        statusLabel: null,
        description: "Have you noticed signs of heat?",
        action: "give_update",
      },
    );
  });

  it("uses canonical pregnancy readiness without inferring pregnancy", () => {
    const guidance = getReproductiveGuidance({
      reproductiveStatus: "Inseminated",
      pregnancyReadiness: { isEligible: true },
      canGiveBreedingUpdate: true,
    });

    assert.deepEqual(guidance, {
      kind: "pregnancy_check",
      title: "Pregnancy Check",
      statusLabel: "Ready for check",
      description: "Pregnancy diagnosis can now be performed by the technician.",
      action: null,
    });
    assert.notEqual(guidance.statusLabel, "Pregnant");
  });

  it("leaves confirmed pregnancy to the existing gestation presentation", () => {
    assert.equal(
      getReproductiveGuidance({
        reproductiveStatus: "Pregnant",
        pregnancyReadiness: { isEligible: true },
        canGiveBreedingUpdate: false,
      }),
      null,
    );
  });

  it("keeps lifecycle decisions out of the Animal Details JSX", () => {
    const source = readFileSync(
      fileURLToPath(
        new URL(
          "../../animals/screens/RoleAwareAnimalDetailsScreen.tsx",
          import.meta.url,
        ).href,
      ),
      "utf8",
    );

    assert.match(source, /getReproductiveGuidance/);
    assert.doesNotMatch(source, /daysPostAI\s*[><=]/);
    assert.doesNotMatch(source, /Record Pregnancy Check/);
  });
});
