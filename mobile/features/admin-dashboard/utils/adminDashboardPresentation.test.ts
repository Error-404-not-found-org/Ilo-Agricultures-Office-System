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
  });

  assert.deepEqual(result, {
    pendingRequests: 2,
    activeWork: 1,
    totalTechnicians: 2,
    notReadyTechnicians: 1,
    setupIncompleteTechnicians: 1,
  });
});
