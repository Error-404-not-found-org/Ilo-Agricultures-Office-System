import test from "node:test";
import assert from "node:assert/strict";
import { getOfficialRecords } from "./records.service.ts";

test("official records request keeps the selected Farmer ID", async () => {
  let requested: Record<string, unknown> | undefined;
  const api = {
    get: async (_path: string, options: { params: Record<string, unknown> }) => {
      requested = options.params;
      return { data: { data: [] } };
    },
  };
  await getOfficialRecords(api as any, { farmerId: "farmer-123" });
  assert.equal(requested?.farmerId, "farmer-123");
});
