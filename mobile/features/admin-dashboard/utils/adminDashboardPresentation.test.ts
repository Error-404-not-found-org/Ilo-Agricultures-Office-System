import assert from "node:assert/strict";
import test from "node:test";

import { buildAdminAttentionSummary } from "./adminDashboardPresentation.ts";

test("summarizes actionable Admin attention without hardcoded statistics", () => {
  const result = buildAdminAttentionSummary({
    technicians: [
      {
        role: "technician",
        status: "active",
        isVerified: true,
        profileClaimStatus: "claimed",
        dispatchProfile: {
          serviceMunicipalities: [
            { municipalityCode: "063034000", municipalityName: "Oton" },
          ],
          serviceCapabilities: ["AI"],
          availabilityStatus: "available",
          acceptsNewRequests: true,
        },
      },
      {
        role: "technician",
        status: "active",
        isVerified: true,
        profileClaimStatus: "claimed",
        dispatchProfile: {
          serviceMunicipalities: [],
          serviceCapabilities: [],
          availabilityStatus: "off_duty",
          acceptsNewRequests: false,
        },
      },
    ],
    aiRequests: { data: [{ status: "pending" }, { status: "scheduled" }] },
    healthRequests: [{ status: "pending" }, { status: "resolved" }],
    workloadSummary: [
      {
        technicianId: "tech-a",
        name: "Duplicate Name",
        activeWorkloadTotal: 4,
        counts: { ai: 1, health: 1, pregnancy: 1, calving: 1, tasks: 0 },
      },
      {
        technicianId: "tech-b",
        name: "Duplicate Name",
        activeWorkloadTotal: 2,
        counts: { ai: 0, health: 1, pregnancy: 0, calving: 0, tasks: 1 },
      },
    ],
  });

  assert.deepEqual(result, {
    pendingRequests: 2,
    activeWork: 6,
    totalTechnicians: 2,
    notReadyTechnicians: 1,
    setupIncompleteTechnicians: 1,
  });
});
