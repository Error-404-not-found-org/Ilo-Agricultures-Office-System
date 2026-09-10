import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(path, "utf8");

describe("Admin Technician roster retirement source safety", () => {
  it("keeps Users as the only top-level People destination", () => {
    const sidebar = read("src/components/layout/Sidebar.jsx");

    expect(sidebar).toContain('path: "/admin/users"');
    expect(sidebar).not.toContain('path: "/admin/technicians"');
  });

  it("redirects only the exact roster route and preserves the detail route", () => {
    const app = read("src/App.jsx");

    expect(app).toContain('path="technicians"');
    expect(app).toContain(
      '<Navigate to="/admin/users?role=technician" replace />',
    );
    expect(app).toContain('path="technicians/:id"');
    expect(app).toContain('path="users/:id"');
    expect(app).toContain("<UserDetails />");
    expect(app).not.toContain(
      'lazy(() => import("./pages/admin/Technicians"))',
    );
  });

  it("points Dashboard roster intent at canonical Technician Users mode", () => {
    const dashboard = read("src/pages/admin/Dashboard.jsx");

    expect(dashboard).toContain('to: "/admin/users?role=technician"');
    expect(dashboard).not.toContain('to: "/admin/technicians"');
  });

  it("keeps the retired roster implementation absent", () => {
    expect(existsSync("src/pages/admin/Technicians.jsx")).toBe(false);
    expect(existsSync("src/pages/admin/TechniciansPhase3B.test.jsx")).toBe(false);
  });
});
