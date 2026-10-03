import test from "node:test";
import assert from "node:assert/strict";
import { archiveFarmerProfile } from "./clients.service.ts";

test("Technician Mobile archive calls the guarded Farmer archive endpoint", async () => {
  let requestedPath = "";
  const api = {
    patch: async (path: string) => {
      requestedPath = path;
      return { data: { message: "Farmer archived" } };
    },
  } as Parameters<typeof archiveFarmerProfile>[0];
  const result = await archiveFarmerProfile(api, "507f1f77bcf86cd799439012");
  assert.equal(requestedPath, "/user/507f1f77bcf86cd799439012/technician-archive");
  assert.equal(result.message, "Farmer archived");
});
