import assert from "node:assert/strict";
import test from "node:test";

import { getTechnicianDashboardData } from "./technician.service.ts";

test("full Schedule reads future date-bound Tasks without creating records", async () => {
  const calls: { method: string; url: string; config: unknown }[] = [];
  const api = {
    get: async (url: string, config: unknown) => {
      calls.push({ method: "get", url, config });
      return { data: { agendaItems: [] } };
    },
  };

  await getTechnicianDashboardData(api as never, {
    fullAgenda: true,
    includeFutureDateBoundTasks: true,
  });

  assert.deepEqual(calls, [
    {
      method: "get",
      url: "/technician/dashboard-data",
      config: {
        params: {
          fullAgenda: true,
          includeFutureDateBoundTasks: true,
        },
      },
    },
  ]);
});
