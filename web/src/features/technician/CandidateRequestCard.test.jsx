import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RequestQueueCard from "./RequestQueueCard";

describe("privacy-safe Technician candidate cards", () => {
  for (const type of ["ai", "health"]) {
    it(`renders and opens a ${type} candidate without raw or contact fields`, () => {
      const onOpen = vi.fn();
      const candidate = {
        id: `${type}-candidate`,
        workflowType: type === "ai" ? "AI" : "Health",
        type: type === "ai" ? "insemination" : "health",
        serviceType: type,
        status: "pending",
        farmer: "Test Farmer",
        animalTag: "OT-001",
        breed: "Native",
        species: "Cattle",
        location: "Poblacion, Oton",
        formattedSentAt: "Oct 1, 2026",
        date: "Not scheduled",
        taskDetails: type === "ai" ? "Artificial insemination requested" : "Health assistance requested",
        attachments: { count: 0, urls: [] },
      };

      render(
        <RequestQueueCard
          request={candidate}
          currentUserId="technician-1"
          isUpdating={false}
          canClaim
          canCancel={false}
          onOpen={onOpen}
        />,
      );

      expect(screen.getByText("Test Farmer")).toBeInTheDocument();
      expect(screen.getByText("Poblacion, Oton")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /phone|call/i })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Review Request" }));
      expect(onOpen).toHaveBeenCalledWith(candidate);
    });
  }
});
