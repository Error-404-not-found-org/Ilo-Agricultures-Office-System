import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL } from "node:url";

const adminControllerSource = readFileSync(
  new URL("../src/controllers/admin.controllers.js", import.meta.url),
  "utf8",
);
const reportControllerSource = readFileSync(
  new URL("../src/controllers/report.controllers.js", import.meta.url),
  "utf8",
);
const reportRoutesSource = readFileSync(
  new URL("../src/routes/report.routes.js", import.meta.url),
  "utf8",
);

const dashboardStatsSource = adminControllerSource.slice(
  adminControllerSource.indexOf("export const getDashboardStats"),
  adminControllerSource.indexOf("// Advanced Analytics for Admin Dashboard"),
);
const monthlyReportSource = reportControllerSource.slice(
  reportControllerSource.indexOf("export const getMonthlyAccomplishmentReport"),
  reportControllerSource.indexOf("export const getMunicipalCensusData"),
);

test("Admin stats never substitutes a synthetic 84 percent success rate", () => {
  assert.doesNotMatch(dashboardStatsSource, /84%/);
  assert.match(dashboardStatsSource, /successRateConfig\?\.value \?\? null/);
});

test("Monthly accomplishment reporting remains AI, Pregnancy, and Calving only", () => {
  assert.match(monthlyReportSource, /Insemination\.find/);
  assert.match(monthlyReportSource, /Pregnancy\.find/);
  assert.match(monthlyReportSource, /Calving\.find/);
  assert.doesNotMatch(monthlyReportSource, /HealthRequest\.find|MedicalRecord\.find/);
  assert.match(
    reportRoutesSource,
    /router\.get\("\/monthly-accomplishment"[\s\S]*?getMonthlyAccomplishmentReport/,
  );
});
