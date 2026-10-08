import test from "node:test";
import assert from "node:assert/strict";
import { getOfficialRecordDate } from "./officialRecordDate.ts";

test("official AI date is the insemination date, never a request or entry date", () => {
  const record = {
    recordKind: "insemination",
    inseminationDate: "2026-10-03T00:00:00.000Z",
    scheduledDate: "2026-10-04T00:00:00.000Z",
    preferredDate: "2026-10-05T00:00:00.000Z",
    createdAt: "2026-10-06T00:00:00.000Z",
  };
  assert.equal(getOfficialRecordDate(record), record.inseminationDate);
  assert.equal(getOfficialRecordDate({ ...record, inseminationDate: null }), null);
});

test("official Pregnancy and Calving dates remain missing without their canonical dates", () => {
  assert.equal(getOfficialRecordDate({ recordKind: "pregnancy", pregnancyDiagnosis: { date: "2026-10-07" }, date: "2026-10-08", createdAt: "2026-10-09" }), "2026-10-07");
  assert.equal(getOfficialRecordDate({ recordKind: "pregnancy", date: "2026-10-08", createdAt: "2026-10-09" }), null);
  assert.equal(getOfficialRecordDate({ recordKind: "calving", date: "2026-10-08", createdAt: "2026-10-09" }), "2026-10-08");
  assert.equal(getOfficialRecordDate({ recordKind: "calving", createdAt: "2026-10-09" }), null);
});

test("official Health date is the MedicalRecord date, not resolution or entry time", () => {
  assert.equal(getOfficialRecordDate({ recordKind: "medical_record", date: "2026-10-08", resolvedAt: "2026-10-09" }), "2026-10-08");
  assert.equal(getOfficialRecordDate({ recordKind: "medical_record", resolvedAt: "2026-10-09", createdAt: "2026-10-10" }), null);
});

test("the official list recordDate is authoritative even when the source has a date", () => {
  assert.equal(getOfficialRecordDate({ recordKind: "insemination", recordDate: null, inseminationDate: "2026-10-08" }), null);
  assert.equal(getOfficialRecordDate({ recordKind: "medical_record", recordDate: "2026-10-08" }), "2026-10-08");
});
