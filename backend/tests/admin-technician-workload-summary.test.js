import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildActiveAIWorkFilter,
  buildActiveHealthWorkFilter,
  buildActiveStandaloneTaskFilter,
  buildCompletedAIWorkFilter,
  buildCompletedHealthWorkFilter,
  buildCompletedStandaloneTaskFilter,
  DUE_GATED_REPRODUCTIVE_TASK_TYPES,
  buildTechnicianWorkloadRows,
  loadTechnicianWorkloadSummary,
} from "../src/services/technician-workload-summary.service.js";
import {
  ACTIVE_AI_REQUEST_STATUSES,
  ACTIVE_HEALTH_REQUEST_STATUSES,
} from "../src/domain/status-vocabulary.js";
import { AdminOnly } from "../src/middleware/auth.middleware.js";

const queryResult = (value) => ({
  select() {
    return this;
  },
  lean() {
    return Promise.resolve(value);
  },
});

test("AdminOnly admits Admin and rejects Farmer and Technician actors", () => {
  for (const role of ["farmer", "technician"]) {
    let nextCalled = false;
    const state = { status: null, body: null };
    const response = {
      status(code) {
        state.status = code;
        return response;
      },
      json(body) {
        state.body = body;
        return response;
      },
    };

    AdminOnly({ user: { role } }, response, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(state.status, 403);
  }

  let adminNextCalled = false;
  AdminOnly({ user: { role: "admin" } }, {}, () => {
    adminNextCalled = true;
  });
  assert.equal(adminNextCalled, true);
});
test("Admin workload endpoint remains behind the Admin-only route boundary", async () => {
  const routes = await readFile(
    new URL("../src/routes/admin.routes.js", import.meta.url),
    "utf8",
  );

  assert.match(routes, /router\.use\(protectedRoute, AdminOnly\)/);
  assert.match(
    routes,
    /router\.get\("\/technician-workload-summary", getTechnicianWorkloadSummary\)/,
  );
});

test("shared active filters preserve canonical and legacy Work Queue status rules", () => {
  const technicianId = "technician-1";
  const now = new Date("2026-08-29T04:00:00.000Z");
  const ai = buildActiveAIWorkFilter({ technicianId });
  const health = buildActiveHealthWorkFilter({ technicianId });
  const tasks = buildActiveStandaloneTaskFilter({ technicianId, now });

  assert.deepEqual(ai.status.$in, ACTIVE_AI_REQUEST_STATUSES);
  assert.deepEqual(health.status.$in, ACTIVE_HEALTH_REQUEST_STATUSES);
  assert.equal(ai.status.$in.includes("done"), false);
  assert.equal(health.status.$in.includes("resolved"), false);
  assert.equal(tasks.technicianId, technicianId);
  assert.deepEqual(tasks.status.$in, ["Pending", "In Progress"]);
  assert.deepEqual(DUE_GATED_REPRODUCTIVE_TASK_TYPES, [
    "PD",
    "BreedingFollowUp",
    "CD",
    "Calving",
  ]);
  assert.deepEqual(
    tasks.$and[0].$or[1].taskType.$in,
    DUE_GATED_REPRODUCTIVE_TASK_TYPES,
  );
  assert.deepEqual(tasks.$nor[1], {
    relatedRecordType: { $in: ["insemination", "health"] },
  });
  assert.equal(
    tasks.$and[0].$or[1].$or[0].dueDate.$lte.getTime(),
    now.getTime(),
  );
});

test("shared completed filters preserve canonical My Work ownership and duplicate suppression", () => {
  const technicianId = "technician-1";
  const ai = buildCompletedAIWorkFilter({ technicianId });
  const health = buildCompletedHealthWorkFilter({ technicianId });
  const tasks = buildCompletedStandaloneTaskFilter({ technicianId });

  assert.equal(ai.status, "done");
  assert.equal(ai.deletedAt, null);
  assert.deepEqual(ai.$or, [
    { approvedBy: technicianId },
    { status: "done", technicianId },
  ]);
  assert.deepEqual(health.status.$in, ["resolved", "done"]);
  assert.deepEqual(health.$or, [
    { handledBy: technicianId },
    { assignedTechnicianId: technicianId },
  ]);
  assert.equal(tasks.status, "Completed");
  assert.equal(tasks.technicianId, technicianId);
  assert.deepEqual(tasks.$nor[1], {
    relatedRecordType: { $in: ["insemination", "health"] },
  });
});

test("workload rows use stable IDs and keep duplicate Technician names distinct", () => {
  const rows = buildTechnicianWorkloadRows({
    technicians: [
      { _id: "technician-a", name: "Same Name" },
      { _id: "technician-b", name: "Same Name" },
    ],
    aiCounts: [{ _id: "technician-a", count: 2 }],
    healthCounts: [{ _id: "technician-b", count: 1 }],
    taskCounts: [
      {
        _id: "technician-b",
        pregnancy: 1,
        calving: 1,
        tasks: 1,
      },
    ],
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].technicianId, "technician-b");
  assert.equal(rows[0].activeWorkloadTotal, 4);
  assert.deepEqual(rows[0].counts, {
    ai: 0,
    health: 1,
    pregnancy: 1,
    calving: 1,
    tasks: 1,
  });
  assert.equal(rows[1].technicianId, "technician-a");
  assert.equal(rows[1].activeWorkloadTotal, 2);
  assert.deepEqual(Object.keys(rows[0]).sort(), [
    "activeWorkloadTotal",
    "counts",
    "name",
    "technicianId",
  ]);
});

test("summary aggregation includes assigned work only and returns zero rows truthfully", async () => {
  const captured = {};
  const rows = await loadTechnicianWorkloadSummary({
    now: new Date("2026-08-29T04:00:00.000Z"),
    models: {
      User: {
        find(filter) {
          captured.userFilter = filter;
          return queryResult([
            { _id: "technician-a", name: "A" },
            { _id: "technician-b", name: "B" },
          ]);
        },
      },
      Insemination: {
        async aggregate(pipeline) {
          captured.aiPipeline = pipeline;
          return [{ _id: "technician-a", count: 1 }];
        },
      },
      HealthRequest: {
        async aggregate(pipeline) {
          captured.healthPipeline = pipeline;
          return [];
        },
      },
      Task: {
        async aggregate(pipeline) {
          captured.taskPipeline = pipeline;
          return [];
        },
      },
    },
  });

  assert.deepEqual(captured.userFilter, {
    role: "technician",
    deletedAt: null,
  });
  assert.deepEqual(captured.aiPipeline[0].$match.approvedBy, { $ne: null });
  assert.deepEqual(captured.healthPipeline[2].$match, {
    workloadTechnicianId: { $ne: null },
  });
  assert.deepEqual(captured.taskPipeline[0].$match.technicianId, { $ne: null });
  assert.equal(rows.find((row) => row.technicianId === "technician-a").activeWorkloadTotal, 1);
  assert.equal(rows.find((row) => row.technicianId === "technician-b").activeWorkloadTotal, 0);
});
