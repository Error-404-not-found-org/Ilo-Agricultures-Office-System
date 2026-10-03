import assert from "node:assert/strict";
import test from "node:test";

import { getDashboardWorkPreview } from "./dashboardWorkPreview.ts";

test("small work sets display every item without an overflow indicator", () => {
  for (const count of [0, 1, 3]) {
    const items = Array.from({ length: count }, (_, index) => index);
    assert.deepEqual(getDashboardWorkPreview(items), {
      previewItems: items,
      total: count,
      hasMoreWork: false,
    });
  }
});

test("five actionable items retain their total while previewing three", () => {
  assert.deepEqual(getDashboardWorkPreview([1, 2, 3, 4, 5]), {
    previewItems: [1, 2, 3],
    total: 5,
    hasMoreWork: true,
  });
});
