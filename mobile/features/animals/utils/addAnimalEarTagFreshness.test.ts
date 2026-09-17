import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const screen = fs.readFileSync(
  path.join(import.meta.dirname, "../screens/AddAnimalScreen.tsx"),
  "utf8",
);

test("Add Animal refreshes the Farmer herd before generating an ear tag", () => {
  assert.match(screen, /useFocusEffect/);
  assert.match(screen, /void refetchAnimals\(\)/);
  assert.match(screen, /disabled=\{animalsRefreshing\}/);
});

test("Add Animal loads every available herd page for tag generation", () => {
  assert.match(screen, /hasNextAnimalsPage/);
  assert.match(screen, /void fetchNextAnimalsPage\(\)/);
});
