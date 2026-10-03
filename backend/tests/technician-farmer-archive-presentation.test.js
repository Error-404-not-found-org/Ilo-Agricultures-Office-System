import test from "node:test";
import assert from "node:assert/strict";
import { toTechnicianFarmerDirectoryEntry } from "../src/controllers/user.controllers.js";

test("Technician Farmer presentation exposes archive eligibility without Clerk identifiers", () => {
  const base = { _id: "507f1f77bcf86cd799439012", role: "farmer", deletedAt: null };
  const unused = toTechnicianFarmerDirectoryEntry({ ...base, profileClaimStatus: "unclaimed", clerkId: "manual_123" });
  const claimed = toTechnicianFarmerDirectoryEntry({ ...base, profileClaimStatus: "claimed", clerkId: "user_123" });
  const linked = toTechnicianFarmerDirectoryEntry({ ...base, profileClaimStatus: "unclaimed", clerkId: "user_456" });
  assert.equal(unused.canTechnicianArchive, true);
  assert.equal(claimed.canTechnicianArchive, false);
  assert.equal(linked.canTechnicianArchive, false);
  assert.equal("clerkId" in unused, false);
});
