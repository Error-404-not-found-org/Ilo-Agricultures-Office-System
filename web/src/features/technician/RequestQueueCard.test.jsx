import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import RequestQueueCard from "./RequestQueueCard";

const baseRequest = {
  id: "request-1",
  workflowType: "AI",
  type: "insemination",
  serviceType: "ai",
  status: "pending",
  farmer: "Maria Santos",
  farmerImageUrl: null,
  animalName: "Bessie",
  animalTag: "OTON-14",
  species: "Cattle",
  breed: "Holstein",
  location: "Poblacion South, Oton",
  formattedSentAt: "Sep 1, 2026, 8:15 AM",
  date: "Not scheduled",
  taskDetails: "Artificial insemination requested",
  attachments: {
    count: 2,
    urls: ["photo-1", "photo-2"],
  },
  raw: {},
};

const handlers = () => ({
  onOpen: vi.fn(),
  onClaim: vi.fn(),
  onSchedule: vi.fn(),
  onCancel: vi.fn(),
});

describe("Technician Request card", () => {
  it("presents an available AI request and opens canonical claim scheduling", () => {
    const actions = handlers();
    render(
      <RequestQueueCard
        request={baseRequest}
        currentUserId="technician-1"
        isUpdating={false}
        canClaim
        canCancel
        {...actions}
      />,
    );

    expect(screen.getByText("AI Request")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByLabelText("2 Farmer request photos")).toBeInTheDocument();
    expect(screen.queryByText(/request-1/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Claim & Schedule" }));
    expect(actions.onSchedule).toHaveBeenCalledWith(baseRequest);
    expect(actions.onClaim).not.toHaveBeenCalled();
  });

  it("makes urgent Health requests obvious and preserves claim behavior", () => {
    const actions = handlers();
    const healthRequest = {
      ...baseRequest,
      workflowType: "Health",
      type: "health",
      serviceType: "health",
      urgency: "urgent",
      attachments: { count: 1, urls: ["health-photo"] },
    };
    render(
      <RequestQueueCard
        request={healthRequest}
        currentUserId="technician-1"
        isUpdating={false}
        canClaim
        canCancel
        {...actions}
      />,
    );

    expect(screen.getByText("Health Request")).toBeInTheDocument();
    expect(screen.getByText("Urgent")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Claim Request" }));
    expect(actions.onClaim).toHaveBeenCalledWith(healthRequest);
  });

  it("shows Mine as Claimed by You with View Request and cancellation", () => {
    const actions = handlers();
    const mine = {
      ...baseRequest,
      status: "approved",
      raw: { approvedBy: { _id: "technician-1" } },
    };
    render(
      <RequestQueueCard
        request={mine}
        currentUserId="technician-1"
        isUpdating={false}
        canClaim
        canCancel
        {...actions}
      />,
    );

    expect(screen.getByText("Claimed by You")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View Request" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel request" }));
    expect(actions.onOpen).toHaveBeenCalledWith(mine);
    expect(actions.onCancel).toHaveBeenCalledWith(mine);
  });
});
