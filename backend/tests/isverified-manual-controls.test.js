import test from "node:test";
import assert from "node:assert/strict";
import adminRoutes from "../src/routes/admin.routes.js";
import technicianRoutes from "../src/routes/technician.routes.js";
import userRoutes from "../src/routes/user.routes.js";
import { syncUser } from "../src/controllers/user.controllers.js";

const hasRoute = (router, method, path) => router.stack.some(
  (layer) => layer.route?.path === path && layer.route.methods[method],
);

test("manual Admin and Technician verification endpoints are unavailable", () => {
  assert.equal(hasRoute(adminRoutes, "post", "/verify-user"), false);
  assert.equal(hasRoute(technicianRoutes, "patch", "/farmers/:id/verify"), false);
  assert.equal(hasRoute(userRoutes, "post", "/mark-verified"), false);
});

test("sync-manual returns the canonical protected-route identity without mutating it", async () => {
  const user = { _id: "user-1", role: "farmer", isVerified: false, profileClaimStatus: "unclaimed" };
  const response = { status(code) { assert.equal(code, 200); return this; }, json(payload) { this.payload = payload; } };
  await syncUser({ user }, response);
  assert.equal(response.payload.user, user);
  assert.equal(user.isVerified, false);
  assert.equal(user.profileClaimStatus, "unclaimed");
});
