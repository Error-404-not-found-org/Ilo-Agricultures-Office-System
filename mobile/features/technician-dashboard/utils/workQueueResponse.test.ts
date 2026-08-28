import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { getTechnicianWorkQueue } from "../../technician/services/tasks.service.ts";
import {
  normalizeTechnicianWorkItems,
  summarizeTechnicianWork,
} from "../../technician-requests/utils/requestWorkPresentation.ts";

const filters = {
  workState: "active" as const,
  type: "all" as const,
  search: "",
  page: 1,
  limit: 20,
};

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readMobileSource(relativePath: string) {
  return readFileSync(resolve(mobileRoot, relativePath), "utf8");
}

test("empty paginated Work Queue response retains the canonical data envelope", async () => {
  const api = {
    get: async (url: string, config: unknown) => {
      assert.equal(url, "/technician/work-queue");
      assert.deepEqual(config, { params: filters });
      return {
        data: {
          data: [],
          pagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
          counts: { all: 0, ai: 0, health: 0, pregnancy: 0, calving: 0 },
        },
      };
    },
  };

  const response = await getTechnicianWorkQueue(api as any, filters);
  assert.deepEqual(response.data, []);
  assert.equal(response.pagination.total, 0);
  assert.equal(response.counts.all, 0);

  const workItems = normalizeTechnicianWorkItems(response.data);
  assert.deepEqual(workItems, []);
  assert.deepEqual(summarizeTechnicianWork(workItems), {
    dueToday: 0,
    needsAttention: 0,
    completedToday: 0,
  });
});

test("malformed or missing Work Queue data fails safely without fake items", async () => {
  for (const data of [undefined, { data: undefined }, { data: {} }]) {
    const api = { get: async () => ({ data }) };
    const response = await getTechnicianWorkQueue(api as any, filters);
    assert.deepEqual(response.data, []);
    assert.equal(response.pagination.total, 0);
  }
});

test("Technician Dashboard passes query.data.data to the array normalizer", () => {
  const source = readMobileSource(
    "features/technician-dashboard/hooks/useTechnicianDashboardScreen.ts",
  );

  assert.match(
    source,
    /normalizeTechnicianWorkItems\(workQueueQuery\.data\?\.data\)/,
  );
  assert.doesNotMatch(
    source,
    /normalizeTechnicianWorkItems\(workQueueQuery\.data\s*\|\|/,
  );
});

test("other Work Queue consumers use the canonical data array", () => {
  const myWork = readMobileSource(
    "features/technician-requests/components/TechnicianMyWorkPanel.tsx",
  );
  const animalDetails = readMobileSource(
    "features/animals/screens/RoleAwareAnimalDetailsScreen.tsx",
  );
  const pregnancyVerification = readMobileSource(
    "app/(technician)/pregnancy-verification.tsx",
  );

  assert.match(myWork, /normalizeTechnicianWorkItems\(data\?\.data\)/);
  assert.doesNotMatch(myWork, /data\?\.items/);
  assert.match(animalDetails, /workQueue\?\.data\.find/);
  assert.doesNotMatch(animalDetails, /workQueue\?\.items/);
  assert.match(pregnancyVerification, /Array\.isArray\(oldData\.data\)/);
});
