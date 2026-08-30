import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL } from "node:url";

const controllerSource = readFileSync(
  new URL("../src/controllers/admin.controllers.js", import.meta.url),
  "utf8",
);

test("Admin official record endpoints apply canonical record-date filters", () => {
  assert.match(
    controllerSource,
    /applyAdminRecordDateRange\([\s\S]*?"inseminationDate"/,
  );
  assert.match(
    controllerSource,
    /applyAdminRecordDateRange\([\s\S]*?"pregnancyDiagnosis\.date"/,
  );
  assert.match(
    controllerSource,
    /applyAdminRecordDateRange\(query, "date", startDate, endDate\)/,
  );
});

test("Pregnancy Records supports server search and filtered summary totals", () => {
  assert.match(
    controllerSource,
    /export const getAllPregnancyChecks[\s\S]*?const \{ search, startDate, endDate \}/,
  );
  assert.match(
    controllerSource,
    /"pregnancyDiagnosis\.result": searchRegex/,
  );
  assert.match(controllerSource, /Pregnancy\.countDocuments\(query\)/);
  assert.match(controllerSource, /summary: \{[\s\S]*?successRate:/);
});

test("Admin record endpoint source remains AI, Pregnancy, and Calving only", () => {
  const routeSource = readFileSync(
    new URL("../src/routes/admin.routes.js", import.meta.url),
    "utf8",
  );
  assert.match(routeSource, /router\.get\("\/inseminations"/);
  assert.match(routeSource, /router\.get\("\/pregnancy-checks"/);
  assert.match(routeSource, /router\.get\("\/calvings"/);
  assert.doesNotMatch(controllerSource, /HealthRequest\.find\(query\)/);
});
