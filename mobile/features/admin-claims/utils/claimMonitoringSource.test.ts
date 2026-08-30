import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL as NodeURL } from "node:url";

const screenSource = readFileSync(
  new NodeURL("../screens/ClaimMonitoringScreen.tsx", import.meta.url),
  "utf8",
);

test("Claims uses the canonical Admin audit-log endpoint and query contract", () => {
  assert.match(screenSource, /api\.get\("\/audit-logs",\s*\{/);
  assert.match(screenSource, /entityType:\s*"User"/);
  assert.match(screenSource, /action:\s*"claim_profile"/);
  assert.doesNotMatch(screenSource, /api\.get\("\/audit(?:\?|"|')/);
});

test("Claims distinguishes loading, error with retry, and empty states", () => {
  assert.match(screenSource, /state="loading"/);
  assert.match(screenSource, /state="error"/);
  assert.match(screenSource, /actionLabel="Try Again"/);
  assert.match(screenSource, /onAction=\{retryCurrentTab\}/);
  assert.match(screenSource, /state="empty"/);
  assert.match(screenSource, /No profiles found/);
  assert.match(screenSource, /No claim activity recorded/);
});

test("Claims retries and refreshes only the active data source", () => {
  assert.match(
    screenSource,
    /activeTab === 3 \? refetchAudit\(\) : refetchUsers\(\)/,
  );
  assert.match(screenSource, /if \(activeTab === 3\) \{\s*await refetchAudit\(\)/);
  assert.match(screenSource, /await refetchUsers\(\)/);
});
