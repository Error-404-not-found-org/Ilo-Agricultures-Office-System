import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "../../lib/axios";
import Technicians from "./Technicians";

vi.mock("../../lib/axios", () => ({ default: { get: vi.fn() } }));
vi.mock("../../components/layout/Topbar", () => ({
  default: () => <header>Technician Management</header>,
}));
vi.mock("../../components/ui/UserAvatar", () => ({
  default: ({ name }) => <span aria-label={(name || "User") + " avatar"} />,
}));
vi.mock("../../components/dialogs/TechnicianInviteDialog", () => ({
  default: ({ open, onClose }) =>
    open ? (
      <div role="dialog" aria-label="Shared Technician invitation">
        <button type="button" onClick={onClose}>
          Close invitation
        </button>
      </div>
    ) : null,
}));

describe("legacy Admin Technician roster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosInstance.get.mockResolvedValue({
      data: {
        users: [
          {
            _id: "legacy-tech",
            name: "Legacy Technician",
            role: "technician",
            status: "active",
            address: { city: "Oton" },
          },
        ],
      },
    });
  });

  it("keeps the roster list and shared invitation entry functional", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Technicians />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Legacy Technician")).toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenCalledWith("/user?role=technician");

    fireEvent.click(
      screen.getByRole("button", { name: /Invite Field Officer/i }),
    );
    expect(
      screen.getByRole("dialog", { name: "Shared Technician invitation" }),
    ).toBeInTheDocument();
  });
});
