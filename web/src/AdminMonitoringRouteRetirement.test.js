import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(path, "utf8");

describe("Admin Monitoring route retirement source safety", () => {
  it("removes the hidden Web Admin Monitoring destination", () => {
    const app = read("src/App.jsx");

    expect(app).not.toContain("AdminMonitoring");
    expect(app).not.toContain('import("./pages/admin/Monitoring")');
    expect(app).not.toContain('path="monitoring"');
    expect(existsSync("src/pages/admin/Monitoring.jsx")).toBe(false);
  });

  it("detaches Dashboard workload from the broad monitoring endpoint", () => {
    const dashboard = read("src/pages/admin/Dashboard.jsx");

    expect(dashboard).toContain(
      'axiosInstance.get("/admin/technician-workload-summary")',
    );
    expect(dashboard).not.toContain('axiosInstance.get("/admin/monitoring")');
    expect(dashboard).not.toContain("technicianWorkloads");
  });

  it("removes the broad backend endpoint while preserving its canonical replacements", () => {
    const routes = read("../backend/src/routes/admin.routes.js");
    const controller = read("../backend/src/controllers/admin.controllers.js");

    expect(routes).not.toContain('router.get("/monitoring"');
    expect(routes).not.toContain("getSystemMonitoringData");
    expect(controller).not.toContain("getSystemMonitoringData");
    expect(routes).toContain(
      'router.get("/technician-workload-summary", getTechnicianWorkloadSummary)',
    );
    expect(routes).toContain(
      'router.get("/backup", systemDataExportLimiter, exportDatabaseBackup)',
    );
  });
});
