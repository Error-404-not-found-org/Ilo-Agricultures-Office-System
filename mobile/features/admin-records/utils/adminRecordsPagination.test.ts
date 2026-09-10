import assert from "node:assert/strict";
import test from "node:test";

import {
  getNextAdminRecordsPage,
  getPreviousAdminRecordsPage,
} from "./adminRecordsPagination.ts";

test("next page advances until the backend total-page boundary", () => {
  assert.equal(getNextAdminRecordsPage(1, 3), 2);
  assert.equal(getNextAdminRecordsPage(2, 3), 3);
  assert.equal(getNextAdminRecordsPage(3, 3), 3);
});

test("previous page retreats without moving below page one", () => {
  assert.equal(getPreviousAdminRecordsPage(3), 2);
  assert.equal(getPreviousAdminRecordsPage(2), 1);
  assert.equal(getPreviousAdminRecordsPage(1), 1);
});
