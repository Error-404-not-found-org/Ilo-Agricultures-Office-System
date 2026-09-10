import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminRequestCards from "./AdminRequestCards";

const request = {
  id: "request-1",
  workflowType: "AI",
  serviceBadge: "AI",
  serviceLabel: "AI Service",
  farmer: "Maria Farmer",
  animalName: "Bessie",
  animalTag: "ILO-101",
  location: "Oton, Iloilo",
  date: "Aug 30, 2026 · Morning",
  visitDate: "2026-01-10T00:00:00.000Z",
  formattedSentAt: "Aug 28, 2026, 9:00 AM",
  status: "approved",
  raw: {
    approvedBy: {
      _id: "technician-1",
      name: "Tech One",
    },
  },
};

describe("Admin Request cards", () => {
  it("shows factual oversight context and only a View Request action", () => {
    const onViewRequest = vi.fn();

    render(
      <AdminRequestCards
        requests={[request]}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        onViewRequest={onViewRequest}
        emptyMessage="No requests."
      />,
    );

    expect(screen.getByRole("heading", { name: "AI Service" }))
      .toBeInTheDocument();
    expect(screen.getByText("Maria Farmer")).toBeInTheDocument();
    expect(screen.getByText(/Bessie/)).toBeInTheDocument();
    expect(screen.getByText("Tech One")).toBeInTheDocument();
    expect(screen.getByText("Aug 30, 2026 · Morning")).toBeInTheDocument();
    expect(screen.getByText("Scheduled date has passed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View Request" }));
    expect(onViewRequest).toHaveBeenCalledWith(request);

    expect(screen.queryByText("Claim")).not.toBeInTheDocument();
    expect(screen.queryByText("Complete")).not.toBeInTheDocument();
    expect(screen.queryByText("Record Service")).not.toBeInTheDocument();
    expect(screen.queryByText(/Monitoring/)).not.toBeInTheDocument();
  });

  it("keeps unassigned requests explicit", () => {
    render(
      <AdminRequestCards
        requests={[
          {
            ...request,
            id: "request-2",
            status: "pending",
            visitDate: null,
            raw: {},
          },
        ]}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        onViewRequest={vi.fn()}
        emptyMessage="No requests."
      />,
    );

    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.getByText("Unclaimed")).toBeInTheDocument();
  });

  it("keeps Health requests in the Admin service-request list", () => {
    render(
      <AdminRequestCards
        requests={[
          {
            ...request,
            id: "health-request-1",
            workflowType: "Health",
            serviceBadge: "HEALTH",
            serviceLabel: "Health Assistance",
            status: "scheduled",
          },
        ]}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        onViewRequest={vi.fn()}
        emptyMessage="No requests."
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Health Assistance" }),
    ).toBeInTheDocument();
  });
});
