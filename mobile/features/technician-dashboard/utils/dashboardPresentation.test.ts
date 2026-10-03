import assert from "node:assert/strict";
import test from "node:test";

import { getTechnicianDashboardRequestServiceLabel as serviceLabel } from "./dashboardPresentation.ts";

test("Technician Home uses the Health request category label", () => {
  assert.equal(serviceLabel({ type: "health", serviceType: "disease" }), "Sick or Injured Animal");
  assert.equal(serviceLabel({ type: "health", serviceType: "health_concern" }), "Sick or Injured Animal");
  assert.equal(serviceLabel({ type: "health", serviceType: "medicine" }), "Medicine or Dewormer");
});

test("Technician Home keeps non-Health request labels and safe Health fallback", () => {
  assert.equal(serviceLabel({ type: "health" }), "Health Assistance");
  assert.equal(serviceLabel({ type: "breeding_verification" }), "Pregnancy Check");
  assert.equal(serviceLabel({ type: "ai" }), "Artificial Insemination");
});
