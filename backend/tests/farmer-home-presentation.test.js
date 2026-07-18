import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildUpcomingVisits,
  FARMER_HOME_LIMITS,
  formatAnimalReference,
  formatHumanReadableRecordTitle,
  getFarmerDashboardLayout,
  selectNeedsAttention,
  selectRecentActivities,
  selectUpcomingVisits,
} from "../../mobile/features/farmer-dashboard/utils/farmerDashboard.transforms.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("Farmer Home applies the two-visit, two-action, and three-activity limits", () => {
  const visits = Array.from({ length: 4 }, (_, index) => ({ _id: `visit-${index}` }));
  const actions = Array.from({ length: 4 }, (_, index) => ({
    type: "heat_check",
    title: "Heat watch",
    daysLeft: index,
    date: `2026-07-${18 + index}T00:00:00.000Z`,
  }));
  const activities = Array.from({ length: 5 }, (_, index) => ({
    id: `activity-${index}`,
    type: "health",
    animalId: { earTag: `RC26-${10 + index}` },
    date: "2026-07-18T00:00:00.000Z",
  }));

  assert.equal(selectUpcomingVisits(visits).length, 2);
  assert.equal(selectNeedsAttention(actions).length, 2);
  assert.equal(selectRecentActivities(activities).length, 3);
  assert.deepEqual(FARMER_HOME_LIMITS, { visits: 2, actions: 2, activities: 3 });
});

test("Upcoming visits deduplicate linked records and retain service status separately", () => {
  const duplicate = {
    _id: "request-1",
    status: "scheduled",
    scheduledDate: "2026-07-20T05:48:00.000Z",
    animalId: { earTag: "RC26-05" },
  };
  const visits = buildUpcomingVisits([duplicate, duplicate], []);
  assert.equal(visits.length, 1);
  assert.equal(visits[0].status, "scheduled");

  const screen = source("mobile/features/farmer-dashboard/screens/FarmerHomeScreen.tsx");
  assert.match(screen, /serviceStatus=/);
  assert.match(screen, /reproductiveOutcome=/);
});

test("Needs Attention removes resolved items and ranks overdue, today, actionable, then awaiting", () => {
  const result = selectNeedsAttention([
    { type: "pd_check", title: "Preg-Check Due", daysLeft: 19, date: "2026-08-06" },
    { type: "heat_check", title: "Heat watch", daysLeft: 2, date: "2026-07-20" },
    { type: "heat_check", title: "Resolved heat watch", daysLeft: -4, status: "resolved" },
    { type: "calving", title: "Calving check", daysLeft: 0, date: "2026-07-18" },
    { type: "calving", title: "Overdue calving", daysLeft: -1, date: "2026-07-17" },
  ]);

  assert.deepEqual(result.map((item) => item.urgency), ["overdue", "due_today"]);
  assert.ok(result.every((item) => !item.displayTitle.includes("Resolved")));

  const lowerPriority = selectNeedsAttention([
    { type: "pd_check", title: "Preg-Check Due", daysLeft: 10, date: "2026-07-28" },
    { type: "heat_check", title: "Heat watch", daysLeft: 2, date: "2026-07-20" },
  ]);
  assert.deepEqual(lowerPriority.map((item) => item.urgency), ["actionable", "awaiting"]);
});

test("Future pregnancy checks use availability wording without an urgent due label", () => {
  const [item] = selectNeedsAttention([
    { type: "pd_check", title: "Preg-Check Due", daysLeft: 19, date: "2026-08-06" },
  ]);
  assert.equal(item.displayTitle, "Pregnancy check available in 19 days");
  assert.equal(item.urgency, "awaiting");
  assert.doesNotMatch(item.displayTitle, /due/i);
});

test("Animal and activity presentation removes seed prefixes and exposes outcomes", () => {
  const seededAnimal = {
    earTag: "SEED-repro-manual-20260717-RC26-260717-12-STILLBIRTH",
  };
  assert.equal(formatAnimalReference(seededAnimal), "RC26-12");

  const calving = formatHumanReadableRecordTitle({
    id: "calving-1",
    type: "calving",
    animalId: seededAnimal,
    date: "2026-07-17T05:48:00.000Z",
    details: { outcome: "stillbirth", stillbornCount: 1 },
  });
  assert.equal(calving.title, "Calving outcome recorded for RC26-12");
  assert.equal(calving.outcome, "Stillbirth");
  assert.doesNotMatch(`${calving.title} ${calving.outcome}`, /SEED-repro-manual/i);

  const ai = formatHumanReadableRecordTitle({
    id: "ai-1",
    type: "ai",
    title: "AI performed on RC26-05",
    animalId: { earTag: "RC26-05" },
    details: { status: "done", outcome: "Pending" },
  });
  assert.equal(ai.title, "AI service completed for RC26-05");
  assert.equal(ai.outcome, "Outcome awaiting confirmation");
});

test("Farmer cattle cards show one status and preserve responsive 320, 360, and 390 contracts", () => {
  assert.deepEqual(getFarmerDashboardLayout(320), {
    horizontalPadding: 16,
    animalCardWidth: 148,
    cardGap: 12,
    nextCardPreview: 24,
  });
  assert.deepEqual(getFarmerDashboardLayout(360), {
    horizontalPadding: 20,
    animalCardWidth: 156,
    cardGap: 12,
    nextCardPreview: 30,
  });
  assert.deepEqual(getFarmerDashboardLayout(390), {
    horizontalPadding: 24,
    animalCardWidth: 164,
    cardGap: 12,
    nextCardPreview: 34,
  });

  const screen = source("mobile/features/farmer-dashboard/screens/FarmerHomeScreen.tsx");
  const card = source("mobile/features/farmer-ui/components/AnimalSummaryCard.tsx");
  const previewCard = card.slice(
    card.indexOf('if (variant === "preview")'),
    card.indexOf("\n  return (", card.indexOf('if (variant === "preview")') + 1),
  );
  assert.match(screen, /cardWidth=\{dashboardLayout\.animalCardWidth\}/);
  assert.doesNotMatch(screen, /: animal\.reproductiveStatus \|\| "View profile"/);
  assert.equal((previewCard.match(/<StatusBadge label=\{status\}/g) || []).length, 1);
  assert.match(card, /accessibilityLabel=\{`\$\{fullIdentifier\}/);
});
