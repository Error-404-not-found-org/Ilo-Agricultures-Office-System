import assert from "node:assert/strict";
import test from "node:test";

import type { AxiosInstance } from "axios";

import { getAdminTechnicianWorkloadSummary } from "./adminWorkload.service.ts";

test("loads the canonical Admin technician workload summary endpoint", async () => {
  const requestedUrls: string[] = [];
  const api = {
    get: async (url: string) => {
      requestedUrls.push(url);
      return {
        data: {
          technicians: [
            {
              technicianId: "tech-1",
              name: "Technician",
              activeWorkloadTotal: 2,
              counts: { ai: 1, health: 0, pregnancy: 1, calving: 0, tasks: 0 },
            },
          ],
        },
      };
    },
  } as unknown as AxiosInstance;

  const result = await getAdminTechnicianWorkloadSummary(api);

  assert.deepEqual(requestedUrls, ["/admin/technician-workload-summary"]);
  assert.equal(result[0]?.technicianId, "tech-1");
});

test("treats a malformed workload response as an empty list", async () => {
  const api = {
    get: async () => ({ data: {} }),
  } as unknown as AxiosInstance;

  assert.deepEqual(await getAdminTechnicianWorkloadSummary(api), []);
});
