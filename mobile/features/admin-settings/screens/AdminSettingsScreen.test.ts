import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const screenSource = readFileSync(
  resolve(currentDirectory, "AdminSettingsScreen.tsx"),
  "utf8",
);
const routeSource = readFileSync(
  resolve(currentDirectory, "../../../app/(admin)/system-settings.tsx"),
  "utf8",
);
const rootLayoutSource = readFileSync(
  resolve(currentDirectory, "../../../app/_layout.tsx"),
  "utf8",
);

test("System Settings omits dormant configuration controls", () => {
  for (const removedControl of [
    "Pregnancy Window Check Days",
    "Max AI Attempts per Cycle",
    "Email Notifications",
    "SMS Alerts",
    "REGISTERED BREED REGISTRY",
    "handleAddBreed",
    "handleRemoveBreed",
  ]) {
    assert.doesNotMatch(screenSource, new RegExp(removedControl));
  }

  assert.doesNotMatch(screenSource, />\s*Save\s*</);
});

test("System Settings no longer reads or writes backend config", () => {
  assert.doesNotMatch(screenSource, /\/config\/settings/);
  assert.doesNotMatch(screenSource, /useApi|useQuery|useMutation/);
  assert.doesNotMatch(screenSource, /admin-system-configs|saveMutation/);
});

test("Dark Mode remains independently persisted", () => {
  assert.match(screenSource, /Dark Mode/);
  assert.match(screenSource, /toggleColorScheme\(\)/);
  assert.match(
    screenSource,
    /AsyncStorage\.setItem\("theme_preference", newScheme\)/,
  );
  assert.match(screenSource, /accessibilityLabel="Dark Mode"/);
});

test("the app still restores theme_preference during startup", () => {
  assert.match(
    rootLayoutSource,
    /AsyncStorage\.getItem\("theme_preference"\)/,
  );
  assert.match(rootLayoutSource, /setColorScheme\(\(savedTheme \|\| "light"\)/);
});

test("the Admin system-settings route still renders the screen", () => {
  assert.match(routeSource, /import AdminSettingsScreen/);
  assert.match(routeSource, /return <AdminSettingsScreen \/>/);
});
