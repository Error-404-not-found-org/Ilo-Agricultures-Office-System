import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const details = [
  resolve(directory, "../components/AIRequestDetails.tsx"),
  resolve(
    directory,
    "../../technician-health-request/components/HealthRequestDetails.tsx",
  ),
];

for (const path of details) {
  const source = readFileSync(path, "utf8");
  const kind = path.includes("AIRequestDetails") ? "AI" : "Health";

  test(`${kind} details offer Skip Request only for an available request`, () => {
    assert.match(
      source,
      /const isAvailable = normalizedStatus === "pending" && !isOwned;/,
    );
    assert.ok(
      /\{isAvailable \? \(\s*<TouchableOpacity[\s\S]*?accessibilityRole="button"[\s\S]*?accessibilityLabel="Skip Request"[\s\S]*?onPress=\{\(\) => setSkipConfirmationVisible\(true\)\}/.test(source),
      "available-request action opens the existing Skip confirmation",
    );
  });

  test(`${kind} Skip Request keeps the existing confirmation and handler`, () => {
    assert.match(source, /visible=\{skipConfirmationVisible\}/);
    assert.match(source, /confirmText="Skip Request"/);
    assert.match(source, /onConfirm=\{handleDecline\}/);
    assert.match(source, /await declineTechnicianRequest\(/);
  });
}
