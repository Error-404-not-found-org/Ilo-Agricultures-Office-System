import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FarmerObservationModal from "./FarmerObservationModal";

describe("FarmerObservationModal", () => {
  it("presents the farmer submission as observation evidence, not a diagnosis", () => {
    render(
      <FarmerObservationModal
        isOpen
        onClose={vi.fn()}
        request={{
          farmer: "Maria Santos",
          animalTag: "ILO-602",
          farmerObservation: {
            reportType: "possible_pregnancy",
            reportedAt: "2026-07-20T08:00:00.000Z",
            signs: ["no_return_to_heat"],
            notes: "Eating normally",
            evidencePhotos: ["https://example.test/observation.jpg"],
          },
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Farmer observation details" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Possible pregnancy")).toBeInTheDocument();
    expect(screen.getByText("No Return To Heat")).toBeInTheDocument();
    expect(screen.getByText("Eating normally")).toBeInTheDocument();
    expect(
      screen.getByText(/not an official pregnancy diagnosis/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /farmer-submitted breeding observation 1/i }),
    ).toHaveAttribute("src", "https://example.test/observation.jpg");
  });

  it("truthfully identifies when no photo was submitted", () => {
    render(
      <FarmerObservationModal
        isOpen
        onClose={vi.fn()}
        request={{ farmer: "Maria Santos", animalTag: "ILO-602" }}
      />,
    );

    expect(
      screen.getByText("No photos were submitted with this observation."),
    ).toBeInTheDocument();
  });
});
