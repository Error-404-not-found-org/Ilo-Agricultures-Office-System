import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const source = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "useAdminRecords.ts"),
  "utf8",
);

test("Admin Records displays backend data and totals without local slicing", () => {
  assert.match(source, /currentData = currentResponse\?\.data \|\| \[\]/);
  assert.match(source, /totalRecordsCount: currentResponse\?\.total \|\| 0/);
  assert.match(source, /totalPages = currentResponse\?\.totalPages \|\| 1/);
  assert.doesNotMatch(source, /filteredData|\.slice\(\(page - 1\)/);
});

test("tab, search, and date changes reset visible pagination", () => {
  for (const setter of [
    "setActiveTab",
    "setSearchQuery",
    "setStartDate",
    "setEndDate",
  ]) {
    assert.match(
      source,
      new RegExp("const " + setter + " = [\\s\\S]*?setPage\\(1\\)"),
    );
  }
  assert.match(source, /const clearDateRange = \(\) => \{[\s\S]*?setPage\(1\)/);
});

test("search and date filters are server query inputs for every record source", () => {
  assert.match(source, /search: debouncedSearch \|\| undefined/);
  assert.match(source, /startDate: toStartBoundary\(startDate\)/);
  assert.match(source, /endDate: toEndBoundary\(endDate\)/);
  assert.match(source, /getAdminInseminations\(api, \{[\s\S]*?\.\.\.filterParams/);
  assert.match(source, /getAdminPregnancies\(api, \{[\s\S]*?\.\.\.filterParams/);
  assert.match(source, /getAdminCalvings\(api, \{[\s\S]*?\.\.\.filterParams/);
});

test("export uses one complete-record gate before any formatter", () => {
  assert.match(source, /await runCompleteAdminRecordsExport\(/);
  assert.match(source, /handleExportCSV\(completeRecords, category\)/);
  assert.match(source, /handleExportExcel\(completeRecords, category\)/);
  assert.match(source, /handleExportPDF\(completeRecords, category\)/);
  assert.match(source, /No export file was created/);
});
