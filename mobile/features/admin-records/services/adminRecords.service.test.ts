import assert from "node:assert/strict";
import test from "node:test";

import {
  getAdminCalvings,
  getAdminInseminations,
  getAdminPregnancies,
  runCompleteAdminRecordsExport,
} from "./adminRecords.service.ts";

test("visible Records page preserves backend pagination totals beyond ten rows", async () => {
  const calls: any[] = [];
  const api = {
    get: async (path: string, config: any) => {
      calls.push({ path, config });
      return {
        data: {
          data: Array.from({ length: 10 }, (_, index) => ({
            _id: "ai-" + (index + 11),
          })),
          pagination: { page: 2, limit: 10, total: 27, totalPages: 3 },
        },
      };
    },
  };

  const result = await getAdminInseminations(api as any, {
    page: 2,
    limit: 10,
    search: "older cow",
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: "2026-01-31T23:59:59.999Z",
  });

  assert.equal(result.data.length, 10);
  assert.equal(result.page, 2);
  assert.equal(result.total, 27);
  assert.equal(result.totalPages, 3);
  assert.deepEqual(calls[0], {
    path: "/admin/inseminations",
    config: {
      params: {
        page: 2,
        limit: 10,
        search: "older cow",
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: "2026-01-31T23:59:59.999Z",
        status: "done",
      },
    },
  });
});

test("AI, Pregnancy, and Calving retain their canonical Admin endpoints", async () => {
  const paths: string[] = [];
  const api = {
    get: async (path: string) => {
      paths.push(path);
      return {
        data: {
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        },
      };
    },
  };

  await getAdminInseminations(api as any);
  await getAdminPregnancies(api as any);
  await getAdminCalvings(api as any);

  assert.deepEqual(paths, [
    "/admin/inseminations",
    "/admin/pregnancy-checks",
    "/admin/calvings",
  ]);
});

test("complete export deliberately retrieves every backend page", async () => {
  const source = Array.from({ length: 205 }, (_, index) => ({
    _id: "pregnancy-" + (index + 1),
  }));
  const requestedPages: number[] = [];
  const api = {
    get: async (_path: string, config: any) => {
      const { page, limit } = config.params;
      requestedPages.push(page);
      return {
        data: {
          data: source.slice((page - 1) * limit, page * limit),
          pagination: {
            page,
            limit,
            total: source.length,
            totalPages: Math.ceil(source.length / limit),
          },
        },
      };
    },
  };
  let exported: any[] = [];

  await runCompleteAdminRecordsExport(
    api as any,
    "pregnancy",
    { search: "confirmed" },
    async (records) => {
      exported = records;
    },
  );

  assert.deepEqual(requestedPages, [1, 2, 3]);
  assert.equal(exported.length, 205);
  assert.equal(exported[0]._id, "pregnancy-1");
  assert.equal(exported[204]._id, "pregnancy-205");
});

test("a failed later export page never invokes the file writer", async () => {
  const api = {
    get: async (_path: string, config: any) => {
      if (config.params.page === 2) {
        throw new Error("network failure");
      }
      return {
        data: {
          data: Array.from({ length: 100 }, (_, index) => ({
            _id: "calving-" + (index + 1),
          })),
          pagination: { page: 1, limit: 100, total: 150, totalPages: 2 },
        },
      };
    },
  };
  let writerCalled = false;

  await assert.rejects(
    runCompleteAdminRecordsExport(
      api as any,
      "calving",
      {},
      async () => {
        writerCalled = true;
      },
    ),
    /network failure/,
  );
  assert.equal(writerCalled, false);
});

test("an incomplete or shifting export dataset is rejected", async () => {
  const api = {
    get: async () => ({
      data: {
        data: [{ _id: "duplicate" }],
        pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
      },
    }),
  };

  await assert.rejects(
    runCompleteAdminRecordsExport(api as any, "insemination", {}, async () => {}),
    /complete filtered record set could not be retrieved/,
  );
});
