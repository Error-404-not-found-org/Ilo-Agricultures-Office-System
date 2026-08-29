import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const adminAppDirectory = resolve(currentDirectory, "../../../app/(admin)");
const profileSource = readFileSync(
  resolve(adminAppDirectory, "profile.tsx"),
  "utf8",
);
const adminLayoutSource = readFileSync(
  resolve(adminAppDirectory, "_layout.tsx"),
  "utf8",
);
const rootLayoutSource = readFileSync(
  resolve(adminAppDirectory, "../_layout.tsx"),
  "utf8",
);

test("Admin Profile owns the personal Dark Mode preference", () => {
  assert.match(profileSource, />\s*Appearance\s*</);
  assert.match(profileSource, />\s*Dark Mode\s*</);
  assert.match(profileSource, /accessibilityLabel="Dark Mode"/);
  assert.match(profileSource, /useColorScheme\(\)/);

  const immediateThemeUpdate = profileSource.indexOf("toggleColorScheme();");
  const persistedThemeUpdate = profileSource.indexOf(
    'AsyncStorage.setItem("theme_preference", newScheme)',
  );
  assert.ok(immediateThemeUpdate >= 0);
  assert.ok(persistedThemeUpdate > immediateThemeUpdate);
});

test("the persisted theme is still restored during app startup", () => {
  assert.match(
    rootLayoutSource,
    /AsyncStorage\.getItem\("theme_preference"\)/,
  );
  assert.match(rootLayoutSource, /setColorScheme\(\(savedTheme \|\| "light"\)/);
});

test("Admin Profile no longer links to the retired System Settings route", () => {
  assert.doesNotMatch(profileSource, /System Settings|system-settings/);
  assert.doesNotMatch(adminLayoutSource, /system-settings/);
});

test("the empty System Settings route and feature are retired", () => {
  assert.equal(
    existsSync(resolve(adminAppDirectory, "system-settings.tsx")),
    false,
  );
  assert.equal(
    existsSync(
      resolve(
        currentDirectory,
        "../../admin-settings/screens/AdminSettingsScreen.tsx",
      ),
    ),
    false,
  );
});

test("Clerk profile editing and sign-out behavior remain wired", () => {
  assert.match(profileSource, /useClerk\(\)/);
  assert.match(profileSource, /useUser\(\)/);
  assert.match(profileSource, /await user\?\.update\(/);
  assert.match(profileSource, /signOutWithPushCleanup\(api, signOut\)/);
  assert.match(profileSource, /router\.replace\("\/\(auth\)"\)/);
});
