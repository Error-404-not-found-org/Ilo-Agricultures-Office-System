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

  it("preserves the Dashboard monitoring dependency for its later migration", () => {
    const dashboard = read("src/pages/admin/Dashboard.jsx");

    expect(dashboard).toContain('axiosInstance.get("/admin/monitoring")');
    expect(dashboard).toContain("technicianWorkloads");
  });

  it("keeps the backend monitoring endpoint registered", () => {
    const routes = read("../backend/src/routes/admin.routes.js");
    const controller = read("../backend/src/controllers/admin.controllers.js");

    expect(routes).toContain('router.get("/monitoring", getSystemMonitoringData)');
    expect(controller).toContain(
      "export const getSystemMonitoringData = async (req, res) =>",
    );
  });
});
