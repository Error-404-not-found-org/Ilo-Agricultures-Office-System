import assert from "node:assert/strict";
import test from "node:test";

import { getCalvingWorkNavigation } from "./calvingWorkNavigation.ts";

test("actionable Expected Calving work opens Record Calving with canonical context", () => {
  assert.deepEqual(
    getCalvingWorkNavigation({
      id: "task-1",
      taskId: "task-1",
      workType: "calving",
      allowedAction: "RECORD_SERVICE",
      motherId: "animal-1",
      pregnancyId: "pregnancy-1",
      farmerId: "farmer-1",
      farmerName: "Farmer One",
      animalTag: "COW-1",
    } as any),
    {
      pathname: "/(technician)/record-calf-drop",
      params: {
        taskId: "task-1",
        motherId: "animal-1",
        pregnancyId: "pregnancy-1",
        farmerId: "farmer-1",
        farmerName: "Farmer One",
        motherTag: "COW-1",
        source: "task",
      },
    },
  );
});

test("non-actionable or incomplete Calving work keeps the compatible details route", () => {
  assert.equal(getCalvingWorkNavigation({
    id: "task-2", taskId: "task-2", workType: "calving", allowedAction: "CLAIM",
  } as any), null);
  assert.equal(getCalvingWorkNavigation({
    id: "task-3", taskId: "task-3", workType: "calving", allowedAction: "RECORD_SERVICE", motherId: "animal-1",
  } as any), null);
});
