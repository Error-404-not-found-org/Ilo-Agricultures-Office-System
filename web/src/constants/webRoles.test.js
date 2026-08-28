import { describe, expect, it } from "vitest";
import {
  WEB_ROLES,
  getRequestActionPolicy,
  normalizeWebRole,
} from "./webRoles";

describe("Web role policy", () => {
  it("keeps Admin request behavior oversight-only", () => {
    const policy = getRequestActionPolicy(WEB_ROLES.ADMIN);

    expect(policy).toMatchObject({
      isAdmin: true,
      canClaim: false,
      canSchedule: false,
      canStart: false,
      canComplete: false,
      canCancelOwnRequest: false,
      canReassign: true,
      canReviewCancellation: true,
      readOnlyClinical: true,
    });
  });

  it("preserves Technician request execution behavior", () => {
    const policy = getRequestActionPolicy(WEB_ROLES.TECHNICIAN);

    expect(policy).toMatchObject({
      isTechnician: true,
      canClaim: true,
      canSchedule: true,
      canStart: true,
      canComplete: true,
      canCancelOwnRequest: true,
      canReassign: false,
      canReviewCancellation: false,
      readOnlyClinical: false,
    });
  });

  it("fails closed for unknown roles", () => {
    expect(normalizeWebRole("farmer")).toBe(WEB_ROLES.UNKNOWN);
    expect(getRequestActionPolicy("farmer")).toMatchObject({
      canClaim: false,
      canSchedule: false,
      canStart: false,
      canComplete: false,
      canReassign: false,
      readOnlyClinical: true,
    });
  });
});
