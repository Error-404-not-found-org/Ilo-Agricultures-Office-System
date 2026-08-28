import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const source = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    "notificationPresentation.ts",
  ),
  "utf8",
);

test("Farmer Health notifications retain the exact request detail target", () => {
  assert.match(
    source,
    /pathname:\s*type === "health"\s*\? "\/\(farmer\)\/health-request-detail"/,
  );
  assert.match(source, /params:\s*\{ id: String\(requestId\) \}/);
  assert.match(source, /value\(item, "requestId"\)/);
});
