import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireRole } from "../src/middleware/auth.middleware.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routeFile = (relativePath) =>
  fs.readFileSync(path.join(__dirname, "..", "src", "routes", relativePath), "utf8");

const runRoleGuard = (roles, userRole) => {
  let statusCode = null;
  let payload = null;
  let nextCalled = false;
  const req = { user: userRole ? { role: userRole } : null };
  const res = {
    status(code) {
      statusCode = code;
      return {
        json(data) {
          payload = data;
        },
      };
    },
  };

  requireRole(roles)(req, res, () => {
    nextCalled = true;
  });

  return { nextCalled, statusCode, payload };
};

test("Route Security: insemination no-auth test route is not registered", () => {
  const source = routeFile("insemination.routes.js");
  assert.equal(source.includes("test-no-auth"), false);
});

test("Route Security: analytics heatmap and trends routes require authentication", () => {
  const source = routeFile("analytics.routes.js");
  assert.match(source, /router\.get\("\/heatmap",\s*protectedRoute,\s*requireRole/);
  assert.match(source, /router\.get\("\/trends",\s*protectedRoute,\s*requireRole/);
});

test("Route Security: GIS routes are protected by role middleware", () => {
  const source = routeFile("gis.routes.js");
  assert.match(source, /router\.use\(protectedRoute,\s*requireRole/);
});

test("Route Security: cleanup routes are admin-only", () => {
  const source = routeFile("technician.routes.js");
  assert.match(source, /router\.get\("\/cleanup-survey",\s*requireRole\(\["admin"\]\)/);
  assert.match(source, /router\.post\("\/cleanup-execute",\s*requireRole\(\["admin"\]\)/);
});

test("Route Security: admin can access task endpoints", () => {
  const allowed = runRoleGuard(["admin", "technician"], "admin");
  assert.equal(allowed.nextCalled, true);
  assert.equal(allowed.statusCode, null);

  const blocked = runRoleGuard(["admin", "technician"], "farmer");
  assert.equal(blocked.nextCalled, false);
  assert.equal(blocked.statusCode, 403);
  assert.match(blocked.payload.message, /Forbidden/);
});

test("Route Security: support ticket admin routes are protected", () => {
  const source = routeFile("support-ticket.routes.js");
  assert.match(source, /router\.post\("\/",\s*protectedRoute,\s*createSupportTicket\)/);
  assert.match(source, /router\.get\("\/",\s*protectedRoute,\s*requireRole\(\["admin"\]\)/);
  assert.match(source, /router\.patch\("\/:id\/status",\s*protectedRoute,\s*requireRole\(\["admin"\]\)/);
});

test("Route Security: audit log routes are admin-only", () => {
  const source = routeFile("audit.routes.js");
  assert.match(source, /router\.use\(protectedRoute,\s*requireRole\(\["admin"\]\)\)/);
});

test("Route Security: archived users route is registered before dynamic user id route", () => {
  const source = routeFile("user.routes.js");
  const archivedIndex = source.indexOf('router.get("/archived"');
  const dynamicIndex = source.indexOf('router.get("/:id"');
  assert.ok(archivedIndex > -1);
  assert.ok(dynamicIndex > -1);
  assert.ok(archivedIndex < dynamicIndex);
});
