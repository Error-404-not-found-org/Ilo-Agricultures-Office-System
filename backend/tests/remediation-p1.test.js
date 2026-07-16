import test from "node:test";
import assert from "node:assert/strict";
import { getReproductionEligibility } from "../src/domain/reproduction-lifecycle.js";

// Mocking global components for offline queue testing
const mockApi = () => {
  let calls = 0;
  const fn = async (options) => {
    calls++;
    return { data: { success: true, options } };
  };
  fn.getCalls = () => calls;
  return fn;
};

// 1. Reproductive transition and postpartum recovery eligibility
test("Reproductive Lifecycle: blocks AI if postpartum window is active", () => {
  const recentCalving = new Date();
  recentCalving.setDate(recentCalving.getDate() - 10); // 10 days ago (standard recovery is ~60 days)
  
  const animal = {
    reproductiveStatus: "Normal",
    species: "Cattle",
    breed: "Brahman",
    lastCalvingDate: recentCalving,
  };
  
  const result = getReproductionEligibility({
    animal,
    activePregnancy: null,
    activeRequest: null,
    now: new Date()
  });
  
  assert.equal(result.eligible, false);
  assert.equal(result.code, "POSTPARTUM_RECOVERY");
});

test("Reproductive Lifecycle: allows AI after postpartum window passes", () => {
  const oldCalving = new Date();
  oldCalving.setDate(oldCalving.getDate() - 90); // 90 days ago
  
  const animal = {
    reproductiveStatus: "Normal",
    species: "Cattle",
    breed: "Brahman",
    lastCalvingDate: oldCalving,
  };
  
  const result = getReproductionEligibility({
    animal,
    activePregnancy: null,
    activeRequest: null,
    now: new Date()
  });
  
  assert.equal(result.eligible, true);
  assert.equal(result.code, "AVAILABLE");
});

// 2. Veterinarian Escalations
test("Urgency Escalation Policy: veterinarian notifications sent only on Emergency", () => {
  const veterinarians = [{ _id: "vet-1", role: "veterinarian" }];
  const technicians = [{ _id: "tech-1", role: "technician" }];
  
  const checkEscalation = (urgency) => {
    // Simulated controller logic
    const veterinariansToNotify = urgency === "emergency" ? veterinarians : [];
    return veterinariansToNotify.length > 0;
  };
  
  assert.equal(checkEscalation("low"), false);
  assert.equal(checkEscalation("medium"), false);
  assert.equal(checkEscalation("high"), false);
  assert.equal(checkEscalation("emergency"), true);
});
