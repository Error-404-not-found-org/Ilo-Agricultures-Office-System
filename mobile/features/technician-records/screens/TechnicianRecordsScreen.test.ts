import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const directory = dirname(fileURLToPath(import.meta.url));

test("Technician Records keeps browse and official detail routing without report actions", () => {
  const screen = readFileSync(resolve(directory, "TechnicianRecordsScreen.tsx"), "utf8");
  assert.match(screen, /<RecordList\b/);
  assert.match(screen, /<SearchBar\b/);
  assert.match(screen, /<FilterChips\b/);
  assert.match(screen, /<DateRangeSelector\b/);
  assert.ok(screen.includes('pathname: "/(technician)/record-details"'));
  for (const action of ["Export records", "Generate Report", "Report Studio", "generatePDF", "generateExcel", "Export Full Excel Sheet"]) {
    assert.equal(screen.includes(action), false, `${action} must not remain in Technician Records`);
  }
});

test("stale Technician report redirect is removed without changing the Records tab", () => {
  const route = resolve(directory, "../../../app/(technician)/(tabs)/technician.records.tsx");
  const reportRoute = resolve(directory, "../../../app/(technician)/technician.reports.tsx");
  assert.equal(existsSync(reportRoute), false);
  assert.equal(existsSync(route), true);
});

test("record presentation does not invent missing attempt, Pregnancy result, or Calving ease", () => {
  const modal = readFileSync(resolve(directory, "../components/LedgerDetailModal.tsx"), "utf8");
  const detail = readFileSync(resolve(directory, "../components/TechnicianOfficialRecordContent.tsx"), "utf8");
  assert.equal(modal.includes("item.attemptNumber || 1"), false);
  assert.equal(modal.includes('item.pregnancyStatus || "Pending"'), false);
  assert.equal(detail.includes('details.calvingEase || "Natural"'), false);
  assert.ok(detail.includes('details.attemptNumber'), "the canonical attempt remains visible when recorded");
});
