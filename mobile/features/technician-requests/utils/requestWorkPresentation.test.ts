import assert from "node:assert/strict";
import test from "node:test";

import {
  getWorkflowStatusPresentation,
  normalizeTechnicianWorkItem,
  normalizeTechnicianWorkItems,
  normalizeWorkflowStatus,
} from "./requestWorkPresentation.ts";

test("work queue normalization is safe for empty and loading input", () => {
  assert.deepEqual(normalizeTechnicianWorkItems([]), []);
  assert.deepEqual(normalizeTechnicianWorkItems(undefined), []);
  assert.deepEqual(
    normalizeTechnicianWorkItems({ data: [] } as unknown as any[]),
    [],
  );
});

test("one AI Work Queue item is normalized from the canonical item array", () => {
  const [item] = normalizeTechnicianWorkItems([
    {
      id: "ai-1",
      workflowId: "ai-1",
      workflowType: "AI",
      type: "ai",
      status: "scheduled",
      schedule: {
        date: "2026-08-30T08:00:00.000Z",
        visitPeriod: "morning",
      },
    } as any,
  ]);

  assert.equal(item.id, "ai-1");
  assert.equal(item.workType, "ai");
});

test("mixed Work Queue item arrays remain normalized", () => {
  const items = normalizeTechnicianWorkItems([
    {
      id: "ai-1",
      workflowId: "ai-1",
      workflowType: "AI",
      type: "ai",
      status: "pending",
    } as any,
    {
      id: "health-1",
      workflowId: "health-1",
      workflowType: "HEALTH",
      serviceType: "health",
      status: "assigned",
    } as any,
  ]);

  assert.deepEqual(
    items.map((item) => item.workType),
    ["ai", "health"],
  );
});

test("Farmer return-to-heat BreedingFollowUp is presented as an update review in My Work", () => {
  const item = normalizeTechnicianWorkItem({
    id: "task-1",
    taskId: "task-1",
    workflowType: "BreedingFollowUp",
    taskType: "BreedingFollowUp",
    status: "Pending",
    dueDate: "2026-08-15T08:00:00.000Z",
    raw: {
      dueDate: "2026-08-15T08:00:00.000Z",
      metadata: { reportType: "return_to_heat" },
    },
  } as any);

  assert.equal(item.title, "Breeding Follow-up");
  assert.equal(item.actionLabel, "Review Update");
  assert.equal(item.requestKind, "breeding_observation_review");
  assert.equal(item.statusLabel, "Needs review");
  assert.equal(normalizeWorkflowStatus(item), "needs_review");
  assert.doesNotMatch(item.timingLabel || "", /Pregnancy confirmation/);
});

test("active re-insemination is identifiable with its previous attempt context", () => {
  const item = normalizeTechnicianWorkItem({
    id: "attempt-2",
    workflowId: "attempt-2",
    workflowType: "AI",
    type: "ai",
    status: "scheduled",
    attemptNumber: 2,
    previousAttemptId: "attempt-1",
    previousAttemptOutcome: "Failed (Re-heat)",
    previousAttemptVerified: true,
    scheduledDate: "2026-08-16T08:00:00.000Z",
    schedule: {
      date: "2026-08-16T08:00:00.000Z",
      visitPeriod: "morning",
    },
  } as any);

  assert.equal(item.title, "Re-insemination");
  assert.equal(item.requestKind, "re_insemination");
  assert.equal(item.attemptNumber, 2);
  assert.equal(item.previousAttemptId, "attempt-1");
  assert.equal(item.previousAttemptOutcome, "Failed (Re-heat)");
  assert.equal(item.previousAttemptVerified, true);
});

test("completed non-clinical Health responses do not imply a MedicalRecord", () => {
  const officePickup = normalizeTechnicianWorkItem({
    id: "health-pickup-1",
    workflowId: "health-pickup-1",
    workflowType: "HEALTH",
    serviceType: "health",
    status: "resolved",
    handlingMethod: "office_pickup",
  } as any);
  const advice = normalizeTechnicianWorkItem({
    id: "health-advice-1",
    workflowId: "health-advice-1",
    workflowType: "HEALTH",
    serviceType: "health",
    status: "resolved",
    handlingMethod: "advice",
  } as any);
  const clinical = normalizeTechnicianWorkItem({
    id: "health-clinical-1",
    workflowId: "health-clinical-1",
    workflowType: "HEALTH",
    serviceType: "health",
    status: "resolved",
    handlingMethod: "farm_visit",
    medicalRecordId: "medical-1",
  } as any);
  const legacyWithoutRecord = normalizeTechnicianWorkItem({
    id: "health-legacy-1",
    workflowId: "health-legacy-1",
    workflowType: "HEALTH",
    serviceType: "health",
    status: "resolved",
  } as any);

  assert.equal(officePickup.actionLabel, "View Response");
  assert.equal(officePickup.title, "Office Pickup");
  assert.equal(officePickup.statusLabel, "Pickup info available");
  assert.equal(advice.actionLabel, "View Response");
  assert.equal(advice.title, "Health Advice");
  assert.equal(advice.statusLabel, "Advice provided");
  assert.equal(clinical.actionLabel, "View Record");
  assert.equal(clinical.title, "Health Service");
  assert.equal(clinical.statusLabel, "Completed");
  assert.equal(legacyWithoutRecord.actionLabel, "View Response");
});

test("State 1: Claimed Health without handling method is Needs response with Handle Request action", () => {
  const item = normalizeTechnicianWorkItem({
    id: "health-claimed-1",
    workflowId: "health-claimed-1",
    workflowType: "HEALTH",
    serviceType: "health",
    status: "assigned",
    assignedTechnicianId: "tech-1",
  } as any);

  assert.equal(item.state, "needs_response");
  assert.equal(item.statusLabel, "Needs response");
  assert.equal(item.actionLabel, "Handle Request");
  assert.equal(item.timingLabel, null);
});

test("State 2: Claimed Health with advice handling method is response flow without scheduling", () => {
  const item = normalizeTechnicianWorkItem({
    id: "health-advice-flow",
    workflowId: "health-advice-flow",
    workflowType: "HEALTH",
    serviceType: "health",
    status: "assigned",
    handlingMethod: "advice",
    assignedTechnicianId: "tech-1",
  } as any);

  assert.equal(item.state, "needs_response");
  assert.equal(item.statusLabel, "Needs response");
  assert.equal(item.actionLabel, "Send Advice");
  assert.equal(item.timingLabel, null);
});

test("State 3: Claimed Health with office_pickup handling method is response flow without scheduling", () => {
  const item = normalizeTechnicianWorkItem({
    id: "health-pickup-flow",
    workflowId: "health-pickup-flow",
    workflowType: "HEALTH",
    serviceType: "health",
    status: "assigned",
    handlingMethod: "office_pickup",
    assignedTechnicianId: "tech-1",
  } as any);

  assert.equal(item.state, "needs_response");
  assert.equal(item.statusLabel, "Needs response");
  assert.equal(item.actionLabel, "Office Pickup");
  assert.equal(item.timingLabel, null);
});

test("State 4: Claimed Health with farm_visit handling method and no schedule is Needs scheduling", () => {
  const item = normalizeTechnicianWorkItem({
    id: "health-visit-unscheduled",
    workflowId: "health-visit-unscheduled",
    workflowType: "HEALTH",
    serviceType: "health",
    status: "assigned",
    handlingMethod: "farm_visit",
    assignedTechnicianId: "tech-1",
  } as any);

  assert.equal(item.state, "needs_scheduling");
  assert.equal(item.statusLabel, "Needs scheduling");
  assert.equal(item.actionLabel, "Set Visit");
  assert.equal(item.timingLabel, null);
});

test("State 5: Claimed Health with farm_visit handling method and scheduled date retains temporal presentation", () => {
  const item = normalizeTechnicianWorkItem({
    id: "health-visit-scheduled",
    workflowId: "health-visit-scheduled",
    workflowType: "HEALTH",
    serviceType: "health",
    status: "scheduled",
    handlingMethod: "farm_visit",
    scheduledDate: "2026-09-10T08:00:00.000Z",
    schedule: {
      date: "2026-09-10T08:00:00.000Z",
      visitPeriod: "morning",
    },
    assignedTechnicianId: "tech-1",
  } as any);

  assert.equal(item.state, "scheduled");
  assert.equal(item.actionLabel, "Record Health Assistance");
});

test("AI claimed without schedule remains Needs scheduling with Set Visit", () => {
  const item = normalizeTechnicianWorkItem({
    id: "ai-claimed-unscheduled",
    workflowId: "ai-claimed-unscheduled",
    workflowType: "AI",
    type: "ai",
    status: "assigned",
    assignedTechnicianId: "tech-1",
  } as any);

  assert.equal(item.state, "needs_scheduling");
  assert.equal(item.statusLabel, "Needs scheduling");
  assert.equal(item.actionLabel, "Set Visit");
});

test("Internal triaged status never exposes user-facing 'triaged' label", () => {
  const item = normalizeTechnicianWorkItem({
    id: "health-triaged",
    workflowId: "health-triaged",
    workflowType: "HEALTH",
    serviceType: "health",
    status: "triaged",
    assignedTechnicianId: "tech-1",
  } as any);

  assert.notEqual(item.statusLabel?.toLowerCase(), "triaged");
  assert.doesNotMatch(item.statusLabel || "", /triage/i);
  assert.equal(item.statusLabel, "Needs response");
});

test("dated work uses source-aware status labels without changing readiness", () => {
  const now = new Date("2026-09-05T04:00:00.000Z");
  const cases = [
    {
      name: "AI today",
      item: {
        workflowType: "AI",
        type: "ai",
        status: "scheduled",
        scheduledDate: "2026-09-05",
      },
      status: "scheduled_today",
      label: "Scheduled Today",
      isReadyToday: true,
    },
    {
      name: "Health Farm Visit today",
      item: {
        workflowType: "HEALTH",
        serviceType: "health",
        status: "scheduled",
        handlingMethod: "farm_visit",
        scheduledDate: "2026-09-05",
      },
      status: "scheduled_today",
      label: "Scheduled Today",
      isReadyToday: true,
    },
    {
      name: "Pregnancy Check today",
      item: {
        workflowType: "PD",
        taskType: "PD",
        status: "Pending",
        dueDate: "2026-09-05",
      },
      status: "due_today",
      label: "Due Today",
      isReadyToday: true,
    },
    {
      name: "Breeding Follow-up today",
      item: {
        workflowType: "BreedingFollowUp",
        taskType: "BreedingFollowUp",
        status: "Pending",
        dueDate: "2026-09-05",
      },
      status: "due_today",
      label: "Due Today",
      isReadyToday: true,
    },
    {
      name: "AI future",
      item: {
        workflowType: "AI",
        type: "ai",
        status: "scheduled",
        scheduledDate: "2026-09-06",
      },
      status: "scheduled",
      label: "Scheduled",
      isReadyToday: false,
    },
    {
      name: "Health Farm Visit future",
      item: {
        workflowType: "HEALTH",
        serviceType: "health",
        status: "scheduled",
        handlingMethod: "farm_visit",
        scheduledDate: "2026-09-06",
      },
      status: "scheduled",
      label: "Scheduled",
      isReadyToday: false,
    },
    {
      name: "reproductive future",
      item: {
        workflowType: "PD",
        taskType: "PD",
        status: "Pending",
        dueDate: "2026-09-06",
      },
      status: "upcoming",
      label: "Upcoming",
      isReadyToday: false,
    },
    {
      name: "past unfinished reproductive work",
      item: {
        workflowType: "PD",
        taskType: "PD",
        status: "Pending",
        dueDate: "2026-09-04",
      },
      status: "overdue",
      label: "Overdue",
      isReadyToday: false,
    },
  ] as const;

  for (const scenario of cases) {
    const rawStatus = normalizeWorkflowStatus(scenario.item, now);
    assert.equal(rawStatus, scenario.status, scenario.name);
    assert.equal(
      getWorkflowStatusPresentation(rawStatus).label,
      scenario.label,
      scenario.name,
    );

    const normalized = normalizeTechnicianWorkItem(
      {
        id: scenario.name,
        workflowId: scenario.name,
        ...scenario.item,
      } as any,
      now,
    );
    assert.equal(normalized.statusLabel, scenario.label, scenario.name);
    assert.equal(
      normalized.isReadyToday,
      scenario.isReadyToday,
      scenario.name,
    );
  }
});

test("terminal work keeps its completed presentation", () => {
  const now = new Date("2026-09-05T04:00:00.000Z");
  const item = {
    workflowType: "AI",
    type: "ai",
    status: "completed",
    scheduledDate: "2026-09-05",
  };

  const rawStatus = normalizeWorkflowStatus(item, now);
  assert.equal(rawStatus, "completed");
  assert.equal(getWorkflowStatusPresentation(rawStatus).label, "Completed");

  const normalized = normalizeTechnicianWorkItem(
    { id: "completed-ai", workflowId: "completed-ai", ...item } as any,
    now,
  );
  assert.equal(normalized.statusLabel, "Completed");
  assert.equal(normalized.isReadyToday, false);
});

test("early started AI visit with future scheduled visit preserves In Progress state and Continue Service action", () => {
  const now = new Date("2026-09-11T04:00:00.000Z");
  const item = {
    id: "early-ai-1",
    workflowId: "early-ai-1",
    workflowType: "AI",
    type: "ai",
    status: "in-progress",
    scheduledDate: "2026-09-12T04:00:00.000Z",
    serviceStartedAt: "2026-09-11T11:52:07.068Z",
    schedule: {
      date: "2026-09-12T04:00:00.000Z",
      visitPeriod: "morning",
    },
  };

  const rawStatus = normalizeWorkflowStatus(item, now);
  assert.equal(rawStatus, "in_progress");
  assert.equal(getWorkflowStatusPresentation(rawStatus).label, "In Progress");

  const normalized = normalizeTechnicianWorkItem(item as any, now);
  assert.equal(normalized.state, "in_progress");
  assert.equal(normalized.statusLabel, "In Progress");
  assert.equal(normalized.actionLabel, "Continue Service");
  assert.equal(normalized.scheduledDate, "2026-09-12T04:00:00.000Z");
  assert.equal(normalized.visitPeriod, "morning");
});

test("terminal status always wins over serviceStartedAt", () => {
  const now = new Date("2026-09-11T04:00:00.000Z");
  const item = {
    id: "finished-ai-1",
    workflowId: "finished-ai-1",
    workflowType: "AI",
    type: "ai",
    status: "done",
    serviceStartedAt: "2026-09-11T11:52:07.068Z",
  };

  const rawStatus = normalizeWorkflowStatus(item, now);
  assert.equal(rawStatus, "completed");
  assert.equal(getWorkflowStatusPresentation(rawStatus).label, "Completed");

  const normalized = normalizeTechnicianWorkItem(item as any, now);
  assert.equal(normalized.state, "completed");
  assert.equal(normalized.statusLabel, "Completed");
});
