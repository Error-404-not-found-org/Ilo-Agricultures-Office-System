import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const source = (relativePath: string) =>
  readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url).href),
    "utf8",
  );

test("Animal Details refetches its authoritative animal query on focus", () => {
  const screen = source("../screens/RoleAwareAnimalDetailsScreen.tsx");
  assert.match(screen, /useFocusEffect/);
  assert.match(screen, /refetchAnimal/);
});

test("Farmer Home refetches milestones when revisited", () => {
  const screen = source(
    "../../farmer-dashboard/screens/FarmerHomeScreen.tsx",
  );
  assert.match(screen, /useFocusEffect/);
  assert.match(screen, /refetchMilestones/);
});
