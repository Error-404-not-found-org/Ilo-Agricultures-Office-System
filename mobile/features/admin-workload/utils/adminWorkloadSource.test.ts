import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL as NodeURL } from "node:url";

const workloadScreen = readFileSync(
  new NodeURL("../screens/TechnicianWorkloadScreen.tsx", import.meta.url),
  "utf8",
);
const dashboardHook = readFileSync(
  new NodeURL("../../admin-dashboard/hooks/useAdminDashboard.ts", import.meta.url),
  "utf8",
);

test("Dashboard and Workload use the shared canonical workload service", () => {
  assert.match(workloadScreen, /getAdminTechnicianWorkloadSummary/);
  assert.match(dashboardHook, /getAdminTechnicianWorkloadSummary/);
  assert.match(workloadScreen, /admin-technician-workload-summary/);
  assert.match(dashboardHook, /admin-technician-workload-summary/);
});

test("Workload uses stable IDs and no longer exposes capped-data performance metrics", () => {
  assert.match(workloadScreen, /keyExtractor=\{\(item\) => item\.technicianId\}/);
  assert.match(workloadScreen, /params: \{ id: item\.technicianId \}/);
  assert.doesNotMatch(workloadScreen, /Performance Board/);
  assert.doesNotMatch(
    workloadScreen,
    /completedRequests|scheduledVisits|aiSuccessRate|overdueCount/,
  );
});
