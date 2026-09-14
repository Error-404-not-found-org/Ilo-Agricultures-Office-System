import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("walk-in Health manual Farmer creation does not require a phone", () => {
  const source = readFileSync(
    new URL("../src/controllers/health-request.controllers.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /!farmerId && \(!phoneNumber \|\| !animalDetails\?\.earTag\)/);
  assert.match(source, /!farmerId && !animalDetails\?\.earTag/);
});
