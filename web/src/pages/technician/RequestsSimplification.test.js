import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  REQUEST_BOARD_VIEWS,
  getRequestBoardViewSelection,
} from "../../utils/requestBoardViews";

const requestsSource = readFileSync(
  "src/pages/technician/Requests.jsx",
  "utf8",
);

describe("Technician Requests responsibility", () => {
  it("queries only AI and Health incoming services", () => {
    expect(requestsSource).toContain("includeOperationalTasks: false");
    expect(requestsSource).toContain('["ai", "AI"]');
    expect(requestsSource).toContain('["health", "Health"]');
    expect(requestsSource).not.toContain("Pregnancy Check");
    expect(requestsSource).not.toContain("Calving Assistance");
  });

  it("removes duplicate Request Summary and Claimed Requests panels", () => {
    expect(requestsSource).not.toContain("requests-stats-background");
    expect(requestsSource).not.toContain("Request Summary");
    expect(requestsSource).not.toContain("Claimed Requests");
    expect(requestsSource).not.toContain("statsRequests");
  });

  it("keeps only practical visible Technician filters", () => {
    expect(requestsSource).toContain('aria-label="Search service requests"');
    expect(requestsSource).toContain('aria-label="Request ownership"');
    expect(requestsSource).toContain('aria-label="Request type"');
    expect(requestsSource).toContain('aria-label="Health urgency"');
    expect(requestsSource).not.toContain('aria-label="Municipality"');
    expect(requestsSource).not.toContain('aria-label="District"');
    expect(requestsSource).not.toContain('aria-label="Sort order"');
    expect(requestsSource).not.toContain("Near me");
  });

  it("maps Available and Mine to the canonical backend query contract", () => {
    expect(
      getRequestBoardViewSelection(REQUEST_BOARD_VIEWS.AVAILABLE),
    ).toEqual({ status: "pending", assignment: "unassigned" });
    expect(getRequestBoardViewSelection(REQUEST_BOARD_VIEWS.MINE)).toEqual({
      status: "active",
      assignment: "mine",
    });
  });

  it("keeps AI and Health canonical detail workflows without walk-in UI", () => {
    expect(requestsSource).toContain("<AIClaimScheduleAction");
    expect(requestsSource).toContain("<HealthRequestActionModal");
    expect(requestsSource).not.toContain("WalkInHealthModal");
    expect(requestsSource).not.toContain("WalkInInsemination");
    expect(requestsSource).toContain("No available requests");
    expect(requestsSource).toContain("No active claimed requests");
  });
});
