import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(path, "utf8");

const normalizedAdminFiles = [
  "src/pages/admin/ArchivedRecords.jsx",
  "src/pages/admin/AuditLogs.jsx",
  "src/pages/admin/BarangayInsights.jsx",
  "src/pages/admin/Dashboard.jsx",
  "src/pages/admin/Inseminations.jsx",
  "src/pages/admin/Livestock.jsx",
  "src/pages/admin/Monitoring.jsx",
  "src/pages/admin/Reports.jsx",
  "src/pages/admin/Settings.jsx",
  "src/pages/admin/SupportTickets.jsx",
  "src/pages/admin/TechnicianProfile.jsx",
  "src/pages/admin/Technicians.jsx",
  "src/pages/admin/Users.jsx",
  "src/components/layout/Sidebar.jsx",
  "src/components/layout/Topbar.jsx",
  "src/components/dialogs/AdminRequestActions.jsx",
  "src/components/dialogs/ActivityDetailsModal.jsx",
  "src/components/dialogs/RequestActionModal.jsx",
];

const deprecatedPalettePattern =
  /#[0-9a-f]{3,8}\b|(?:bg|text|border|ring|outline|from|to|via)-(?:green|emerald|lime|teal|blue|purple|indigo|orange|amber|red|rose|gray|slate|zinc)-\d+/i;

describe("Admin semantic palette consistency", () => {
  it("keeps the BreedSmart theme as the single palette source", () => {
    const theme = read("src/index.css");

    expect(theme).toContain("--color-primary: #00643b");
    expect(theme).toContain("--color-base-100:");
    expect(theme).toContain("--color-base-200:");
    expect(theme).toContain("--color-base-300:");
    expect(theme).toContain("--color-success:");
    expect(theme).toContain("--color-warning:");
    expect(theme).toContain("--color-error:");
    expect(theme).toContain("--color-info:");
  });

  it.each(normalizedAdminFiles)(
    "does not reintroduce page-specific palette classes in %s",
    (path) => {
      expect(read(path)).not.toMatch(deprecatedPalettePattern);
    },
  );

  it("uses consistent primary button variants for principal Admin actions", () => {
    expect(read("src/pages/admin/Technicians.jsx")).toContain(
      'className="btn btn-primary btn-sm"',
    );
    expect(read("src/pages/admin/Settings.jsx")).toContain(
      'className="btn btn-primary btn-sm"',
    );
    expect(read("src/pages/admin/Reports.jsx")).toContain(
      'className="btn btn-primary btn-sm"',
    );
  });

  it("keeps the Technician roster readable and restores profile avatars", () => {
    const technicians = read("src/pages/admin/Technicians.jsx");

    expect(technicians).toContain('import UserAvatar from "../../components/ui/UserAvatar"');
    expect(technicians).toContain("<UserAvatar");
    expect(technicians).toContain("tech.imageUrl || tech.profileImage");
    expect(technicians).toContain('className="rounded-full"');
    expect(technicians).toContain("text-base-content/90");
  });

  it("preserves the Dashboard and Sidebar structures", () => {
    const dashboard = read("src/pages/admin/Dashboard.jsx");
    const sidebar = read("src/components/layout/Sidebar.jsx");

    expect(dashboard.indexOf('title="Needs Attention"')).toBeLessThan(
      dashboard.indexOf('title="Pending Requests"'),
    );
    expect(dashboard).toContain('title="Technician Workload"');
    expect(dashboard).toContain('title="Recent Admin Activity"');
    expect(dashboard).not.toContain('title="Barangays Needing Attention"');
    expect(sidebar).toContain("ADMIN_GROUPS");
    expect(sidebar).toContain("admin-service-records-menu");
  });
});
