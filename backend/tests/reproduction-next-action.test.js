import test from "node:test";
import assert from "node:assert/strict";

import {
  NEXT_ACTION_DATE_KIND,
  REPRODUCTION_NEXT_ACTION_TYPE,
  REPRODUCTION_PHASE,
  resolveReproductionNextAction,
} from "../src/domain/reproduction-next-action.js";

const makeAnimal = (overrides = {}) => ({
  _id: "animal-1",
  reproductiveStatus: "Normal",
  species: "Cattle",
  breed: "Holstein",
  ...overrides,
});

test("pending AI request returns the requested scheduling action", () => {
  const action = resolveReproductionNextAction({
    animal: makeAnimal(),
    activeRequest: {
      _id: "ai-1",
      status: "pending",
      preferredDate: "2026-07-20T08:00:00.000Z",
    },
    now: new Date("2026-07-16T00:00:00.000Z"),
  });

  assert.equal(action.phase, REPRODUCTION_PHASE.AI_REQUESTED);
  assert.equal(action.type, REPRODUCTION_NEXT_ACTION_TYPE.SCHEDULE_AI_SERVICE);
  assert.equal(action.dateKind, NEXT_ACTION_DATE_KIND.REQUESTED);
  assert.equal(action.source, "insemination.preferredDate");
});

test("scheduled date takes priority even when request status is stale", () => {
  const action = resolveReproductionNextAction({
    animal: makeAnimal(),
    activeRequest: {
      _id: "ai-1",
      status: "pending",
      preferredDate: "2026-07-20T08:00:00.000Z",
      scheduledDate: "2026-07-22T09:00:00.000Z",
    },
    now: new Date("2026-07-16T00:00:00.000Z"),
  });

  assert.equal(action.phase, REPRODUCTION_PHASE.AI_SCHEDULED);
  assert.equal(action.type, REPRODUCTION_NEXT_ACTION_TYPE.ATTEND_AI_VISIT);
  assert.equal(action.dateKind, NEXT_ACTION_DATE_KIND.CONFIRMED);
  assert.equal(action.source, "insemination.scheduledDate");
});

test("inseminated animal returns the 21-day heat monitoring action", () => {
  const action = resolveReproductionNextAction({
    animal: makeAnimal({
      reproductiveStatus: "Inseminated",
      lastInseminationDate: "2026-07-01T00:00:00.000Z",
    }),
    activeRequest: {
      _id: "ai-1",
      status: "done",
      inseminationDate: "2026-07-01T00:00:00.000Z",
    },
    now: new Date("2026-07-10T00:00:00.000Z"),
  });

  assert.equal(action.phase, REPRODUCTION_PHASE.HEAT_RETURN_MONITORING);
  assert.equal(
    action.type,
    REPRODUCTION_NEXT_ACTION_TYPE.MONITOR_RETURN_TO_HEAT,
  );
  assert.equal(action.at.toISOString(), "2026-07-22T00:00:00.000Z");
});

test("open pregnancy diagnosis task takes priority over calculated date", () => {
  const action = resolveReproductionNextAction({
    animal: makeAnimal({
      reproductiveStatus: "Inseminated",
      lastInseminationDate: "2026-07-01T00:00:00.000Z",
    }),
    activeRequest: {
      _id: "ai-1",
      status: "done",
      inseminationDate: "2026-07-01T00:00:00.000Z",
    },
    tasks: [
      {
        animalIds: ["animal-1"],
        taskType: "PD",
        status: "Pending",
        sourceType: "automatic_pd_followup",
        dueDate: "2026-08-25T00:00:00.000Z",
        metadata: {
          inseminationId: "ai-1",
        },
      },
    ],
    now: new Date("2026-08-01T00:00:00.000Z"),
  });

  assert.equal(action.phase, REPRODUCTION_PHASE.PREGNANCY_MONITORING);
  assert.equal(
    action.type,
    REPRODUCTION_NEXT_ACTION_TYPE.PERFORM_PREGNANCY_DIAGNOSIS,
  );
  assert.equal(action.source, "task.dueDate");
  assert.equal(action.dateKind, NEXT_ACTION_DATE_KIND.CONFIRMED);
});

test("farmer-requested verification takes priority over ordinary monitoring", () => {
  const action = resolveReproductionNextAction({
    animal: makeAnimal({
      reproductiveStatus: "Inseminated",
      lastInseminationDate: "2026-06-01T00:00:00.000Z",
    }),
    activeRequest: {
      _id: "ai-1",
      status: "done",
      inseminationDate: "2026-06-01T00:00:00.000Z",
    },
    tasks: [
      {
        animalIds: ["animal-1"],
        taskType: "PD",
        status: "Pending",
        sourceType: "farmer_requested_verification",
        dueDate: "2026-07-16T00:00:00.000Z",
        metadata: {
          inseminationId: "ai-1",
        },
      },
    ],
    now: new Date("2026-07-16T00:00:00.000Z"),
  });

  assert.equal(
    action.type,
    REPRODUCTION_NEXT_ACTION_TYPE.VERIFY_BREEDING_OUTCOME,
  );
  assert.equal(action.phase, REPRODUCTION_PHASE.PREGNANCY_CHECK_DUE);
});

test("confirmed pregnancy overrides a stale active AI request", () => {
  const action = resolveReproductionNextAction({
    animal: makeAnimal({
      reproductiveStatus: "Pregnant",
      expectedCalvingDate: "2027-04-20T00:00:00.000Z",
    }),
    activeRequest: {
      _id: "ai-old",
      status: "pending",
      preferredDate: "2026-07-20T00:00:00.000Z",
    },
    activePregnancy: {
      targetCalvingDate: "2027-04-18T00:00:00.000Z",
    },
    now: new Date("2026-07-16T00:00:00.000Z"),
  });

  assert.equal(action.phase, REPRODUCTION_PHASE.PREGNANT);
  assert.equal(action.type, REPRODUCTION_NEXT_ACTION_TYPE.PREPARE_FOR_CALVING);
  assert.equal(action.source, "pregnancy.targetCalvingDate");
});

test("future calving task does not mark calving as already due", () => {
  const action = resolveReproductionNextAction({
    animal: makeAnimal({
      reproductiveStatus: "Pregnant",
      expectedCalvingDate: "2027-04-20T00:00:00.000Z",
    }),
    activePregnancy: {
      targetCalvingDate: "2027-04-20T00:00:00.000Z",
    },
    tasks: [
      {
        animalIds: ["animal-1"],
        taskType: "Calving",
        status: "Pending",
        dueDate: "2027-04-18T00:00:00.000Z",
      },
    ],
    now: new Date("2026-07-16T00:00:00.000Z"),
  });

  assert.equal(action.phase, REPRODUCTION_PHASE.PREGNANT);
  assert.equal(action.label, "Prepare for expected calving");
});

test("past expected calving date returns calving due", () => {
  const action = resolveReproductionNextAction({
    animal: makeAnimal({
      reproductiveStatus: "Pregnant",
      expectedCalvingDate: "2026-07-10T00:00:00.000Z",
    }),
    activePregnancy: {
      targetCalvingDate: "2026-07-10T00:00:00.000Z",
    },
    now: new Date("2026-07-16T00:00:00.000Z"),
  });

  assert.equal(action.phase, REPRODUCTION_PHASE.CALVING_DUE);
  assert.equal(action.isOverdue, true);
});

test("recent calving returns postpartum recovery action", () => {
  const action = resolveReproductionNextAction({
    animal: makeAnimal({
      reproductiveStatus: "Post-partum",
      lastCalvingDate: "2026-07-01T00:00:00.000Z",
    }),
    now: new Date("2026-07-16T00:00:00.000Z"),
  });

  assert.equal(action.phase, REPRODUCTION_PHASE.RECOVERY_PERIOD);
  assert.equal(
    action.type,
    REPRODUCTION_NEXT_ACTION_TYPE.WAIT_FOR_POSTPARTUM_RECOVERY,
  );
  assert.equal(action.dateKind, NEXT_ACTION_DATE_KIND.CALCULATED);
  assert.equal(action.isOverdue, false);
});

test("normal animal without active records has no next action", () => {
  const action = resolveReproductionNextAction({
    animal: makeAnimal(),
    now: new Date("2026-07-16T00:00:00.000Z"),
  });

  assert.equal(action, null);
});

test("legacy awaiting-result AI status uses the monitoring workflow", () => {
  const action = resolveReproductionNextAction({
    animal: makeAnimal(),
    activeRequest: {
      _id: "ai-legacy",
      status: "awaiting-result",
      inseminationDate: "2026-07-01T00:00:00.000Z",
    },
    now: new Date("2026-07-10T00:00:00.000Z"),
  });

  assert.equal(action.phase, REPRODUCTION_PHASE.HEAT_RETURN_MONITORING);
  assert.equal(
    action.type,
    REPRODUCTION_NEXT_ACTION_TYPE.MONITOR_RETURN_TO_HEAT,
  );
});
