import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { selectNeedsAttention } from "./farmerDashboard.transforms.ts";

const heatFollowUp = {
  type: "heat_check",
  title: "Heat Watch",
  animal: { _id: "animal-1", earTag: "COW-001" },
  date: "2026-08-14T00:00:00.000Z",
  daysLeft: 0,
  relatedId: "insemination-1",
  status: "actionable",
  pregnancyReadiness: {
    daysPostAI: 20,
    isEligible: false,
  },
};

for (const day of [18, 25]) {
  test(`Day ${day} shows the Farmer Home Give Update reminder`, () => {
    const [attention] = selectNeedsAttention([
      {
        ...heatFollowUp,
        pregnancyReadiness: {
          daysPostAI: day,
          isEligible: false,
        },
      },
    ]);

    assert.equal(attention.actionKind, "report_signs");
    assert.equal(attention.actionLabel, "Give Update");
    assert.equal(attention.displayTitle, `${day} days after insemination`);
    assert.equal(attention.guidance, "Has your animal returned to heat?");
    assert.equal(attention.urgency, "due_today");
  });
}

for (const day of [17, 26, 30]) {
  test(`Day ${day} does not show the Farmer Home observation reminder`, () => {
    const attention = selectNeedsAttention([
      {
        ...heatFollowUp,
        pregnancyReadiness: {
          daysPostAI: day,
          isEligible: false,
        },
      },
    ]);

    assert.deepEqual(attention, []);
  });
}

for (const reportType of [
  "possible_pregnancy",
  "return_to_heat",
  "unsure",
] as const) {
  test(`${reportType} removes the completed observation action from Needs Attention`, () => {
    const attention = selectNeedsAttention([
      {
        ...heatFollowUp,
        farmerObservation: {
          reportType,
          verificationStatus: "pending",
          reportedAt: "2026-08-14T02:00:00.000Z",
        },
        pregnancyFollowUpTask: {
          _id: "follow-up-task",
          status: "Pending",
          sourceType: "automatic_pd_followup",
        },
      },
    ]);

    assert.deepEqual(attention, []);
  });
}

test("pregnancy-check milestones do not become Farmer Home actions", () => {
  const attention = selectNeedsAttention([
    {
      ...heatFollowUp,
      type: "pd_check",
      pregnancyReadiness: { daysPostAI: 35, isEligible: true },
      pregnancyFollowUpTask: {
        _id: "pd-task",
        status: "In Progress",
      },
    },
  ]);

  assert.deepEqual(attention, []);
});

test("Animal Details exposes the direct report action and submitted state", () => {
  const source = readFileSync(
    fileURLToPath(
      new URL(
        "../../animals/screens/RoleAwareAnimalDetailsScreen.tsx",
        import.meta.url,
      ).href,
    ),
    "utf8",
  );

  assert.match(source, /Report observation/);
  assert.match(source, /Observation submitted/);
  assert.match(source, /observationPresentation\.farmerMessage/);
  assert.match(source, /const latestObservation = latestAi\?\.item\.farmerOutcomeReport/);
});
