import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL as NodeURL } from "node:url";

const readSource = (relativePath: string) =>
  readFileSync(new NodeURL(relativePath, import.meta.url), "utf8");

const dashboard = readSource("../screens/AdminDashboardScreen.tsx");
const dashboardHook = readSource("../hooks/useAdminDashboard.ts");
const analyticsGrid = readSource("../components/AnalyticsGrid.tsx");
const activityTimeline = readSource("../components/ActivityTimeline.tsx");
const dashboardService = readSource("../services/adminDashboard.service.ts");

test("Dashboard order is Hero, Overview, Quick Actions, then Recent Activities", () => {
  const heroIndex = dashboard.indexOf("<DashboardHero");
  const overviewIndex = dashboard.indexOf("<AnalyticsGrid");
  const quickActionsIndex = dashboard.indexOf("Quick Actions");
  const activitiesIndex = dashboard.indexOf("<ActivityTimeline");

  assert.ok(heroIndex >= 0);
  assert.ok(overviewIndex > heroIndex);
  assert.ok(quickActionsIndex > overviewIndex);
  assert.ok(activitiesIndex > quickActionsIndex);
  assert.doesNotMatch(dashboard, /AdminAttentionOverview|Needs Attention/);
});

test("Quick Actions are exactly Create User, Requests, and Workload", () => {
  const actions = Array.from(
    dashboard.matchAll(/title="(Create User|Requests|Workload)"/g),
    (match) => match[1],
  );

  assert.deepEqual(actions, ["Create User", "Requests", "Workload"]);
  assert.match(dashboard, /\/\(admin\)\/create-user/);
  assert.match(dashboard, /\/\(admin\)\/request-monitoring/);
  assert.match(dashboard, /\/\(admin\)\/technician-workload/);
  assert.doesNotMatch(dashboard, /claim-monitoring|title="Claims"/);
});

test("Overview retains canonical Admin stats and only three operational totals", () => {
  assert.match(dashboardService, /api\.get\("\/admin\/stats"\)/);
  assert.match(analyticsGrid, /stats\?\.farmers/);
  assert.match(analyticsGrid, /stats\?\.technicians/);
  assert.match(analyticsGrid, /stats\?\.animals/);
  assert.match(analyticsGrid, /Total Farmers/);
  assert.match(analyticsGrid, /Total Technicians/);
  assert.match(analyticsGrid, /Total Animals/);
});

test("Dashboard fetches only stats and recent activities", () => {
  assert.match(dashboardHook, /getAdminStats/);
  assert.match(dashboardHook, /getAdminRecentActivities/);
  assert.doesNotMatch(
    dashboardHook,
    /list-users|ai-request|health-request|technician-workload-summary/,
  );
});

test("Recent Activities remains audit-backed with a truthful Audit Logs CTA", () => {
  assert.match(dashboardService, /\/admin\/recent-activities/);
  assert.match(activityTimeline, /View Audit Logs/);
  assert.match(activityTimeline, /\/\(admin\)\/audit-logs/);
});
