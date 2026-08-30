import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import axiosInstance from "../../lib/axios";
import Users from "./Users";

vi.mock("../../lib/axios", () => ({ default: { get: vi.fn() } }));
vi.mock("../../components/layout/Topbar", () => ({ default: () => null }));
vi.mock("../../components/ui/UserAvatar", () => ({ default: () => null }));
vi.mock("../../components/dialogs/RegisterFarmerModal", () => ({
  default: ({ isOpen, onSuccess }) =>
    isOpen ? (
      <div role="dialog" aria-label="Farmer creation dialog">
        <button type="button" onClick={() => onSuccess({ _id: "farmer-new" })}>
          Complete Farmer creation
        </button>
      </div>
    ) : null,
}));
vi.mock("../../components/dialogs/TechnicianInviteDialog", () => ({
  default: () => null,
}));

describe("Admin Add User refresh", () => {
  it("refreshes the Users directory after successful Farmer creation", async () => {
    axiosInstance.get.mockResolvedValue({
      data: { data: [], total: 0, page: 1, limit: 10, totalPages: 0 },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/admin/users?role=farmer"]}>
          <Users />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByText("No farmers found.");
    fireEvent.click(screen.getByRole("button", { name: "Add User" }));
    fireEvent.click(screen.getByRole("button", { name: /^FarmerCreate/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Complete Farmer creation" }),
    );

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["admin", "users"],
      });
    });
  });
});
