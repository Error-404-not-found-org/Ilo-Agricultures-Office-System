import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL as NodeURL } from "node:url";

const readSource = (relativePath: string) =>
  readFileSync(new NodeURL(relativePath, import.meta.url), "utf8");

test("dedicated Claims navigation is retired without leaving a dead deep link", () => {
  const dashboardSource = readSource(
    "../../admin-dashboard/screens/AdminDashboardScreen.tsx",
  );
  const notificationsSource = readSource(
    "../../admin-notifications/screens/AdminNotificationsScreen.tsx",
  );
  const layoutSource = readSource("../../../app/(admin)/_layout.tsx");
  const compatibilityRoute = readSource(
    "../../../app/(admin)/claim-monitoring.tsx",
  );

  assert.doesNotMatch(dashboardSource, /claim-monitoring|title="Claims"/);
  assert.doesNotMatch(notificationsSource, /claim-monitoring/);
  assert.doesNotMatch(layoutSource, /name="claim-monitoring"/);
  assert.match(compatibilityRoute, /Redirect/);
  assert.match(compatibilityRoute, /admin\.users/);
});

test("claim conflict alerts lead to the matching Users search", () => {
  const notificationsSource = readSource(
    "../../admin-notifications/screens/AdminNotificationsScreen.tsx",
  );

  assert.match(notificationsSource, /admin\.users/);
  assert.match(notificationsSource, /params:\s*\{\s*search:\s*phone\s*\}/);
});

test("Audit Logs remains reachable from the Admin dashboard activity surface", () => {
  const activitySource = readSource(
    "../../admin-dashboard/components/ActivityTimeline.tsx",
  );

  assert.match(activitySource, /\/\(admin\)\/audit-logs/);
});

test("Users claim presentation does not invent installation or invitation state", () => {
  const presentationSource = readSource("./dispatchPresentation.ts");
  const usersSource = readSource("../screens/AdminUsersScreen.tsx");
  const detailSource = readSource("../screens/UserDetailScreen.tsx");

  assert.doesNotMatch(presentationSource, /App Installed/);
  assert.doesNotMatch(presentationSource, /Invitation pending/);
  assert.match(presentationSource, /Profile Claimed/);
  assert.match(presentationSource, /Not Claimed/);
  assert.match(presentationSource, /Claim Blocked/);
  assert.match(usersSource, /getProfileClaimStatePresentation\(item\)/);
  assert.match(usersSource, /isProfileUnclaimed/);
  assert.match(usersSource, /isProfileUnclaimed \? \(/);
  assert.match(usersSource, /!isProfileUnclaimed && \(/);
  assert.match(detailSource, /getProfileClaimStatePresentation\(user\)/);
});
