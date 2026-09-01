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
    expect(requests).not.toContain("actionPolicy.canComplete");
    expect(requests).toContain("actionPolicy.canCancelOwnRequest");
    expect(requestDialog).toContain("<AdminRequestActions");
    expect(requestDialog).toContain("if (!actionPolicy.isTechnician) return;");
    expect(adminActions).toContain("Reassign to");
    expect(adminActions).toContain("Cancellation review");
    expect(adminActions).not.toContain("Start visit");
    expect(adminActions).not.toContain("Complete");
    expect(adminActions).not.toContain("Claim");
  });

  it("keeps Admin oversight while simplifying Technician Requests", () => {
    const requests = read("src/pages/technician/Requests.jsx");
    const adminFilters = requests.slice(
      requests.indexOf("{/* Admin request filters */}"),
      requests.indexOf("{/* Technician request filters */}"),
    );
    const technicianFilters = requests.slice(
      requests.indexOf("{/* Technician request filters */}"),
      requests.indexOf("{/* Main request list */}"),
    );

    expect(requests).not.toContain("requests-stats-background");
    expect(requests).not.toContain("Request Summary");
    expect(requests).not.toContain("Claimed Requests");
    expect(requests).toContain("<AdminRequestCards");
    expect(adminFilters).toContain('aria-label="Search service requests"');
    expect(adminFilters).toContain('aria-label="Request status"');
    expect(adminFilters).toContain('aria-label="Service type"');
    expect(adminFilters).not.toContain('aria-label="Assigned Technician"');
    expect(adminFilters).toContain('lg:flex-[1_1_45%]');
    expect(adminFilters).not.toContain('aria-label="Urgency"');
    expect(adminFilters).not.toContain('aria-label="Municipality"');
    expect(adminFilters).not.toContain('aria-label="Barangay"');
    expect(adminFilters).not.toContain('aria-label="Sort order"');
    expect(adminFilters).not.toContain("Near me");
    expect(adminFilters).not.toContain("Filter requests");
    expect(technicianFilters).toContain('aria-label="Request ownership"');
    expect(technicianFilters).toContain('aria-label="Request type"');
    expect(technicianFilters).toContain('aria-label="Health urgency"');
    expect(technicianFilters).not.toContain('aria-label="Municipality"');
    expect(technicianFilters).not.toContain('aria-label="Barangay"');
    expect(technicianFilters).not.toContain('aria-label="Sort order"');
    expect(technicianFilters).not.toContain("Near me");
    expect(requests).toContain("search: searchQuery || undefined");
    expect(requests).toContain("assignedTechnicianId:");
    expect(requests).toContain("includeOperationalTasks: false");
    expect(requests).toContain(
      "queueData?.pagination?.total || requests.length",
    );
    expect(requests).toContain("onViewRequest={openRequest}");
  });

  it("keeps operational Pregnancy tasks out of all Requests surfaces", () => {
    const requests = read("src/pages/technician/Requests.jsx");

    expect(requests).toContain("includeOperationalTasks: false");
    expect(requests).toContain('isAdmin ? "admin" : "technician"');
    expect(requests).toContain('<option value="ai">AI Services</option>');
    expect(requests).toContain(
      '<option value="health">Health Assistance</option>',
    );
  });

  it("keeps the Admin Dashboard navigation-only", () => {
    const dashboard = read("src/pages/admin/Dashboard.jsx");
    const app = read("src/App.jsx");
    const sidebar = read("src/components/layout/Sidebar.jsx");

    expect(dashboard).not.toContain("AssignTaskModal");
    expect(dashboard).not.toContain("reassignRequest");
    expect(dashboard).not.toContain("/health-request/");
    expect(dashboard).not.toContain("/ai-request/");
    expect(dashboard).not.toContain("/admin/requests?requestId=");
    expect(dashboard).not.toContain("/admin/requests?status=all");
    expect(dashboard).toContain('to="/admin/work-queue"');
    expect(dashboard).toContain('to="/admin/audit-logs"');
    expect(sidebar).toContain('path: "/admin/requests"');
    expect(dashboard).not.toContain('to="/admin/barangays"');
    expect(app).toContain('<Route path="barangays" element={<BarangayInsights />} />');
    expect(sidebar).toContain('path: "/admin/barangays"');
  });
});
