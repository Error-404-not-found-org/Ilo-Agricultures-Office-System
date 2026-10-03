import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const backendRoot = path.dirname(fileURLToPath(import.meta.url));
const excluded = new Set([
  "calving-notification.test.js", // Requires a configured target database.
  "check-indexes.test.js", // Operational database probe.
  "historical-ai.test.js", // Uses Vitest, not Node's test runner.
]);
const files = readdirSync(path.join(backendRoot, "tests"))
  .filter((name) => name.endsWith(".test.js") && !excluded.has(name))
  .sort()
  .map((name) => path.join("tests", name));

const result = spawnSync(
  process.execPath,
  ["--test", "--test-concurrency=1", ...files],
  { cwd: backendRoot, stdio: "inherit" },
);

if (result.error) {
  console.error("Unable to start deterministic Backend tests:", result.error.message);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
