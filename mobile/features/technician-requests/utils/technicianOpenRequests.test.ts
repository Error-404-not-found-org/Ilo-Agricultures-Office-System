import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";
import test from "node:test";

import { getTechnicianRequests } from "../services/technicianRequests.service.ts";
import { OPEN_REQUEST_FILTERS } from "./requestWorkPresentation.ts";

const hookSource = readFileSync(
  fileURLToPath(
    new NodeURL("../hooks/useTechnicianRequests.ts", import.meta.url),
  ),
  "utf8",
);

test("Open Requests explicitly excludes operational Tasks at the API boundary", async () => {
  assert.match(hookSource, /includeOperationalTasks:\s*false/);
  assert.doesNotMatch(hookSource, /toRequestApiType|breeding_verification/);

  const calls: {
    url: string;
    params: Record<string, unknown>;
  }[] = [];
  const expected = {
    requests: [
      { id: "ai-1", workflowType: "AI", type: "ai" },
      { id: "health-1", workflowType: "HEALTH", type: "health" },
    ],
    pagination: { total: 2, page: 1, limit: 10, totalPages: 1 },
  };
  const api = {
    get: async (
      url: string,
      config: { params: Record<string, unknown> },
    ) => {
      calls.push({ url, params: config.params });
      return { data: expected };
    },
  };

  const response = await getTechnicianRequests(api as never, {
    type: "all",
    assignment: "unassigned",
    includeOperationalTasks: false,
  });

  assert.deepEqual(calls, [
    {
      url: "/technician/requests",
      params: {
        type: "all",
        assignment: "unassigned",
        includeOperationalTasks: false,
      },
    },
  ]);
  assert.deepEqual(
    response.requests.map((request) => request.workflowType),
    ["AI", "HEALTH"],
  );
});

test("Open Requests offers only Farmer-created AI and Health request filters", () => {
  assert.deepEqual(
    OPEN_REQUEST_FILTERS.map((filter) => filter.value),
    ["all", "ai", "health"],
  );
  assert.doesNotMatch(
    JSON.stringify(OPEN_REQUEST_FILTERS),
    /pregnancy|calving|breeding_follow_up/i,
  );
});

test("Bottom navigator badge queries authoritative available requests and calculates AI + Health only", () => {
  const bottomNavSource = readFileSync(
    fileURLToPath(
      new NodeURL("../../../app/components/BottomNavigator.tsx", import.meta.url),
    ),
    "utf8",
  );

  assert.match(bottomNavSource, /assignment:\s*"unassigned"/);
  assert.match(bottomNavSource, /includeOperationalTasks:\s*false/);
  assert.match(bottomNavSource, /includeCounts:\s*true/);
  assert.match(bottomNavSource, /counts\.ai.*counts\.health/);
});

test("TechnicianRequestsScreen renders distinct Available and My Work badges without mixing totals", () => {
  const screenSource = readFileSync(
    fileURLToPath(
      new NodeURL("../screens/TechnicianRequestsScreen.tsx", import.meta.url),
    ),
    "utf8",
  );

  assert.match(screenSource, /useTechnicianTasks/);
  assert.match(screenSource, /workState:\s*"active"/);
  assert.match(screenSource, /openRequestCounts\.ai.*openRequestCounts\.health/);
  assert.match(screenSource, /availableCount > 0/);
  assert.match(screenSource, /myWorkCount > 0/);
});

