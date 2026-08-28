import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(path, "utf8");

describe("Admin page responsibility composition", () => {
  it("passes explicit roles into shared Requests and Livestock routes", () => {
    const app = read("src/App.jsx");

    expect(app).toContain('<LivestockProfile role="admin" />');
    expect(app).toContain('<TechnicianRequests role="admin" />');
    expect(app).toContain('<LivestockProfile role="technician" />');
    expect(app).toContain('<TechnicianRequests role="technician" />');
  });

  it("removes pathname-driven responsibility checks from shared pages", () => {
    const requests = read("src/pages/technician/Requests.jsx");
    const livestock = read("src/pages/admin/LivestockProfile.jsx");

    expect(requests).not.toContain("window.location");
    expect(requests).not.toContain('startsWith("/admin")');
    expect(livestock).not.toContain("window.location");
    expect(livestock).not.toContain('startsWith("/admin")');
  });

  it("isolates Admin request controls from Technician execution", () => {
    const requests = read("src/pages/technician/Requests.jsx");
    const requestDialog = read(
      "src/components/dialogs/RequestActionModal.jsx",
    );
    const adminActions = read(
      "src/components/dialogs/AdminRequestActions.jsx",
    );

    expect(requests).toContain("actionPolicy.canClaim");
    expect(requests).toContain("actionPolicy.canComplete");
    expect(requests).toContain("actionPolicy.canCancelOwnRequest");
    expect(requestDialog).toContain("<AdminRequestActions");
    expect(requestDialog).toContain("if (!actionPolicy.isTechnician) return;");
    expect(adminActions).toContain("Reassign to");
    expect(adminActions).toContain("Cancellation review");
    expect(adminActions).not.toContain("Start visit");
    expect(adminActions).not.toContain("Complete");
    expect(adminActions).not.toContain("Claim");
  });

  it("keeps the Admin Dashboard navigation-only", () => {
    const dashboard = read("src/pages/admin/Dashboard.jsx");
    const app = read("src/App.jsx");
    const sidebar = read("src/components/layout/Sidebar.jsx");

    expect(dashboard).not.toContain("AssignTaskModal");
    expect(dashboard).not.toContain("reassignRequest");
    expect(dashboard).not.toContain("/health-request/");
    expect(dashboard).not.toContain("/ai-request/");
    expect(dashboard).toContain("/admin/requests?requestId=");
    expect(dashboard).toContain("/admin/requests?status=all");
    expect(dashboard).toContain('to="/admin/work-queue"');
    expect(dashboard).toContain('to="/admin/audit-logs"');
    expect(dashboard).not.toContain('to="/admin/barangays"');
    expect(app).toContain('<Route path="barangays" element={<BarangayInsights />} />');
    expect(sidebar).toContain('path: "/admin/barangays"');
  });
});
