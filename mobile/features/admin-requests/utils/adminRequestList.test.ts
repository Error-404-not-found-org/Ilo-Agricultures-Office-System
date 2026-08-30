import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL as NodeURL } from "node:url";
import {
  ACTIVE_AI_REQUEST_STATUSES,
  ACTIVE_HEALTH_REQUEST_STATUSES,
  buildActiveRequestUrl,
  matchesAdminRequestStatus,
} from "./adminRequestList.ts";

const screen = readFileSync(
  new NodeURL("../screens/RequestMonitoringScreen.tsx", import.meta.url),
  "utf8",
);

test("active request queries exclude terminal AI and Health statuses", () => {
  assert.deepEqual(
    ACTIVE_AI_REQUEST_STATUSES.filter((status) =>
      ["done", "rejected", "cancelled"].includes(status),
    ),
    [],
  );
  assert.deepEqual(
    ACTIVE_HEALTH_REQUEST_STATUSES.filter((status) =>
      ["resolved", "rejected", "cancelled"].includes(status),
    ),
    [],
  );

  const aiUrl = buildActiveRequestUrl(
    "/ai-request",
    ACTIVE_AI_REQUEST_STATUSES,
  );
  const healthUrl = buildActiveRequestUrl(
    "/health-request",
    ACTIVE_HEALTH_REQUEST_STATUSES,
  );

  assert.match(aiUrl, /status=pending/);
  assert.match(aiUrl, /status=in-progress/);
  assert.doesNotMatch(aiUrl, /status=done|status=cancelled/);
  assert.match(healthUrl, /status=triaged/);
  assert.match(healthUrl, /status=in_progress/);
  assert.doesNotMatch(healthUrl, /status=resolved|status=cancelled/);
});

test("status filters preserve canonical and compatibility semantics", () => {
  assert.equal(matchesAdminRequestStatus("ai", "submitted", "pending"), true);
  assert.equal(matchesAdminRequestStatus("ai", "accepted", "assigned"), true);
  assert.equal(
    matchesAdminRequestStatus("ai", "awaiting-service", "scheduled"),
    true,
  );
  assert.equal(
    matchesAdminRequestStatus("health", "in_progress", "in-progress"),
    true,
  );
  assert.equal(matchesAdminRequestStatus("health", "resolved", "all"), true);
  assert.equal(
    matchesAdminRequestStatus("health", "resolved", "in-progress"),
    false,
  );
});

test("Admin Requests uses the simplified oversight hierarchy", () => {
  assert.match(screen, />\s*Requests\s*</);
  assert.match(
    screen,
    /const TABS = \["Active", "AI", "Health", "Cancellations"\]/,
  );
  assert.match(screen, /Search farmer or animal\.\.\./);
  assert.match(screen, /label="Status"/);
  assert.match(screen, /technicianName/);
  assert.doesNotMatch(screen, /label="Technician"|techFilter|techOptions/);
  assert.doesNotMatch(screen, /Service Requests Monitoring|URGENCY_OPTIONS/);
  assert.doesNotMatch(screen, /Near me|Municipality|Barangay/);
});
