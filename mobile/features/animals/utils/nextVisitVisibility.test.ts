import assert from "node:assert/strict";
import test from "node:test";

import { selectNextAnimalVisit } from "./nextVisitVisibility.ts";

const now = new Date("2026-08-25T00:00:00.000Z").getTime();
const visit = (
  id: string,
  scheduledDate: string,
  ownerIds: unknown[],
) => ({ id, status: "scheduled", scheduledDate, ownerIds });

test("mixed legacy services choose only the current Technician's future visit", () => {
  const selected = selectNextAnimalVisit(
    [
      visit("other-earlier", "2026-08-26T00:00:00.000Z", ["tech-a"]),
      visit("mine", "2026-08-27T00:00:00.000Z", [
        { _id: "tech-b" },
        "tech-b",
      ]),
      visit("ambiguous", "2026-08-25T12:00:00.000Z", [
        "tech-a",
        "tech-b",
      ]),
    ],
    { role: "technician", currentTechnicianId: "tech-b", now },
  );

  assert.equal(selected?.id, "mine");
});

test("another Technician's visit does not produce a Next Visit", () => {
  const selected = selectNextAnimalVisit(
    [visit("other", "2026-08-26T00:00:00.000Z", ["tech-a"])],
    { role: "technician", currentTechnicianId: "tech-b", now },
  );

  assert.equal(selected, undefined);
});

test("missing ownership does not produce a Technician Next Visit", () => {
  const selected = selectNextAnimalVisit(
    [visit("legacy-unowned", "2026-08-26T00:00:00.000Z", [])],
    { role: "technician", currentTechnicianId: "tech-b", now },
  );

  assert.equal(selected, undefined);
});

test("current Technician's future visit is selected normally", () => {
  const selected = selectNextAnimalVisit(
    [visit("mine", "2026-08-26T00:00:00.000Z", [{ _id: "tech-b" }])],
    { role: "technician", currentTechnicianId: "tech-b", now },
  );

  assert.equal(selected?.id, "mine");
});
