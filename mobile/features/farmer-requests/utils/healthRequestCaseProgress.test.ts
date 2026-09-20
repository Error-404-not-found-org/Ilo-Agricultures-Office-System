import assert from "node:assert/strict";
import test from "node:test";

import { getFarmerHealthCaseProgress } from "./healthRequestCaseProgress.ts";

const labels = (request: Record<string, unknown>) =>
  getFarmerHealthCaseProgress(request).map((item) => item.label);

test("pending shows only the submitted concern without implying a visit", () => {
  const items = getFarmerHealthCaseProgress({
    status: "pending",
    createdAt: "2026-09-19T01:00:00.000Z",
  });

  assert.deepEqual(labels({ status: "pending" }), ["Health concern sent"]);
  assert.match(items[0].description || "", /Waiting for technician review/);
});

test("Farmer-safe technician identity adds the reviewing event", () => {
  assert.deepEqual(
    labels({
      status: "approved",
      createdAt: "2026-09-19T01:00:00.000Z",
      technicianDisplayName: "Ana Cruz",
    }),
    ["Health concern sent", "Technician reviewing request"],
  );
});

test("private assignedTechnicianId alone does not prove a Farmer-visible review", () => {
  assert.deepEqual(
    labels({ status: "approved", assignedTechnicianId: "private-user-id" }),
    ["Health concern sent"],
  );
});

test("resolved Advice ends with Advice provided and never renders visit events", () => {
  const result = labels({
    status: "resolved",
    handlingMethod: "advice",
    technicianDisplayName: "Ana Cruz",
    resolvedAt: "2026-09-19T02:00:00.000Z",
  });

  assert.deepEqual(result, [
    "Health concern sent",
    "Technician reviewing request",
    "Advice provided",
  ]);
  assert.equal(result.some((label) => label.includes("visit")), false);
});

test("resolved Office Pickup ends with Pickup arranged and never renders visit events", () => {
  const result = labels({
    status: "done",
    handlingMethod: "office_pickup",
    handledBy: { name: "Ana Cruz" },
    resolvedAt: "2026-09-19T02:00:00.000Z",
  });

  assert.deepEqual(result, [
    "Health concern sent",
    "Technician reviewing request",
    "Pickup arranged",
  ]);
  assert.equal(result.some((label) => label.includes("visit")), false);
});

test("Farm Visit shows only the current appointment", () => {
  const items = getFarmerHealthCaseProgress({
    status: "scheduled",
    handlingMethod: "farm_visit",
    technicianDisplayName: "Ana Cruz",
    scheduledDate: "2026-09-22T00:00:00.000Z",
    visitPeriod: "afternoon",
    statusHistory: [
      { status: "scheduled", createdAt: "2026-09-19T01:00:00.000Z" },
      { status: "scheduled", createdAt: "2026-09-20T01:00:00.000Z" },
    ],
  });

  assert.deepEqual(items.map((item) => item.label), [
    "Health concern sent",
    "Technician reviewing request",
    "Farm visit scheduled",
  ]);
  assert.match(items[2].description || "", /September 22, 2026/);
  assert.match(items[2].description || "", /Afternoon/);
  assert.equal(items.some((item) => /rescheduled/i.test(item.label)), false);
});

test("in-progress Farm Visit uses serviceStartedAt for Health visit started", () => {
  const items = getFarmerHealthCaseProgress({
    status: "in-progress",
    handlingMethod: "farm_visit",
    scheduledDate: "2026-09-19T00:00:00.000Z",
    serviceStartedAt: "2026-09-19T03:30:00.000Z",
  });

  assert.equal(items.at(-1)?.label, "Health visit started");
  assert.match(items.at(-1)?.description || "", /September 19, 2026/);
});

test("completed Farm Visit requires resolvedAt and explicit official linkage when supplied", () => {
  assert.equal(
    labels({
      status: "resolved",
      handlingMethod: "farm_visit",
      resolvedAt: "2026-09-19T04:00:00.000Z",
      medicalRecordId: "medical-1",
    }).at(-1),
    "Health service completed",
  );

  assert.equal(
    labels({
      status: "resolved",
      handlingMethod: "farm_visit",
      resolvedAt: "2026-09-19T04:00:00.000Z",
      medicalRecordId: null,
    }).includes("Health service completed"),
    false,
  );
});

test("cancelled pending request stops at Request cancelled", () => {
  assert.deepEqual(
    labels({
      status: "cancelled",
      cancellationRespondedAt: "2026-09-19T04:00:00.000Z",
      scheduledDate: "2026-09-20T00:00:00.000Z",
      serviceStartedAt: "2026-09-19T03:00:00.000Z",
    }),
    ["Health concern sent", "Request cancelled"],
  );
});

test("cancelled assigned request retains review before cancellation", () => {
  assert.deepEqual(
    labels({
      status: "cancelled",
      technicianDisplayName: "Ana Cruz",
      statusHistory: [
        { status: "cancelled", createdAt: "2026-09-19T04:00:00.000Z" },
        { status: "cancelled", createdAt: "2026-09-19T04:00:00.000Z" },
      ],
    }),
    [
      "Health concern sent",
      "Technician reviewing request",
      "Request cancelled",
    ],
  );
});

test("missing event timestamps are omitted instead of falling back to updatedAt", () => {
  const items = getFarmerHealthCaseProgress({
    status: "resolved",
    handlingMethod: "advice",
    technicianDisplayName: "Ana Cruz",
    updatedAt: "2026-09-19T05:00:00.000Z",
  });

  assert.equal(items.every((item) => !item.description?.includes("5:00")), true);
  assert.equal(items.at(-1)?.label, "Advice provided");
});

test("unknown legacy data degrades to supported events without private metadata", () => {
  const items = getFarmerHealthCaseProgress({
    status: "legacy_state",
    createdAt: "invalid",
    technicianNote: "private note",
    assignedTechnicianId: "private-user-id",
    statusHistory: [
      {
        status: "legacy_internal_state",
        note: "private history note",
        actorId: "private-actor-id",
      },
    ],
  });
  const serialized = JSON.stringify(items);

  assert.deepEqual(items.map((item) => item.label), ["Health concern sent"]);
  assert.equal(serialized.includes("private"), false);
});

test("legacy rejected state does not fabricate a cancellation event", () => {
  assert.deepEqual(labels({ status: "rejected" }), ["Health concern sent"]);
});
