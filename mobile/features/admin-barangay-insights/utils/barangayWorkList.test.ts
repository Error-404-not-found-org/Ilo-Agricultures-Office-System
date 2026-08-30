import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL as NodeURL } from "node:url";
import type { BarangayInsightItem } from "../services/barangayInsights.service";
import {
  buildBarangayWorkList,
  getPendingRequestCount,
  summarizeBarangays,
} from "./barangayWorkList.ts";

const item = (
  barangay: string,
  pendingHealthRequests: number,
  pendingAIRequests: number,
  farmersCount = 0,
  animalsCount = 0,
): BarangayInsightItem => ({
  barangay,
  municipality: "Oton",
  farmersCount,
  animalsCount,
  activePregnancies: 0,
  pendingAIRequests,
  pendingHealthRequests,
  incompleteRecordsCount: 0,
  aiSuccessRate: null,
  healthAlertsCount: pendingHealthRequests,
  activityScore: 1,
  status: "critical",
});

const screen = readFileSync(
  new NodeURL("../screens/BarangayInsightsScreen.tsx", import.meta.url),
  "utf8",
);
const hook = readFileSync(
  new NodeURL("../hooks/useBarangayInsights.ts", import.meta.url),
  "utf8",
);

test("sorts by factual pending request totals, then pending Health", () => {
  const rows = buildBarangayWorkList(
    [item("C", 0, 1), item("B", 2, 0), item("A", 1, 1)],
    "",
  );

  assert.deepEqual(
    rows.map((row) => row.barangay),
    ["B", "A", "C"],
  );
  assert.equal(getPendingRequestCount(rows[0]), 2);
});

test("searches Barangay names only and preserves factual overview totals", () => {
  const rows = [item("Salngan", 3, 2, 4, 7), item("Botong", 1, 0, 1, 3)];
  assert.deepEqual(
    buildBarangayWorkList(rows, "sal").map((row) => row.barangay),
    ["Salngan"],
  );
  assert.deepEqual(summarizeBarangays(rows), {
    barangays: 2,
    farmers: 5,
    animals: 10,
  });
});

test("Mobile Barangay Insights contains only factual work-list presentation", () => {
  assert.match(screen, /Search barangay\.\.\./);
  assert.match(screen, /Pending Requests/);
  assert.match(screen, /Pending Health/);
  assert.match(screen, /Pending AI/);
  assert.match(screen, /Farmers/);
  assert.match(screen, /Animals/);
  assert.doesNotMatch(
    `${screen}\n${hook}`,
    /Critical|Healthy|Activity Score|High Activity|Needs Attention|Low Records|priorityBarangays|municipalityFilter|districtFilter/,
  );
  assert.doesNotMatch(screen, /MapView|expo-location|GPS|Sort by Closest/);
});
