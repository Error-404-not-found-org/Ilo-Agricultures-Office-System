import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("../lib/axios", () => ({
  default: { post: mocks.post },
}));

import {
  normalizeAdminRequestType,
  reassignRequest,
} from "./adminRequestsService";

describe("Admin request reassignment service", () => {
  beforeEach(() => mocks.post.mockReset());

  it.each([
    ["AI", "ai", "ai-request-1"],
    ["insemination", "ai", "ai-request-2"],
    ["Health", "health", "health-request-1"],
  ])("normalizes %s and uses the canonical Admin endpoint", async (input, type, requestId) => {
    mocks.post.mockResolvedValue({ data: { request: { _id: requestId } } });

    await reassignRequest({
      type: input,
      requestId,
      technicianId: "technician-1",
    });

    expect(mocks.post).toHaveBeenCalledWith(
      `/admin/requests/${type}/${requestId}/reassign`,
      { technicianId: "technician-1" },
    );
  });

  it("rejects display-only or unsupported request types", () => {
    expect(() => normalizeAdminRequestType("Service")).toThrow(
      "Only Insemination and Health requests can be reassigned.",
    );
  });
});
