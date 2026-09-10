import assert from "node:assert/strict";
import test from "node:test";

import type { UserItem } from "@/features/admin-users/types/adminUsers.types";

import type { TechnicianWorkloadSummary } from "../services/adminWorkload.service";
import {
  getActiveWorkloadTotal,
  mergeTechniciansWithWorkload,
} from "./adminWorkloadPresentation.ts";

const counts = {
  ai: 0,
  health: 0,
  pregnancy: 0,
  calving: 0,
  tasks: 0,
};

test("joins workload metadata by stable technician ID when names are duplicated", () => {
  const technicians = [
    {
      _id: "tech-a",
      name: "Same Name",
      role: "technician",
      email: "tech-a@example.test",
    },
    {
      _id: "tech-b",
      name: "Same Name",
      role: "technician",
      email: "tech-b@example.test",
    },
  ] satisfies UserItem[];
  const workload: TechnicianWorkloadSummary[] = [
    {
      technicianId: "tech-b",
      name: "Same Name",
      activeWorkloadTotal: 3,
      counts,
    },
    {
      technicianId: "tech-a",
      name: "Same Name",
      activeWorkloadTotal: 1,
      counts,
    },
  ];

  const result = mergeTechniciansWithWorkload({ technicians, workload });

  assert.equal(result[0].technicianId, "tech-b");
  assert.equal(result[0].email, "tech-b@example.test");
  assert.equal(result[1].technicianId, "tech-a");
  assert.equal(result[1].email, "tech-a@example.test");
});

test("sums the backend-provided active workload totals", () => {
  const workload: TechnicianWorkloadSummary[] = [
    {
      technicianId: "tech-a",
      name: "Technician A",
      activeWorkloadTotal: 4,
      counts,
    },
    {
      technicianId: "tech-b",
      name: "Technician B",
      activeWorkloadTotal: 2,
      counts,
    },
  ];

  assert.equal(getActiveWorkloadTotal(workload), 6);
});
