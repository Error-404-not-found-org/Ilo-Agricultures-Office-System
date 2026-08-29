import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL as NodeURL } from "node:url";

const read = (path: string) =>
  readFileSync(new NodeURL(path, import.meta.url), "utf8");

const directorySource = read("../screens/AdminUsersScreen.tsx");
const directoryHookSource = read("../hooks/useAdminUsers.ts");
const detailSource = read("../screens/UserDetailScreen.tsx");
const detailHookSource = read("../hooks/useUserDetail.ts");
const createSource = read("../screens/CreateUserScreen.tsx");
const createHookSource = read("../hooks/useCreateUser.ts");
const serviceSource = read("../services/adminUsers.service.ts");
const profileSource = read("../../../app/(admin)/profile.tsx");

test("Admin Users exposes only All, Farmer, and Technician role categories", () => {
  assert.doesNotMatch(directorySource, /label="Admins"|handleStatPress\("admin"\)/);
  assert.match(directoryHookSource, /filterOperationalUsers\(users\)/);
  assert.doesNotMatch(directoryHookSource, /admins:\s*number|role === "admin"/);
});

test("active and archived service results are defensively filtered", () => {
  assert.match(serviceSource, /filterOperationalUsers\(res\.data\)/);
  assert.match(serviceSource, /filterOperationalUsers\(res\.data\?\.data\)/);
  assert.match(directoryHookSource, /filterOperationalUsers\(archivedUsers\)/);
});

test("Create User cannot offer or submit Administrator", () => {
  assert.match(createSource, /const ROLES = \['farmer', 'technician'\] as const/);
  assert.doesNotMatch(createSource, /label: 'Administrator'/);
  assert.doesNotMatch(createHookSource, /'farmer' \| 'technician' \| 'admin'/);
  assert.match(serviceSource, /role: OperationalUserRole/);
});

test("direct Admin detail targets cannot reach any operational action", () => {
  const guardIndex = detailSource.indexOf("if (!isOperationalUser(user))");
  const actionsIndex = detailSource.indexOf("Administrative Actions");
  const actionLabels = [
    "Suspend Account",
    "Reactivate Account",
    "Verify Account Credentials",
    "Reset User Password",
    "Change Account Role",
    "Delete Account Profile",
  ];

  assert.ok(guardIndex >= 0);
  assert.ok(actionsIndex > guardIndex);
  actionLabels.forEach((label) => {
    assert.ok(detailSource.indexOf(label) > guardIndex);
  });
  assert.match(detailSource, /Account not manageable here/);
  assert.match(detailSource, /router\.replace\("\/\(admin\)\/\(tabs\)\/admin\.users"/);
  assert.match(detailSource, /OPERATIONAL_USER_ROLES\.map/);
  assert.match(detailHookSource, /if \(!canManageUser\(\)\) return/);
});

test("Admin self-profile remains Clerk-backed and separate", () => {
  assert.match(profileSource, /useClerk, useUser/);
  assert.match(profileSource, /await user\?\.update/);
  assert.doesNotMatch(profileSource, /useUserDetail|updateRole|suspendUser/);
});
