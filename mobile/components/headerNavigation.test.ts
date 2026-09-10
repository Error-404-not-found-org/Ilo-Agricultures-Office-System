import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { getHeaderSyncDestination } from "./headerNavigation.ts";

const headerSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "Header.tsx"),
  "utf8",
);

test("Technician Header opens Technician sync history", () => {
  assert.equal(
    getHeaderSyncDestination(["(technician)", "(tabs)"]),
    "/(technician)/sync-history",
  );
});

test("Admin Header never exposes a Technician sync destination", () => {
  assert.equal(
    getHeaderSyncDestination(["(admin)", "(tabs)"]),
    null,
  );
});

test("Farmer Header uses the existing Farmer sync center", () => {
  assert.equal(
    getHeaderSyncDestination(["(farmer)", "(tabs)"]),
    "/(farmer)/sync-center",
  );
});

test("unknown route groups do not expose a cross-role sync route", () => {
  assert.equal(getHeaderSyncDestination(["(auth)"]), null);
});

test("Header renders and navigates through the role-aware destination", () => {
  assert.match(
    headerSource,
    /syncDestination = getHeaderSyncDestination\(routeSegments\)/,
  );
  assert.match(headerSource, /\{syncDestination \? \(/);
  assert.match(headerSource, /router\.push\(syncDestination\)/);
  assert.doesNotMatch(
    headerSource,
    /onPress=\{\(\) => router\.push\("\/\(technician\)\/sync-history"/,
  );
});
