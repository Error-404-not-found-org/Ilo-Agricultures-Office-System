import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import adminRouter from "../src/routes/admin.routes.js";

const readSource = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("legacy Admin monitoring route is retired while supported Admin routes remain", async () => {
  const registeredPaths = adminRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route.path);
  const routes = await readSource("../src/routes/admin.routes.js");

  assert.equal(registeredPaths.includes("/monitoring"), false);
  assert.equal(routes.includes("getSystemMonitoringData"), false);
  assert.equal(registeredPaths.includes("/technician-workload-summary"), true);
  assert.equal(registeredPaths.includes("/backup"), true);
});

test("synthetic monitoring controller contract is removed", async () => {
  const controller = await readSource("../src/controllers/admin.controllers.js");

  for (const retiredMarker of [
    "getSystemMonitoringData",
    "systemHealth:",
    "registryMonitor:",
    "backupMonitor:",
    "moowieInsights:",
    "Simulated Failed Sync Alert",
  ]) {
    assert.equal(controller.includes(retiredMarker), false, retiredMarker);
  }
});

test("production clients no longer call monitoring and supported replacements remain", async () => {
  const [dashboard, mobileService, mobileDashboard] = await Promise.all([
    readSource("../../web/src/pages/admin/Dashboard.jsx"),
    readSource(
      "../../mobile/features/admin-dashboard/services/adminDashboard.service.ts",
    ),
    readSource(
      "../../mobile/features/admin-dashboard/hooks/useAdminDashboard.ts",
    ),
  ]);

  assert.equal(dashboard.includes("/admin/monitoring"), false);
  assert.equal(
    dashboard.includes("/admin/technician-workload-summary"),
    true,
  );
  assert.equal(mobileService.includes("/admin/monitoring"), false);
  assert.equal(mobileService.includes("getAdminMonitoringData"), false);
  assert.equal(mobileDashboard.includes("getAdminMonitoringData"), false);
});
