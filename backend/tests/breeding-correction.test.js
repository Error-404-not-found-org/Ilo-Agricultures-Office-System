import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const routes = fs.readFileSync(
  path.join(root, "src/routes/technician.routes.js"),
  "utf8",
);
const controller = fs.readFileSync(
  path.join(root, "src/controllers/technician.controllers.js"),
  "utf8",
);
const service = fs.readFileSync(
  path.join(root, "src/services/breeding-correction.service.js"),
  "utf8",
);

test("Breeding corrections: pregnancy and calving correction routes are admin-only", () => {
  assert.match(
    routes,
    /patch\([\s\S]*?"\/pregnancy-checks\/:id\/correct"[\s\S]*?requireRole\(\["admin"\]\)[\s\S]*?correctPregnancyCheck/,
  );
  assert.match(
    routes,
    /patch\([\s\S]*?"\/calvings\/:id\/correct"[\s\S]*?requireRole\(\["admin"\]\)[\s\S]*?correctCalving/,
  );
});

test("Breeding corrections: legacy delete endpoints cannot erase official records", () => {
  assert.match(routes, /delete\([\s\S]*?"\/pregnancy-checks\/:id"[\s\S]*?requireRole\(\["admin"\]\)/);
  assert.match(routes, /delete\([\s\S]*?"\/calvings\/:id"[\s\S]*?requireRole\(\["admin"\]\)/);
  assert.match(controller, /OFFICIAL_RECORD_CORRECTION_REQUIRED/);
  assert.doesNotMatch(controller, /Pregnancy\.findByIdAndDelete/);
  assert.doesNotMatch(controller, /Calving\.findByIdAndDelete/);
});

test("Breeding corrections: service updates linked lifecycle data and writes audit logs transactionally", () => {
  assert.match(service, /session\.withTransaction/);
  assert.match(service, /Insemination\.updateOne/);
  assert.match(service, /Animal\.updateOne/);
  assert.match(service, /Animal\.updateMany/);
  assert.match(service, /createAuditLog/);
  assert.match(service, /PREGNANCY_HAS_CALVING/);
  assert.match(service, /CORRECTION_REASON_REQUIRED/);
});
