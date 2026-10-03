import assert from "node:assert/strict";
import test from "node:test";
import {
  formatAnimalRecord,
  isPregnancyLossCalving,
} from "./recordPresentation.ts";

test("isPregnancyLossCalving detects pregnancy loss calving records correctly", () => {
  assert.equal(isPregnancyLossCalving(null), false);
  assert.equal(isPregnancyLossCalving({}), false);
  assert.equal(isPregnancyLossCalving({ outcome: "live_birth" }), false);
  assert.equal(isPregnancyLossCalving({ outcome: "abortion" }), true);
  assert.equal(isPregnancyLossCalving({ outcome: "Abortion" }), true);
  assert.equal(isPregnancyLossCalving({ isAbortion: true }), true);
  assert.equal(isPregnancyLossCalving({ pregnancyLossReportId: "rep-123" }), true);
  assert.equal(isPregnancyLossCalving({ details: { pregnancyLossReportId: "rep-123" } }), true);
  assert.equal(isPregnancyLossCalving({ title: "Pregnancy Loss Record" }), true);
});

test("formatAnimalRecord formats normal calving vs pregnancy loss record truthfully", () => {
  const normalCalving = {
    recordKind: "calving",
    date: "2026-08-10T00:00:00.000Z",
    outcome: "live_birth",
    calves: [{ earTag: "CALF-01" }],
    technicianNote: "Smooth delivery",
  };

  const normalFormatted = formatAnimalRecord(normalCalving, { earTag: "COW-01" });
  assert.equal(normalFormatted.pageTitle, "Calving Record");
  assert.equal(normalFormatted.category, "Calving");
  assert.equal(normalFormatted.title, "Calving Record · COW-01");
  assert.equal(normalFormatted.badges[0].label, "Calving recorded");
  assert.equal(normalFormatted.badges[0].variant, "success");

  const lossCalving = {
    recordKind: "calving",
    date: "2026-09-09T00:00:00.000Z",
    outcome: "abortion",
    technicianNote: "Pregnancy loss confirmed after examination",
  };

  const lossFormatted = formatAnimalRecord(lossCalving, { earTag: "COW-01" });
  assert.equal(lossFormatted.pageTitle, "Pregnancy Loss Record");
  assert.equal(lossFormatted.category, "Reproduction");
  assert.equal(lossFormatted.title, "Pregnancy Loss Record · COW-01");
  assert.equal(lossFormatted.badges[0].label, "Pregnancy loss recorded");
  assert.equal(lossFormatted.badges[0].variant, "danger");
  assert.ok(lossFormatted.details.includes("Pregnancy loss recorded"));
  assert.ok(lossFormatted.details.includes("Pregnancy loss confirmed after examination"));
  assert.doesNotMatch(JSON.stringify(lossFormatted), /"abortion"/i);
});

test("formatAnimalRecord preserves authoritative calving counts and historical fallback", () => {
  const animal = { earTag: "COW-01" };
  const twins = formatAnimalRecord(
    { recordKind: "calving", outcome: "live_birth", livingCalfCount: 2 },
    animal,
  );
  assert.equal(twins.details[0], "2 living calves");

  const stillbirth = formatAnimalRecord(
    { recordKind: "calving", outcome: "stillbirth", stillbornCount: 2 },
    animal,
  );
  assert.equal(stillbirth.details[0], "Stillbirth");
  assert.ok(stillbirth.details.includes("2 stillborn calves"));

  const historical = formatAnimalRecord(
    { recordKind: "calving", outcome: "live_birth" },
    animal,
  );
  assert.equal(historical.details[0], "Calving recorded");
  assert.doesNotMatch(historical.details.join(" "), /\d+ living/);

  const loss = formatAnimalRecord(
    { recordKind: "calving", outcome: "abortion", livingCalfCount: 2 },
    animal,
  );
  assert.equal(loss.details[0], "Pregnancy loss recorded");
});

test("formatAnimalRecord never promotes createdAt to a clinical date", () => {
  const enteredAt = "2026-09-22T08:00:00.000Z";
  const formatted = formatAnimalRecord(
    {
      recordKind: "medical_record",
      recordDate: null,
      date: null,
      createdAt: enteredAt,
      type: "Treatment",
    },
    { earTag: "COW-01" },
  );

  assert.equal(formatted.date, undefined);
  assert.notEqual(formatted.date, enteredAt);
});

test("formatAnimalRecord prefers normalized recordDate and supports raw clinical date", () => {
  const normalizedDate = "2026-09-10T08:00:00.000Z";
  const rawDate = "2026-09-09T08:00:00.000Z";

  assert.equal(
    formatAnimalRecord(
      {
        recordKind: "medical_record",
        recordDate: normalizedDate,
        date: rawDate,
      },
      { earTag: "COW-01" },
    ).date,
    normalizedDate,
  );
  assert.equal(
    formatAnimalRecord(
      { recordKind: "medical_record", date: rawDate },
      { earTag: "COW-01" },
    ).date,
    rawDate,
  );
});
